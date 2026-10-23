import { expect, test, vi } from 'vitest';
import { NativeEliteLifecycle, type NativeElitePopulation } from '../src/engine/ai/eliteLifecycle';
import { StalkerBrain } from '../src/engine/ai/stalker';
import { Scope } from '../src/engine/app/scope';
import { NativeEliteKernels } from '../src/engine/ai/eliteKernels';
import { PackBrain, type PackPorts } from '../src/engine/ai/pack';
import { nativeGroupBrain } from '../src/format/groupBrains';
import brainRows from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';
import type { SimHost } from '../src/engine/sim';
import { eliteBindings, installEliteEncounters } from '../src/game/shardfile/eliteEncounters';
import { legacyDouble } from './fake/FakeGame';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import assembly from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with { type: 'json' };

function fixture(scope?: Scope) {
  const f = nativeKernelOwners(scope), bindings = eliteBindings();
  const kernelRows = f.rows.map((row, i) => ({ id: `quarry.${String(i)}`, profile: row.profile, lair: { x: i * 12 + .25, z: -i * 17 - .125 }, awareRadius: row.awareRadius, contacts: row.contacts, fallbackStrike: row.fallbackStrike, knockdown: row.knockdown }));
  f.actor.variant = kernelRows[0]?.id ?? '';
  const kernels = new NativeEliteKernels(kernelRows, { ...f.loans, brains: bindings.brains });
  const rows = kernelRows.map((row, i) => {
    const entry = { def: { id: row.id, lair: row.lair }, member: { kind: f.actor.kind, variant: row.id, source: 'boot' as const, yaw: 0, memory: { marker: 4 } } };
    return i === 1 ? Object.assign(entry, { pack: { offset: [-6, 4], variants: ['silver', 'dark'] } }) : entry;
  });
  Object.defineProperty(f.actor, 'maxHp', { value: 100 }); Object.assign(f.actor, { yOffset: 0 });
  const owner = new NativeEliteLifecycle(rows, { host: f.host, kernels, bindings });
  const calls: unknown[] = [];
  const spec = nativeGroupBrain({ ...brainRows.pack, id: 'quarry.group', home: [0, 0], members: [f.actor.entityId] });
  if (spec.kind !== 'pack') throw new Error('Missing group profile');
  const pack = new PackBrain<AnimalSim>([f.actor], 90, 100, spec, legacyDouble<PackPorts<AnimalSim>>({}));
  const population: NativeElitePopulation = {
    host: f.host, bodies: [f.actor],
    spawnElite(kind, x, z, yaw, variant) { expect(this).toBe(population); calls.push(['spawn', kind, x, z, yaw, variant]); f.actor.variant = variant; return f.actor; },
    retireElite(actor) { expect(this).toBe(population); expect(actor).toBe(f.actor); calls.push(['retire', actor.entityId]); },
    spawnElitePack(x, z, variants) { expect(this).toBe(population); calls.push(['pack', x, z, [...variants]]); return pack; },
    retirePack(group) { expect(this).toBe(population); expect(group).toBe(pack); calls.push(['retire-pack', group.homeX, group.homeZ]); },
  };
  const state = { animal: null, phase2: false, pack: null, adopted: false, detached: false };
  const row = rows[0]; if (row === undefined) throw new Error('Missing row');
  const { controller, script } = owner.create(row.def, state);
  return { ...f, kernels, bindings, rows, owner, calls, pack, population, state, row, controller, script };
}

test('native lifecycle binds the original population late and retains receiver, boot adoption and respawn order', () => {
  const f = fixture();
  try {
    expect(() => f.script.spawn()).toThrow('Unbound elite population'); expect(f.state.adopted).toBe(false);
    const spawned = vi.spyOn(f.controller, 'spawned');
    // Callables are pinned when the controller is created; a spy must be installed beforehand.
    expect(() => f.script.spawn()).toThrow('Replaced elite lifecycle member'); spawned.mockRestore();
    f.actor.variant = f.row.member.variant;
    f.owner.bindPopulation(f.population); f.script.spawn();
    expect(f.script.animal).toBe(f.actor); expect(f.actor.mem['marker']).toBe(4); expect(f.state.adopted).toBe(true);
    expect(f.calls).toEqual([]); expect(f.bindings.brains.has(f.actor)).toBe(true);
    f.script.tick(.1, 2, true, false); expect(f.bindings.pinned.has(f.actor)).toBe(true);
    f.script.despawn(); expect(f.script.animal).toBeNull(); expect(f.bindings.brains.has(f.actor)).toBe(false); expect(f.bindings.pinned.has(f.actor)).toBe(false);
    f.script.spawn();
    expect(f.calls).toEqual([['retire', f.actor.entityId], ['spawn', f.row.member.kind, f.row.def.lair.x, f.row.def.lair.z, 0, f.row.member.variant]]);
    f.script.enterPhase2(); expect(f.state.phase2).toBe(true); f.script.reset(); expect(f.state.phase2).toBe(false);
  } finally { f.scope.dispose(); }
});

test('pack creation retains offset then home assignment and retirement before the body', () => {
  const f = fixture();
  try {
    const row = f.rows[1]; if (row === undefined) throw new Error('Missing group row');
    const state = { animal: null, phase2: false, pack: null, adopted: false, detached: false };
    const { script } = f.owner.create(row.def, state);
    f.owner.bindPopulation(f.population); script.spawn();
    expect(f.calls).toEqual([['spawn', row.member.kind, row.def.lair.x, row.def.lair.z, 0, row.member.variant], ['pack', row.def.lair.x - 6, row.def.lair.z + 4, ['silver', 'dark']]]);
    expect(state.pack).toBe(f.pack); expect([f.pack.homeX, f.pack.homeZ]).toEqual([row.def.lair.x, row.def.lair.z]);
    script.despawn(); expect(f.calls.slice(2)).toEqual([['retire-pack', f.pack.homeX, f.pack.homeZ], ['retire', f.actor.entityId]]); expect(state.pack).toBeNull();
  } finally { f.scope.dispose(); }
});

test('whole lifecycle row suffix refuses before any kernel allocation or owner effect', () => {
  const f = fixture(), create = vi.spyOn(f.kernels, 'create');
  try {
    let getters = 0;
    expect(() => new NativeEliteLifecycle([{ get def() { getters++; return {}; } }], { host: f.host, kernels: f.kernels, bindings: f.bindings })).toThrow('plain JSON');
    expect(getters).toBe(0);
    const [first, second] = f.rows; if (first === undefined || second === undefined) throw new Error('Missing rows');
    for (const bad of [[first, first], [first], [first, { ...second, member: { ...second.member, yaw: Infinity } }],
      [first, { ...second, def: { ...second.def, lair: { x: 1e308, z: 0 } }, pack: { offset: [1e308, 0], variants: [] } }]]) {
      expect(() => new NativeEliteLifecycle(bad, { host: f.host, kernels: f.kernels, bindings: f.bindings })).toThrow();
    }
    expect(create).not.toHaveBeenCalled(); expect(f.calls).toEqual([]);
  } finally { create.mockRestore(); f.scope.dispose(); }
});

test('foreign, duplicate, replaced and retiring population owners refuse before body or binding effects', () => {
  for (const change of ['foreign', 'duplicate', 'bodies', 'spawn', 'retire', 'pack', 'retire-pack', 'scope', 'pins', 'definition']) {
    const f = fixture(), other = nativeKernelOwners();
    try {
      if (change === 'foreign') { expect(() => f.owner.bindPopulation({ ...f.population, host: other.host })).toThrow('Foreign'); continue; }
      f.owner.bindPopulation(f.population);
      if (change === 'duplicate') { expect(() => f.owner.bindPopulation(f.population)).toThrow('duplicate'); continue; }
      if (change === 'bodies') Object.defineProperty(f.population, 'bodies', { value: [...f.population.bodies] });
      else if (change === 'spawn') Object.defineProperty(f.population, 'spawnElite', { value: () => f.actor });
      else if (change === 'retire') Object.defineProperty(f.population, 'retireElite', { value: () => undefined });
      else if (change === 'pack') Object.defineProperty(f.population, 'spawnElitePack', { value: () => f.pack });
      else if (change === 'retire-pack') Object.defineProperty(f.population, 'retirePack', { value: () => undefined });
      else if (change === 'scope') f.scope.dispose();
      else if (change === 'pins') Object.defineProperty(f.bindings, 'pinned', { value: new Set() });
      else Object.defineProperty(f.row.def, 'lair', { value: { ...f.row.def.lair } });
      expect(() => f.script.spawn()).toThrow(); expect(f.state.adopted).toBe(false); expect(f.calls).toEqual([]); expect(f.bindings.brains.size).toBe(0);
    } finally { f.scope.dispose(); other.scope.dispose(); }
  }
});

test('native metadata binds the concrete population immediately before the original restoring initialization branch', () => {
  const last = assembly.install.at(-1);
  expect(last).toEqual({ name: 'initialize', value: { $sequence: [{ $call: [{ $ref: ['elites', 'bindPopulation'] }, { $ref: ['creatures'] }] }, { $call: [{ $ref: ['elites', 'bindBond'] }, { $ref: ['taming'] }] },
    { $if: [{ $not: { $ref: ['context', 'restoring'] } }, { $call: [{ $ref: ['elites', 'initialize'] }] }, { $ref: ['absent'] }] }] } });
});

function method<O extends object, K extends keyof O>(owner: O, key: K): O[K] { return owner[key]; }

for (const barrier of ['spawned', 'disposeTell'] as const) test(`native ${barrier} replacement stops before the next lifecycle barrier`, () => {
  let current: ReturnType<typeof fixture> | undefined;
  const original = method(StalkerBrain.prototype, barrier);
  const spy = barrier === 'spawned'
    ? vi.spyOn(StalkerBrain.prototype, 'spawned').mockImplementation(function replaceAfterSpawn(this: StalkerBrain<AnimalSim>, actor) {
      const spawned = method(StalkerBrain.prototype, 'spawned');
      if (spawned === original) throw new Error('Missing injected barrier');
      original.call(this, actor);
      if (current !== undefined) Object.defineProperty(current.population, 'bodies', { value: [] });
    })
    : vi.spyOn(StalkerBrain.prototype, 'disposeTell').mockImplementation(function replaceAfterDispose(this: StalkerBrain<AnimalSim>) {
      original.call(this);
      if (current !== undefined) Object.defineProperty(current.population, 'bodies', { value: [] });
    });
  const f = fixture(); current = f;
  try {
    f.owner.bindPopulation(f.population);
    if (barrier === 'spawned') {
      expect(() => f.script.spawn()).toThrow('replaced elite lifecycle owner');
      expect(f.state.animal).toBe(f.actor); expect(f.bindings.brains.size).toBe(0);
    } else {
      current = undefined; f.script.spawn(); current = f;
      f.bindings.pinned.add(f.actor);
      expect(() => f.script.despawn()).toThrow('replaced elite lifecycle owner');
      expect(f.script.animal).toBe(f.actor); expect(f.bindings.pinned.has(f.actor)).toBe(true); expect(f.bindings.brains.has(f.actor)).toBe(true);
    }
    expect(f.calls).toEqual([]);
  } finally { spy.mockRestore(); f.scope.dispose(); }
});

test('pack factory replacement refuses before subsequent home projection', () => {
  const f = fixture();
  try {
    const row = f.rows[1]; if (row === undefined) throw new Error('Missing group row');
    const state = { animal: null, phase2: false, pack: null, adopted: false, detached: false }, { script } = f.owner.create(row.def, state);
    const spawn = f.population.spawnElitePack;
    Object.defineProperty(f.population, 'spawnElitePack', { value(this: NativeElitePopulation, x: number, z: number, variants: readonly string[]) {
      const pack = spawn.call(this, x, z, variants); Object.defineProperty(f.population, 'bodies', { value: [] }); return pack;
    } });
    f.owner.bindPopulation(f.population);
    expect(() => script.spawn()).toThrow('replaced elite lifecycle owner');
    expect([f.pack.homeX, f.pack.homeZ]).toEqual([90, 100]); expect(f.calls.length).toBe(2);
  } finally { f.scope.dispose(); }
});

test('ancestor sliced retirement closes the borrowed lifecycle before body allocation', () => {
  const parent = new Scope('original-root'), f = fixture(parent.child('population')); parent.onDispose(() => undefined);
  const steps = parent.disposeSteps();
  try {
    f.owner.bindPopulation(f.population); steps.next();
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    expect(() => f.script.spawn()).toThrow(); expect(f.calls).toEqual([]); expect(f.state.adopted).toBe(false);
  } finally { for (const _step of steps) { /* Finish only this original scope's teardown. */ } parent.dispose(); f.scope.dispose(); }
});

test('restore rechecks the same population after the entire continuation suffix before any Core or binding writes', () => {
  const f = fixture(), core = nativeEliteCore(f.host);
  let adapter: Parameters<SimHost['onStep']>[2], replace = false;
  Object.defineProperty(f.host, 'onStep', { value: (_id: string, _step: unknown, save: Parameters<SimHost['onStep']>[2]) => { adapter = save; return () => undefined; } });
  const prepare = core.prepareRestore.bind(core), writes = vi.spyOn(core, 'restoreClocks');
  vi.spyOn(core, 'prepareRestore').mockImplementation(value => { const commit = prepare(value); if (replace) Object.defineProperty(f.population, 'bodies', { value: [] }); return commit; });
  const instance = installEliteEncounters(f.host, { step: 'quarry.elites', version: 1, core, rows: [{ def: { ...f.row.def, lair: { ...f.row.def.lair, r: 1 }, rule: 'always', awareR: 10, engageR: 3, leashR: 20, respawnMin: 1 },
    keeper: 'kernel', snapshot: 'member', member: f.row.member }], ports: { bindings: f.bindings, kernels: { ...f.loans, rows: f.kernels.declaredRows.filter(row => row.id === f.row.def.id) } }, wire: {} });
  try {
    instance.bindPopulation(f.population);
    const script = instance.scripts[0]; if (script === undefined || adapter === undefined) throw new Error('Missing native owner');
    script.spawn(); f.bindings.pinned.add(f.actor);
    const savedAdapter = adapter, saved = savedAdapter.snapshot(), bytes = JSON.stringify(core.snapshot()); replace = true;
    expect(() => savedAdapter.restore(saved)).toThrow('replaced elite lifecycle owner');
    expect(writes).not.toHaveBeenCalled(); expect(JSON.stringify(core.snapshot())).toBe(bytes); expect(f.bindings.brains.has(f.actor)).toBe(true); expect(f.bindings.pinned.has(f.actor)).toBe(true);
    expect(() => instance.initialize()).toThrow('replaced elite lifecycle owner');
  } finally { f.scope.dispose(); }
});
