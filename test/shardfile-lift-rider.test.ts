// oxlint-disable-next-line import/no-nodejs-modules -- Compile the admitted lift fixture used by both local and native saves.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Immutable fixture module identity.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { liftShard } from './fixtures/socket-lift/shard';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { tagOf } from '../src/engine/physics/surface';
import { createShardfileSim, bindShardfileSim, type ShardfileSimulation } from '../src/game/shardfile/simulation';
import { captureClientState, restoreClientState } from '../src/game/shardfile/clientState';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { captureLiftRider } from '../src/game/shardfile/liftRider';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let bytes = new Uint8Array(), rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  bytes = Uint8Array.from(await compileScript(readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8'), { maximumPages: 2 }));
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});
function fixture() {
  const hash = createHash('sha256').update(bytes).digest('hex'), shard = liftShard(bytes, hash), assets = new Map([[hash, bytes]]);
  return { shard, assets, sim: createShardfileSim(shard, assets, { rapier }) };
}
function board(sim: ShardfileSimulation): void {
  const player = sim.host.player, runtime = sim.movers;
  if (runtime === undefined) throw new Error('Missing lift');
  player.position.set(0, 0.03, 230);
  for (let tick = 0; tick < 10; tick++) player.motor.move(player.position, { x: 0, y: -9.81 / 3600, z: 0 });
  runtime.command('entry.lift', 1); runtime.command('entry.gate', 1);
  for (let tick = 0; tick < 120; tick++) {
    sim.host.step(); const carried = player.motor.carry(player.position);
    player.motor.move(player.position, { x: 0, y: carried ? 0 : -9.81 / 3600, z: 0 });
  }
  expect(player.position.y).toBeGreaterThan(3);
  expect(tagOf(player.motor.result.groundCollider ?? player.motor.collider)?.owner).toBe('entry.lift');
}
describe('saved lift rider resumes at a real safe road stop', () => {
  it('restores native bodies once, resets the lift and puts the rider at boarding without a physics tick', () => {
    const first = fixture(); let next: ShardfileSimulation | undefined;
    try {
      board(first.sim); expect(captureLiftRider(first.shard, first.sim)).toBe('north');
      const saved = snapshotSimHost(first.sim.host), handles = first.sim.movers?.snapshotBodies();
      const restored = restoreSimHost(first.sim.host.level, { rapier }, saved, host => { next = bindShardfileSim(host, first.shard, first.assets, { rapier, restoring: true }); });
      expect(restored.player.position.toArray()).toEqual([0, 0, 230]); expect(restored.state.tick).toBe(120);
      expect(restored.player.motor.collider.translation().y).toBeCloseTo(0.905, 5);
      expect(restored.player.motor.result.grounded).toBe(false);
      expect(restored.player.motor.carry(restored.player.position)).toBe(false);
      expect(next?.movers?.snapshotBodies()).toEqual(handles); expect(next?.movers?.pose('entry.lift').position).toEqual({ x: 0, y: 0, z: 230 });
      expect(next?.movers?.pose('entry.gate').enabled).toBe(false);
      expect(restored.physics.world.bodies.len()).toBe(first.sim.host.physics.world.bodies.len());
    } finally { next?.dispose(); first.sim.dispose(); }
  });
  it('loads logical rider state at the reset deck while rejecting malformed progress atomically', () => {
    const first = fixture(), next = fixture();
    try {
      board(first.sim); const saved = captureClientState(first.shard, first.sim, new Map());
      expect(saved.liftRider).toBe('north');
      const before = captureClientState(next.shard, next.sim, new Map());
      expect(restoreClientState(next.shard, next.sim, new Map(), { ...saved, quests: [{ version: 1, id: 'unknown', started: true, currentId: null }] })).toBe(false);
      expect(captureClientState(next.shard, next.sim, new Map())).toEqual(before);
      expect(restoreClientState(next.shard, next.sim, new Map(), saved)).toBe(true);
      expect(next.sim.host.player.position.toArray()).toEqual([0, 0, 230]); expect(next.sim.host.state.tick).toBe(120);
      for (let tick = 0; tick < 10; tick++) next.sim.host.step();
      expect(next.sim.movers?.pose('entry.lift').position).toEqual({ x: 0, y: 0, z: 230 });
      const live = captureClientState(next.shard, next.sim, new Map());
      expect(restoreClientState(next.shard, next.sim, new Map(), saved)).toBe(false);
      expect(captureClientState(next.shard, next.sim, new Map())).toEqual(live);
    } finally { next.sim.dispose(); first.sim.dispose(); }
  });
  it('uses normal spawn when the real boarding capsule is blocked, despite a valid entry declaration', () => {
    const first = fixture(), next = fixture();
    try {
      board(first.sim); const saved = captureClientState(first.shard, first.sim, new Map());
      next.sim.host.physics.world.createCollider(rapier.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 1, 230).setCollisionGroups(groups('WORLD')));
      expect(restoreClientState(next.shard, next.sim, new Map(), saved)).toBe(true);
      expect(next.sim.host.player.position.toArray()).toEqual([next.shard.spawn.x, next.shard.spawn.y, next.shard.spawn.z]);
      expect(next.sim.movers?.pose('entry.lift').position).toEqual({ x: 0, y: 0, z: 230 });
    } finally { next.sim.dispose(); first.sim.dispose(); }
  });
});
