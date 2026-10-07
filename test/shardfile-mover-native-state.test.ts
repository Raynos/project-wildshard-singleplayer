// oxlint-disable-next-line import/no-nodejs-modules -- Compile the committed admitted mover fixture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the immutable guest module identity.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { createShardfileComposedLane } from '../src/game/shardfile/scriptComposition';
import { parseMovers } from '../src/game/shardfile/movers';
import { MoverScriptDriver } from '../src/game/shardfile/moverDriver';
import { MoverRuntime } from '../src/game/shardfile/moverRuntime';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let bytes: Uint8Array = new Uint8Array(), rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  bytes = await compileScript(readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8'), { maximumPages: 2 });
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});
const level = { ...SIM_LEVEL, entities: [] };
function install(host: SimHost, restoring = false) {
  const module = createHash('sha256').update(bytes).digest('hex'), resetIds = new Set(['deck', 'gate']);
  const data = parseMovers(['deck', 'gate'].map((id, index) => ({ id, entity: 1001 + index, module, kind: 'platform', at: { x: 0, y: index, z: 0 },
    euler: { x: 0, y: 0, z: 0 }, enabled: index === 0, boxes: [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }],
    input: index === 0 ? [0, 0, 0, 0, 5, 0, 10, 0] : [0, 1, 0, 0, 1, 0, 10, 1],
  })));
  const driver = new MoverScriptDriver(data, () => [], [...resetIds]);
  const installedRuntime: { current?: MoverRuntime } = {};
  const lane = createShardfileComposedLane({ identity: { seed: 1 }, sim: { scripts: [module], scriptTickDivisor: 1, bindings: [] }, state: { shared: [], player: [] } },
    new Map([[module, bytes]]), { rules: { fields: {}, archetypes: [], events: [], maxEntities: 2 }, entities: [], actors: new Map(), query: () => [] }, undefined,
    { roles: [driver.role()], schedules: [driver.schedule(() => { const current = installedRuntime.current; if (current === undefined) throw new Error('Missing mover runtime'); return current; })], transientModules: driver.transientModules });
  const runtime = new MoverRuntime(data, { host: lane.host, physics: () => host.physics, scope: host.scope, restoring });
  installedRuntime.current = runtime;
  const installed = runtime;
  host.onStep('movers', () => { lane.step(host.state.tick); }, { snapshot: () => installed.snapshotState(resetIds), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid mover state'); installed.restoreState(value);
  }, physicsRestored: () => { installed.reconnect(resetIds); } });
  host.onStep('script', () => undefined, { snapshot: () => lane.snapshot(), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid script state'); lane.restore(value);
  } });
  return { runtime, lane };
}
describe('native and logical lift reset share saved body handles', () => {
  it('restores a travelling deck at road with the same two bodies and clears queued lift commands', () => {
    const host = createSimHost(level, { rapier }); let fresh: SimHost | undefined;
    try {
      const original = install(host); original.runtime.command('deck', 1); original.runtime.command('gate', 1);
      for (let i = 0; i < 120; i++) host.step();
      expect(original.runtime.pose('deck').position.y).toBeGreaterThan(0);
      original.runtime.command('deck', 3);
      const saved = snapshotSimHost(host), handles = original.runtime.snapshotBodies(), count = host.physics.world.bodies.len();
      let restored: ReturnType<typeof install> | undefined;
      fresh = restoreSimHost(level, { rapier }, saved, sim => { restored = install(sim, true); expect(sim.physics.world.bodies.len()).toBe(0); });
      expect(restored?.runtime.snapshotBodies()).toEqual(handles); expect(fresh.physics.world.bodies.len()).toBe(count);
      expect(restored?.runtime.pose('deck').position.y).toBe(0); expect(restored?.runtime.snapshot()).toEqual([]);
      const deck = handles.find(row => row.id === 'deck'); if (deck === undefined) throw new Error('Missing deck handle');
      expect(fresh.physics.world.getRigidBody(deck.handle).translation().y).toBe(0);
      for (let i = 0; i < 120; i++) fresh.step();
      expect(restored?.runtime.pose('deck').position.y).toBe(0); expect(restored?.lane.host.currentTick).toBe(240);
      expect(fresh.physics.world.bodies.len()).toBe(count);
    } finally { fresh?.dispose(); host.dispose(); }
  });
  it('refuses malformed command/handle continuations atomically', () => {
    const host = createSimHost(level, { rapier });
    try {
      const { runtime } = install(host), before = runtime.snapshotState();
      expect(() => runtime.restoreState(JSON.stringify({ pending: [['deck', 1]], bodies: [] }))).toThrow('native continuation');
      expect(runtime.snapshotState()).toBe(before);
      const bodies = runtime.snapshotBodies();
      expect(() => runtime.restoreState(JSON.stringify({ pending: [['unknown', 1]], bodies }))).toThrow('commands');
      expect(runtime.snapshotState()).toBe(before);
    } finally { host.dispose(); }
  });
});
