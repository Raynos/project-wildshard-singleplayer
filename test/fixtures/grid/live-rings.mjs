// oxlint-disable-next-line import/no-nodejs-modules -- Native residency acceptance uses strict assertions, without renderer globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the shipped physics binary and immutable admitted template assets.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import source from '../../../src/shards/_template/shard.config.ts';
import { createShardfileSim, bindShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { createSimHost } from '../../../src/engine/sim.ts';
import { restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../../src/engine/sim/snapshot.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { LiveGridHost } from '../../../src/game/grid/live.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';
import { PageResidency } from '../../../src/game/grid/pageResidency.ts';

const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(new URL(`../../../src/shards/_template/assets/${file.hash}`, import.meta.url))]));
const assembly = new GridAssembly({ developer: false, devserver: false });
const home = assembly.cell('driftwood-isle'), target = assembly.cell('template-2');
const level = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [], weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
const allocator = new ResidencyAllocator(), page = new PageResidency(allocator), homeClaim = page.admitHome(home.instance, 20_000_000);
const pageHost = createSimHost(level, { rapier });
let physics = pageHost.physics, creations = 0, checkpoints = 0, durable = true;
const player = { position: pageHost.player.position, yaw: 0, health: pageHost.player.health, owner: pageHost.player, motor: pageHost.releasePlayerMotor() };
const saves = new Map(), values = [];
const facts = new Set(); let coins = 0;
const quest = { fact: (id) => { facts.add(id); }, coins: (amount) => { coins += amount; } };
const registry = new LiveGridHost(assembly, {
  maxResidents: 2,
  home: { instance: home.instance, physics, bytes: homeClaim.bytes, residency: homeClaim, checkpoint: () => true },
  player, allocator, prefetchable: (cell) => cell.instance === target.instance,
  highway: { bytes: 4096, create: () => { const host = createSimHost({ ...level, ground: { size: 4000, height: 0 } }, { rapier, playerBody: false }); return { host, dispose: () => host.dispose() }; } },
  readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 }, bundle: () => ({ criticalWireBytes: 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 }) },
  gameplayReady: () => true,
  bindFrame: (frame) => { physics = frame.physics; },
  save: (id, snapshot) => { checkpoints++; if (!durable) return false; saves.set(id, serializeSimSnapshot(snapshot)); return true; },
  admit: async (cell) => {
    if (cell.instance !== target.instance) {
      // Even direct prefetch must release cold claims before the product loader begins allocating its next bundle.
      assert.equal(allocator.has(`sim:${target.instance}`), false); assert.equal(allocator.has(`sim-basis:${target.instance}`), false);
      throw new Error('Next product sees retired cold claims');
    }
    return { bytes: source.budgets.sim.resident, reloadsCheckpoint: true, create: async (cached) => {
    // A bounded immutable-basis claim is reserved before its buffer/world allocation and retired with its own scope.
    const basis = allocator.reserve({ id: `sim-basis:${target.instance}`, category: 'sim', bytes: 1_000_000, owner: target.instance, distance: 0, needed: false }); assert.ok(basis);
    let sim = createShardfileSim(source, assets, { rapier, playerBody: false, quest });
    const wire = saves.get(target.instance), saved = cached ?? (wire === undefined ? undefined : decodeSimSnapshot(wire));
    if (saved !== undefined) {
      const authored = sim.host.level; sim.dispose();
      const host = restoreSimHost(authored, { rapier }, saved, (h) => { sim = bindShardfileSim(h, source, assets, { rapier, restoring: true, quest }); });
      host.detachPlayerMotor();
    }
    let immutableBasis = sim.host.physics.world.takeSnapshot(); assert.ok(immutableBasis.byteLength < 1_000_000);
    sim.host.scope.onDispose(() => { immutableBasis = new Uint8Array(); basis.release(); });
    values.push(sim); creations++; return sim;
    } };
  },
});
function step(count) { for (let i = 0; i < count; i++) { physics.step(); registry.afterPlayerStep(); } }
function far() { player.position.set(-900, 0.02, -900); }
function near() { player.position.set(target.origin.x - 260, 0.02, target.origin.z); }
try {
  await registry.prefetch([target.instance]); const first = values[0]; assert.ok(first);
  const outbound = await registry.prepare(home.instance, null); outbound.commit();
  player.position.set(target.origin.x - 255, 0.02, target.origin.z);
  const enter = await registry.prepare(null, target.instance); enter.commit(); step(30);
  const actor = first.host.entities.get('grey-blob:1'); assert.ok(actor); actor.applyFinalDamage(5, new Vector3(), new Vector3());
  first.host.flags.set('ring.visited'); first.colliders.get('template.door').setActive(false);
  assert.equal(registry.checkpoint(target.instance), true);
  const exit = await registry.prepare(target.instance, null); exit.commit(); const frozen = first.host.state.tick;
  far(); durable = false; const beforeRefusal = checkpoints;
  for (let i = 0; i < 60; i++) { registry.beforeFixed(); step(1); }
  assert.equal(checkpoints, beforeRefusal + 1); assert.equal(registry.ready(target.instance), true);
  assert.equal(first.host.scope.disposed, false); assert.equal(first.host.state.tick, frozen);
  assert.equal(allocator.has(`sim:${target.instance}`), true); assert.equal(allocator.has(`sim-basis:${target.instance}`), true);
  const traveler = player.motor; durable = true; registry.retry(target.instance);
  assert.equal(registry.ready(target.instance), true); registry.beforeFixed();
  assert.equal(registry.ready(target.instance), false); assert.equal(first.host.scope.disposed, true);
  assert.equal(allocator.has(`sim:${target.instance}`), false); assert.equal(allocator.has(`sim-basis:${target.instance}`), false);
  assert.equal(registry.state().continuations.entries, 0); assert.equal(player.motor, traveler);
  // An immediate U-turn enters the radial readiness band, loads once and restores the authoritative continuation.
  near(); registry.beforeFixed(); await registry.prefetch([target.instance]); const restored = values[1]; assert.ok(restored);
  assert.equal(creations, 2); assert.equal(restored.host.state.tick, frozen);
  assert.equal(restored.host.entities.get('grey-blob:1').hp, 55);
  assert.equal(restored.host.flags.has('ring.visited'), true); assert.equal(restored.colliders.get('template.door').active(), false);
  // A prepared destination owns a hold; releasing distant regions must not destroy a pending frame transaction.
  const prepared = await registry.prepare(null, target.instance); far(); registry.beforeFixed();
  assert.equal(restored.host.scope.disposed, false); assert.equal(registry.ready(target.instance), true);
  prepared.cancel(); await assert.rejects(registry.prefetch(['template-3']), /Next product sees retired cold claims/);
  assert.equal(restored.host.scope.disposed, true);
  near(); registry.beforeFixed(); await registry.prefetch([target.instance]);
  const returnFrame = await registry.prepare(null, target.instance); returnFrame.commit();
  assert.equal(registry.current(), target.instance); assert.equal(registry.unload(target.instance), false);
  assert.equal(values[2].host.state.tick, frozen); assert.equal(values[2].host.hasPlayerMotor, false);
  assert.equal(coins, 0); assert.equal(facts.size, 0);
  assert.equal(pageHost.physics.world.colliders.len(), 1);
  registry.dispose(); assert.equal(physics, pageHost.physics); assert.equal(pageHost.physics.world.colliders.len(), 2);
  assert.deepEqual(allocator.entries().map((entry) => entry.id), [`sim:${home.instance}`]);
  console.info(JSON.stringify({ durableColdUnload: true, quotaAttempts: 1, frozenTicks: 60, uTurnLoads: creations, hp: 55, doorOpen: true, basisReleased: true, preparedProtected: true, borrowedHomeRetained: true }));
} finally { registry.dispose(); player.motor.dispose(); pageHost.dispose(); page.dispose(); }
assert.deepEqual(allocator.entries(), []);
