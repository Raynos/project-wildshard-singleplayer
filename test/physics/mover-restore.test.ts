import { beforeAll, describe, expect, it } from 'vitest';
import { KinematicMover, type MoverPose } from '../../src/engine/physics/mover';
import { tagOf } from '../../src/engine/physics/surface';
import { createSimHost, type SimHost, type SimValue } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
const level = { ...SIM_LEVEL, entities: [] };
const boxes = [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }];
const road: MoverPose = { position: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true };
function install(host: SimHost) {
  let body = new KinematicMover(host.physics, boxes, road, 'lift'), handle = body.body.handle, calls = 0;
  const remove = host.onStep('lift', () => { calls++; body.setPose({ ...road, position: { x: 0, y: host.state.tick / 60, z: 0 } }); }, {
    snapshot: () => ({ handle }), restore: (saved: SimValue) => {
      if (saved === null || typeof saved !== 'object' || Array.isArray(saved) || typeof saved['handle'] !== 'number') throw new Error('Invalid mover handle');
      handle = saved['handle'];
    }, physicsRestored: () => {
      body = new KinematicMover(host.physics, boxes, road, 'lift', false, handle); body.resetPose(road);
    },
  });
  host.scope.onDispose(() => { remove(); body.dispose(); });
  return { body: () => body, calls: () => calls };
}
describe('restored native mover handles', () => {
  it('reconnects after world and owner restoration, resets the load pose, and allocates no duplicate body', () => {
    const host = createSimHost(level, { rapier }); let fresh: SimHost | undefined;
    try {
      const old = install(host); for (let i = 0; i < 120; i++) host.step();
      expect(old.body().body.translation().y).toBeGreaterThan(1);
      const saved = snapshotSimHost(host), count = host.physics.world.bodies.len();
      let restored: ReturnType<typeof install> | undefined;
      fresh = restoreSimHost(level, { rapier }, saved, sim => { restored = install(sim); });
      expect(restored?.calls()).toBe(0); expect(fresh.state.tick).toBe(120);
      expect(fresh.physics.world.bodies.len()).toBe(count);
      expect(restored?.body().body.handle).toBe(old.body().body.handle);
      expect(restored?.body().body.translation().y).toBe(0);
      expect(tagOf(restored?.body().body.collider(0) ?? old.body().body.collider(0))?.owner).toBe('lift');
      fresh.step(); expect(restored?.calls()).toBe(1);
    } finally { fresh?.dispose(); host.dispose(); }
  });
  it('refuses a wrong owner, shape or missing native handle without allocating', () => {
    const host = createSimHost(level, { rapier });
    try {
      const original = new KinematicMover(host.physics, boxes, road, 'lift'), count = host.physics.world.bodies.len();
      expect(() => new KinematicMover(host.physics, boxes, road, 'other', false, original.body.handle)).toThrow('collider differs');
      expect(() => new KinematicMover(host.physics, boxes.map(box => ({ ...box, hx: 3 })), road, 'lift', false, original.body.handle)).toThrow('collider differs');
      expect(() => new KinematicMover(host.physics, boxes, road, 'lift', false, 999)).toThrow('Missing');
      expect(host.physics.world.bodies.len()).toBe(count); original.dispose();
    } finally { host.dispose(); }
  });
});
