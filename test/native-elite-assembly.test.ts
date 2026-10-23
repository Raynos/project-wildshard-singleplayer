import { expect, test, vi } from 'vitest';
import { checkedHeadlessAssembly, prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { NativeEliteRoster, nativeEliteBindings } from '../src/engine/ai/eliteRoster';
import { NativeEliteLifecycle } from '../src/engine/ai/eliteLifecycle';
import { HerdBrain, type HerdPorts } from '../src/engine/ai/herd';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { Rapier } from '../src/engine/physics/rapier';
import { ReturnProgram } from '../src/game/population/returnProgram';
import assembly from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with { type: 'json' };
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';
import { legacyDouble } from './fake/FakeGame';

function method<O extends object, K extends keyof O>(owner: O, key: K): O[K] { return owner[key]; }
const ref = (...path: readonly (string | number)[]) => ({ $ref: path });
test('actual native elite declarations construct, bind and install the same engine owners in order', async () => {
  const f = nativeKernelOwners(), core = nativeEliteCore(f.host), order: string[] = [];
  const group = new HerdBrain([f.actor], { walkSpeed: 1, trotSpeed: 2, gallopSpeed: 3, chargeSpeed: 3, sightRadius: 10, grazingSightRadius: 5,
    coneAngle: 1, hearing: [1,2,3,4], alertThreshold: .5, flightMinDistance: 1, flightMaxDistance: 10,
    stallionVariant: f.actor.variant, foalPrefix: 'young', snortCue: 'snort', neighCue: 'neigh', squealCue: 'squeal' }, legacyDouble<HerdPorts<AnimalSim>>({}));
  const bindings = nativeEliteBindings(), create = method(NativeEliteLifecycle.prototype, 'create'), bind = method(NativeEliteRoster.prototype, 'bindProjected'), add = core.add.bind(core);
  vi.spyOn(NativeEliteLifecycle.prototype, 'create').mockImplementation(function ordered(this: NativeEliteLifecycle, def, state) { order.push(`native:${def.id}`); return create.call(this, def, state); });
  const projected = vi.spyOn(NativeEliteRoster.prototype, 'bindProjected').mockImplementation(function ordered(this: NativeEliteRoster, index, program, owner) { order.push(`projected:${String(index)}`); bind.call(this, index, program, owner); });
  vi.spyOn(core, 'add').mockImplementation(script => { order.push(`add:${script.def.id}`); return add(script); });
  Object.defineProperty(f.host, 'onStep', { value: () => { order.push('step'); return () => undefined; } });
  const init = vi.spyOn(core, 'initialize');
  const population = { host: f.host, bodies: [f.actor], spawnElite: () => f.actor, retireElite: () => undefined,
    spawnElitePack: () => { throw new Error('Unexpected allocation'); }, retirePack: () => undefined };
  const values = { bindings, eliteCore: core, boot: { admission }, strikeContacts: f.loans.contacts,
    nativeEliteStrikes: { swipe: f.loans.strikes[0], pounce: f.loans.strikes[1], bite: f.loans.strikes[2] },
    samplers: f.loans.terrain, env: f.loans.environment, bake: { ledges: f.loans.ledges }, groups: { packs: [], herds: [group, group] },
    creatures: population, taming: { scope: f.scope, phase: 'wild', companion: null } };
  const selected = new Set(['elites','bindElite.argymaq','installElites','initialize']);
  const declaration = { version: 1, modules: { '@wildshard/engine/ai/eliteRoster': ['NativeEliteRoster'],
    '@wildshard/game/population/returnProgram': ['ReturnProgram'], 'src/game/eliteAssemblyFixture': Object.keys(values) },
    constants: { eliteDefs: ecology.elites, pageElites: { profiles: ecology.keeperElites.map(value => ({ value })) }, nativeKnockdown: f.rows[0]?.knockdown },
    prepare: [], install: [...Object.keys(values).map(name => ({ name, value: ref('src/game/eliteAssemblyFixture', name) })), ...assembly.install.filter(row => selected.has(row.name))],
    level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } }, ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 0, steps: 0 } } };
  const modules = { '@wildshard/engine/ai/eliteRoster': { NativeEliteRoster }, '@wildshard/game/population/returnProgram': { ReturnProgram }, 'src/game/eliteAssemblyFixture': values };
  try {
    checkedHeadlessAssembly(declaration, modules);
    const shard = emptyShardfile({ slug: 'quarry', name: 'Quarry', author: 'Test', revision: 1, seed: 1 });
    const product = createShardProduct({ slug: 'quarry', revision: 1, shardfile: shard, sections: new Map(), files: new Map([['sim/headless-assembly.json', { hash: 'rows', url: 'rows' }]]), read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
    const plan = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier: legacyDouble<Rapier>({}) }, modules);
    const before = f.host.rng.snapshot(), program = ReturnProgram.native(f.host, admission);
    plan.install(f.host, { restoring: true, commands: () => [], emit: () => undefined });
    expect(order).toEqual(['native:aqbars','native:kokbori','projected:2','add:aqbars','add:kokbori','add:argymaq','step']);
    expect(projected).toHaveBeenCalledExactlyOnceWith(2, program, core); expect(init).not.toHaveBeenCalled();
    expect(ReturnProgram.native(f.host, admission)).toBe(program); expect(f.host.rng.snapshot()).toEqual(before);
    expect(core.entries.map(entry => entry.script.def.id)).toEqual(['aqbars','kokbori','argymaq']);
  } finally { f.scope.dispose(); }
});
