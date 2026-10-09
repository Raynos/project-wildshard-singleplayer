import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compile the committed guest and load the engine physics fixture.
import { readFile } from 'node:fs/promises';
import { createShardfileComposedLane } from '../src/game/shardfile/scriptComposition';
import { logicalStateFromLane } from '../src/game/shardfile/logicalState';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { installScriptLane } from '../src/engine/script/lane';
import { loadRapier } from '../src/engine/physics/rapier';
import { parseScriptBrain } from '../src/game/shardfile/brains';
import type { ShardScriptPorts } from '../src/game/shardfile/scripts';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

const numericModule = 'a'.repeat(64), brainModule = 'b'.repeat(64);
const content = { identity: { seed: 357 }, sim: { scripts: [numericModule, brainModule], scriptTickDivisor: 4,
  bindings: [{ module: numericModule, entity: 1, actorId: 'boar:1', kind: 'entity' as const }] },
  state: { shared: [{ id: 101, name: 'tick', type: 'i32' as const, privacy: 'public' as const, default: 0, min: 0, max: 100000 }], player: [] } };
const brain = parseScriptBrain({ id: 'fixture.custom', kind: 'script', module: brainModule, thinkDivisor: 6,
  maxSpeed: 3, maxStrafe: 1, maxTurnRate: 6, parameters: [2], strikes: [{ event: 101, strike: 'boar.charge' }] });
let assets: ReadonlyMap<string, Uint8Array>, rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  const numeric = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,load<f64>(16384));', '', '1'));
  const policy = await compileScript(await readFile('test/fixtures/sim-level/brain.as', 'utf8'), { maximumPages: 2 });
  assets = new Map([[numericModule, numeric], [brainModule, policy]]);
  const binary = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(binary).buffer);
});
function create(host: SimHost, extra: Partial<ShardScriptPorts> = {}, entity = 7) {
  return createShardfileComposedLane(content, assets, { rules: { fields: {}, archetypes: [], events: [1], maxEntities: 10 },
    entities: [{ id: 1, name: 'boar:1', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }],
    actors: new Map([[1, 'boar:1']]), query: () => [], ...extra,
  }, { actors: host.entities, bindings: [{ entity, actorId: 'boar:1', brain }], query: () => [],
    ports: { observe: () => [6], mayAttack: () => true, strike: () => undefined } });
}
describe('game numeric and custom brain composition', () => {
  it('uses one module union with a numeric facade, distinct motion fields and independent cadences', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      const lane = create(host); let calls = 0;
      for (let tick = 1; tick <= 60; tick++) calls += lane.step(tick).length;
      expect(calls).toBe(25); expect(lane.host.checkpoint().modules).toHaveLength(2);
      expect(lane.world.view('boar:1').shared['tick']).toBe(60);
      expect(host.entities.get('boar:1')?.desiredSpeed).toBe(2);
      expect(logicalStateFromLane(1, lane.snapshot()).shared).toEqual([{ id: 101, name: 'tick', type: 'i32', value: 60 }]);
      expect(() => lane.enqueue({ type: 101, target: 7, value: 0 })).toThrow('queued input');
      expect(lane.host.currentTick).toBe(60);
    } finally { host.dispose(); }
  });
  it('refuses role collisions and respects aggregate admission and execution limits', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      expect(() => create(host, {}, 1)).toThrow('Overlapping');
      expect(() => create(host, { limits: { instances: 1 } })).toThrow('Instance allowance');
      expect(() => create(host, { rules: { fields: {}, archetypes: [], events: [], maxEntities: 1 } })).toThrow('Aggregate');
      const lane = create(host, { limits: { effects: 4 } });
      expect(lane.step(12).map(call => call.ok)).toEqual([true, false]);
      expect(lane.world.view('boar:1').shared['tick']).toBe(0);
      expect(() => createShardfileComposedLane({ ...content, sim: { ...content.sim, scripts: [numericModule] } }, assets,
        { rules: { fields: {}, archetypes: [], events: [], maxEntities: 10 }, entities: [], actors: new Map(), query: () => [] },
        { actors: host.entities, bindings: [{ entity: 7, actorId: 'boar:1', brain }], query: () => [],
          ports: { observe: () => [], mayAttack: () => false, strike: () => undefined } })).toThrow('Brain module');
    } finally { host.dispose(); }
  });
  it('restores the facade and both roles for an exact 10,000-tick real-motor suffix', () => {
    const host = createSimHost(SIM_LEVEL, { rapier }); let fresh: SimHost | undefined;
    const install = (sim: SimHost) => { const lane = create(sim); installScriptLane(sim, 'script.declared', lane); return lane; };
    try {
      const original = install(host);
      for (let tick = 0; tick < 97; tick++) host.step();
      fresh = restoreSimHost(SIM_LEVEL, { rapier }, snapshotSimHost(host), sim => { install(sim); });
      for (let tick = 0; tick < 10000; tick++) { host.step(); fresh.step(); }
      expectSameSimSnapshot(snapshotSimHost(fresh), snapshotSimHost(host));
      const before = original.snapshot();
      expect(() => original.restore(before.replace('"id":"numeric"', '"id":"forged"'))).toThrow();
      expect(original.snapshot()).toBe(before);
    } finally { host.dispose(); fresh?.dispose(); }
  });
});
