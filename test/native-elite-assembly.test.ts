import { nalatiEliteRows } from './fixtures/nalati-headless';
import { need } from './fixtures/headless-plan';
import {admissionNative,admission} from './fixtures/nalati-return-modules';
import { expect, test, vi } from 'vitest';
import { NativeEliteRoster, nativeEliteBindings } from '../src/engine/ai/eliteRoster';
import { NativeEliteLifecycle } from '../src/engine/ai/eliteLifecycle';
import { HerdBrain, type HerdPorts } from '../src/engine/ai/herd';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import { ReturnProgram } from '../src/game/population/returnProgram';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';
import { legacyDouble } from './fake/FakeGame';

function method<O extends object, K extends keyof O>(owner: O, key: K): O[K] { return owner[key]; }
test('actual native elite declarations construct, bind and install the same engine owners in order', () => {
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
  try {
    const before = f.host.rng.snapshot(), program = admissionNative(f.host);
    const elites=new NativeEliteRoster(nalatiEliteRows({eliteDefs:ecology.elites,pageElites:{profiles:ecology.keeperElites.map(value=>({value}))},nativeKnockdown:f.rows[0]?.knockdown},
      {swipe:need(values.nativeEliteStrikes.swipe,'Missing swipe'),pounce:need(values.nativeEliteStrikes.pounce,'Missing pounce'),bite:need(values.nativeEliteStrikes.bite,'Missing bite')}),
      {host:f.host,core,bindings,kernel:{contacts:values.strikeContacts,strikes:f.loans.strikes,terrain:values.samplers,environment:values.env,ledges:values.bake.ledges},groups:values.groups});
    elites.bindProjected(2,ReturnProgram.native(f.host,values.boot.admission),core);elites.install();
    elites.bindPopulation(values.creatures);elites.bindBond(values.taming);
    expect(order).toEqual(['native:aqbars','native:kokbori','projected:2','add:aqbars','add:kokbori','add:argymaq','step']);
    expect(projected).toHaveBeenCalledExactlyOnceWith(2, program, core); expect(init).not.toHaveBeenCalled();
    expect(admissionNative(f.host)).toBe(program); expect(f.host.rng.snapshot()).toEqual(before);
    expect(core.entries.map(entry => entry.script.def.id)).toEqual(['aqbars','kokbori','argymaq']);
  } finally { f.scope.dispose(); }
});
