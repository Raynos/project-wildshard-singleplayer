import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compile committed guest source and load the renderer-free physics binary.
import { readFile } from 'node:fs/promises';
import { ScriptComposition } from '../../src/engine/script/composition';
import { ScriptDriver } from '../../src/engine/script/lane';
import { ScriptBrainDriver } from '../../src/engine/ai/scriptBrain';
import { DeclaredScriptWorld } from '../../src/engine/script/state';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import type { ScriptLimits } from '../../src/engine/script/host';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from './fixture';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let brainBytes: Uint8Array, numericBytes: Uint8Array, eventBytes: Uint8Array, rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  brainBytes = await compileScript(await readFile('test/fixtures/sim-level/brain.as', 'utf8'), { maximumPages: 2 });
  numericBytes = await compileScript(scriptSource('store<f64>(24576,1);store<f64>(24584,1);store<f64>(24592,99);store<f64>(24616,5);store<f64>(24624,1);store<f64>(24632,load<f64>(16384));', '', '2'), { maximumPages: 2 });
  eventBytes = await compileScript(scriptSource('store<f64>(24576,1);store<f64>(24584,1);store<f64>(24592,load<f64>(16384+256));', '', '1'), { maximumPages: 2 });
  const binary = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(binary).buffer);
});
const base = SIM_LEVEL.entities[0];
if (base === undefined) throw new Error('Missing fixture species');
const level = { ...SIM_LEVEL, entities: [base, { ...base, id: 'boar:2', seed: 9, at: { x: 4, y: 0, z: 4 } }] };
function create(host: SimHost, limits: Partial<ScriptLimits> = {}, numeric = numericBytes, divisor = 4, brain = brainBytes) {
  const modules = [{ name: 'brain', bytes: brain, seedLo: 357, seedHi: 0 }, { name: 'numeric', bytes: numeric, seedLo: 435, seedHi: 0 }];
  const world = new DeclaredScriptWorld({ fields: { 1: [0, 100] }, archetypes: [1], events: [1], maxEntities: 100 },
    [{ id: 1, name: 'alice', position: [0, 0, 0], fields: { 1: 0 }, frozen: false, interactive: true }],
    { shared: [{ id: 1, name: 'tick', type: 'i32', privacy: 'public', min: 0, max: 100000, default: 0 }], player: [] }, new Map([[1, 'alice']]));
  const numericDriver = new ScriptDriver({ world, query: () => [], modules, divisor, bindings: [{ module: 'numeric', entity: 1, actorId: 'alice', kind: 'server' }] });
  const queries: number[] = [], strikes: string[] = [];
  const brainDriver = new ScriptBrainDriver({ modules, actors: host.entities, divisor: 6,
    bindings: [7, 8].map((entity, index) => ({ module: 'brain', entity, actorId: index === 0 ? 'boar:1' : 'boar:2', maxSpeed: 3, maxStrafe: 1, maxTurnRate: 6, parameters: [2], strikes: [{ event: 101, strike: 'boar.charge' }] })),
    query: (_kind, _input, entity) => { queries.push(entity); return []; }, ports: { observe: () => [6], mayAttack: () => true,
      strike: actor => { strikes.push(actor.entityId); } },
  }, new Map([[7, 6], [8, 10]]));
  const composition = new ScriptComposition({ modules, roles: [numericDriver.role('numeric'), brainDriver.role('brain')],
    schedules: [numericDriver.schedule('numeric', 'numeric'), brainDriver.schedule('brain', 'brain')], maxEntities: 100, limits });
  return { composition, world, brainDriver, queries, strikes };
}
describe('one authoritative host for independent script roles', () => {
  it('installs the module union once and independently schedules 4/6/10-tick bindings under global 60Hz resets', () => {
    const host = createSimHost(level, { rapier });
    try {
      const { composition, world, brainDriver, queries } = create(host);
      let calls = 0;
      for (let tick = 1; tick <= 60; tick++) calls += composition.step(tick).length;
      expect(calls).toBe(15 + 10 + 6); expect(composition.host.currentTick).toBe(60);
      expect(composition.host.checkpoint().modules).toHaveLength(2);
      expect(queries.filter(entity => entity === 7)).toHaveLength(10); expect(queries.filter(entity => entity === 8)).toHaveLength(6);
      expect(world.entity(1)?.fields[1]).toBe(99); expect(world.view('alice').shared['tick']).toBe(60);
      expect(Math.abs(brainDriver.world.entity(7)?.fields[1] ?? Infinity)).toBeLessThanOrEqual(Math.PI);
      expect(() => composition.step(60)).toThrow('tick');
    } finally { host.dispose(); }
  });
  it('shares query and effect ceilings across roles and all due actors', () => {
    const host = createSimHost(level, { rapier });
    try {
      const { composition, brainDriver } = create(host, { queries: 2 });
      const calls = composition.step(30);
      expect(calls.map(call => call.ok)).toEqual([true, false]);
      expect(calls[1]?.reason).toContain('Query allowance'); expect(brainDriver.world.entity(8)?.frozen).toBe(true);
      expect(composition.host.checkpoint().used.queries).toBe(3);
      const bounded = create(host, { effects: 5 });
      expect(bounded.composition.step(12).map(call => call.ok)).toEqual([true, false]);
      expect(bounded.world.entity(1)?.fields[1]).toBe(0);
    } finally { host.dispose(); }
  });
  it('charges one aggregate fuel allowance across numeric and brain calls', () => {
    const host = createSimHost(level, { rapier });
    try {
      const probe = create(host); probe.composition.step(12);
      const used = probe.composition.host.checkpoint().used.fuel;
      const bounded = create(host, { fuelPerTick: used - 1 });
      const calls = bounded.composition.step(12);
      expect(calls[0]?.ok).toBe(true); expect(calls[1]?.ok).toBe(false);
      expect(calls[1]?.reason).toContain('tick fuel'); expect(bounded.world.entity(1)?.fields[1]).toBe(0);
    } finally { host.dispose(); }
  });
  it('retains sleeping events in the host and its snapshot without creating another queue allowance', async () => {
    const host = createSimHost(level, { rapier });
    try {
      const original = create(host, {}, eventBytes, 6);
      for (let value = 0; value < 32; value++) original.composition.enqueue({ type: 1, target: 1, value });
      original.composition.step(1); original.composition.step(2); original.composition.step(3);
      expect(original.composition.host.checkpoint().used.events).toBe(32);
      expect(original.composition.host.checkpoint().pending).toHaveLength(32);
      expect(() => original.composition.enqueue({ type: 1, target: 1, value: 33 })).toThrow('allowance');
      const restored = create(host, {}, eventBytes, 6); restored.composition.restore(original.composition.snapshot());
      for (let tick = 4; tick <= 6; tick++) expect(restored.composition.step(tick)).toEqual(original.composition.step(tick));
      expect(restored.world.entity(1)?.fields[1]).toBe(32); expect(restored.composition.snapshot()).toBe(original.composition.snapshot());
      const emit = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,1);store<f64>(24592,1);', '', '1'));
      const full = create(host, {}, emit, 6);
      for (let value = 0; value < 32; value++) full.composition.enqueue({ type: 1, target: 1, value });
      full.composition.step(1);
      expect(full.composition.host.call('numeric', 1, [1]).reason).toContain('Event allowance');
      expect(full.composition.host.checkpoint().pending).toHaveLength(32);
    } finally { host.dispose(); }
  });
  it('rejects numeric state writes and cross-role events from brain entities atomically', async () => {
    const host = createSimHost(level, { rapier });
    try {
      const illegal = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,1);store<f64>(24592,9);', '', '1'));
      const { composition, world, brainDriver } = create(host, {}, numericBytes, 4, illegal);
      expect(composition.step(6)[0]?.ok).toBe(false); expect(world.view('alice').shared['tick']).toBe(0);
      expect(brainDriver.world.entity(7)?.frozen).toBe(true);
      const event = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,101);store<f64>(24592,7);', '', '1'));
      const cross = create(host, {}, event);
      expect(cross.composition.step(4)[0]?.reason).toContain('Cross-role');
      expect(() => composition.enqueue({ type: 101, target: 7, value: 0 })).toThrow('queued input');
    } finally { host.dispose(); }
  });
  it('bounds direct shared-host outputs against events enqueued after tick start, including retained sleepers', async () => {
    const host = createSimHost(level, { rapier });
    try {
      const emit = await compileScript(scriptSource('store<f64>(24576,1);store<f64>(24584,1);store<f64>(24592,99);store<f64>(24616,3);store<f64>(24624,1);store<f64>(24632,1);', '', '2'));
      for (const sleepers of [0, 20]) {
        const { composition, world } = create(host, {}, emit, 6);
        for (let i = 0; i < sleepers; i++) composition.enqueue({ type: 1, target: 1, value: i });
        composition.step(1);
        expect(composition.host.checkpoint().used.events).toBe(sleepers);
        for (let i = sleepers; i < 31; i++) composition.enqueue({ type: 1, target: 1, value: i });
        expect(composition.host.call('numeric', 1, [1]).ok).toBe(true);
        expect(composition.host.checkpoint().pending).toHaveLength(32);
        const before = composition.host.snapshot('numeric');
        const failed = composition.host.call('numeric', 1, [1]);
        expect(failed.ok).toBe(false); expect(failed.reason).toContain('Event allowance');
        expect(composition.host.checkpoint().pending).toHaveLength(32);
        expect(composition.host.snapshot('numeric')).toEqual(before); expect(world.entity(1)?.fields[1]).toBe(99);
      }
    } finally { host.dispose(); }
  });
  it('enforces aggregate module and memory admission and rejects invalid cadences', () => {
    const host = createSimHost(level, { rapier });
    try {
      expect(() => create(host, { instances: 1 })).toThrow('Instance allowance');
      expect(() => create(host, { memoryBytes: 3 * 2 * 65536 })).toThrow('memory allowance');
      expect(() => create(host, {}, numericBytes, 7)).toThrow('divisor');
    } finally { host.dispose(); }
  });
  it('keeps query self host-derived and consumes brain requests without feeding them back to the guest', async () => {
    const host = createSimHost(level, { rapier });
    try {
      const forged = await compileScript(scriptSource('store<f64>(31000,8);query(410,31000,32000);', '@external("env","query") declare function query(kind:i32,input:i32,output:i32):i32;'));
      const bad = create(host, {}, numericBytes, 4, forged);
      expect(bad.composition.step(6)[0]?.reason).toContain('trusted self');
      const emit = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,101);store<f64>(24592,load<f64>(16384+24));', '', '1'));
      const requests = create(host, {}, numericBytes, 4, emit);
      requests.composition.step(6); expect(requests.strikes).toEqual(['boar:1']);
      expect(requests.composition.host.checkpoint().pending).toHaveLength(1);
      requests.composition.step(7); expect(requests.composition.host.checkpoint().pending).toEqual([]);
      expect(requests.composition.host.checkpoint().used.events).toBe(0);
    } finally { host.dispose(); }
  });
  it('preserves numeric spawning while refusing a handle collision with another trusted role', async () => {
    const host = createSimHost(level, { rapier });
    try {
      const spawn = await compileScript(scriptSource('store<f64>(24576,2);store<f64>(24584,1);', '', '1'));
      const { composition, world, brainDriver } = create(host, {}, spawn, 1);
      for (let tick = 1; tick <= 5; tick++) expect(composition.step(tick)[0]?.ok).toBe(true);
      expect(world.state().map(entity => entity.id)).toEqual([1, 2, 3, 4, 5, 6]);
      const before = brainDriver.snapshot();
      const calls = composition.step(6);
      expect(calls.at(-1)?.reason).toContain('spawn identity');
      expect(world.state()).toHaveLength(6); expect(brainDriver.world.entity(7)?.name).toBe('boar:1');
      const fresh = create(host, {}, spawn, 1); fresh.composition.restore(composition.snapshot());
      expect(fresh.composition.snapshot()).toBe(composition.snapshot());
      expect(before).not.toBe(brainDriver.snapshot());
    } finally { host.dispose(); }
  });
  it('restores one host and both role worlds for an exact 10,000-tick motor/author-state suffix', () => {
    const host = createSimHost(level, { rapier }); let restored: SimHost | undefined;
    const install = (sim: SimHost) => {
      const { composition } = create(sim);
      sim.onStep('scripts.composed', () => { composition.step(sim.state.tick); }, { snapshot: () => composition.snapshot(), restore: saved => {
        if (typeof saved !== 'string') throw new Error('Invalid composed snapshot'); composition.restore(saved);
      } }); return composition;
    };
    try {
      install(host); for (let tick = 0; tick < 97; tick++) host.step();
      restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), sim => { install(sim); });
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
  it('rejects malformed role/host continuations atomically without running inputs or committed callbacks', () => {
    const host = createSimHost(level, { rapier });
    try {
      const { composition } = create(host); composition.step(12); const saved = composition.snapshot();
      const bad = JSON.parse(saved) as { roles: { id: string; state: string }[]; host: { modules: { name: string }[] } };
      const numeric = bad.roles.find(role => role.id === 'numeric'); if (numeric === undefined) throw new Error('Missing role');
      numeric.state = '{}'; expect(() => composition.restore(JSON.stringify(bad))).toThrow(); expect(composition.snapshot()).toBe(saved);
      bad.roles = []; expect(() => composition.restore(JSON.stringify(bad))).toThrow('continuation'); expect(composition.snapshot()).toBe(saved);
    } finally { host.dispose(); }
  });
});
