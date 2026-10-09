// oxlint-disable-next-line import/no-nodejs-modules -- Native live-grid witness uses committed immutable assets, without DOM globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the shipped Rapier binary and admitted template payloads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise both the default memory path and the production durable-only path.
import { argv } from 'node:process';
import { Vector3 } from 'three';
import source from '../../../src/shards/_template/shard.config.ts';
import { createShardfileSim, bindShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { createSimHost } from '../../../src/engine/sim.ts';
import { restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../../src/engine/sim/snapshot.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { prepareFrameMotors } from '../../../src/engine/physics/frame.ts';
import { generateStrip } from '../../../src/engine/sim/strips.ts';
import { installStripCollider } from '../../../src/engine/physics/stripColliders.ts';
import { CONTENT_CAPS } from '../../../src/engine/core/config.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { TEMPLATE_WEST_GRID } from './templateWest.ts';
import { LiveGridHost } from '../../../src/game/grid/live.ts';
import { GRID_CONTINUATION_CACHE_BYTES } from '../../../src/game/grid/continuations.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';
import { PageResidency } from '../../../src/game/grid/pageResidency.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
const durableOnly = argv.includes('--durable'), nativeBytes = argv.includes('--bytes');
const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(new URL(`../../../src/shards/_template/assets/${file.hash}`, import.meta.url))]));
const assembly = new GridAssembly({ developer: false, devserver: false }, TEMPLATE_WEST_GRID), homeCell = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
const level = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [], weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
const empty = assembly.emptyNeighbour.edge;
const strip = generateStrip({ id: 'west', axis: 'x', origin: { x: -277.5, z: 0 }, profiles: [empty, empty], adjacent: [target, homeCell] });
const highwayBytes = strip.mesh.positions.byteLength + strip.mesh.indices.byteLength;
// Keep the original one-region admission envelope, plus its newly charged fixed packed continuation pool.
const homeBytes = 20_000_000;
const allocator = new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil(((durableOnly ? 0 : GRID_CONTINUATION_CACHE_BYTES) + homeBytes + highwayBytes + source.budgets.sim.resident) * CONTENT_CAPS.residentFactor) });
const pageResidency = new PageResidency(allocator), homeClaim = pageResidency.admitHome(homeCell.instance, homeBytes);
// The early owner reserves before even the borrowed page's world is allocated.
const pageHost = createSimHost(level, { rapier });
const blocker = allocator.reserve({ id: 'library:held', category: 'library', bytes: source.budgets.sim.resident, owner: 'platform', distance: 0, needed: true }); assert.ok(blocker);
installStripCollider(pageHost.physics, strip.mesh, pageHost.scope);
let currentPhysics = pageHost.physics, gameplay = true, frameBinds = 0;
const player = { position: pageHost.player.position, yaw: 0, health: pageHost.player.health, owner: pageHost.player, motor: pageHost.releasePlayerMotor() };
const saves = new Map(), values = new Map(); let durable = true;
const facts = new Set(); let coins = 0;
const quest = { fact: (id) => { facts.add(id); }, coins: (amount) => { coins += amount; } };
let physicsSteps = 0, regionCreations = 0, factoryCanReload = durableOnly;
const ports = {
  continuations: durableOnly ? 'durable' : 'memory',
  maxResidents: 2,
  home: { instance: homeCell.instance, physics: pageHost.physics, bytes: homeBytes, residency: homeClaim, checkpoint: () => true }, player, allocator,
  highway: { bytes: highwayBytes, create: () => {
    const host = createSimHost({ ...level, ground: { size: 2000, height: 0 } }, { rapier, playerBody: false, ground: false });
    installStripCollider(host.physics, strip.mesh, host.scope); return { host, dispose: () => host.dispose() };
  } },
  readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 }, bundle: () => ({ criticalWireBytes: 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 }) },
  save: (id, snapshot) => { if (!durable) return false; const packed = serializeSimSnapshot(snapshot); assert.deepEqual(decodeSimSnapshot(packed), snapshot); saves.set(id, packed); return true; },
  ...(nativeBytes ? { saveBytesSteps: function* (id, snapshot) {
    assert.ok(snapshot.physics instanceof Uint8Array);
    const wire = serializeSimSnapshot(snapshot);
    assert.equal(wire, serializeSimSnapshot({ ...snapshot, physics: Array.from(snapshot.physics) }));
    yield;
    if (!durable) return false;
    saves.set(id, wire); return true;
  } } : {}),
  gameplayReady: () => gameplay,
  bindFrame: ({ physics, host, instance }) => { assert.equal(host === undefined, instance === homeCell.instance); if (host !== undefined) assert.equal(host.physics, physics); currentPhysics = physics; frameBinds++; },
  admit: async () => ({ bytes: source.budgets.sim.resident, reloadsCheckpoint: factoryCanReload, create: async (input) => {
    regionCreations++;
    const wire = saves.get(target.instance), saved = input ?? (durableOnly && wire !== undefined ? decodeSimSnapshot(wire) : undefined);
    let sim = createShardfileSim(source, assets, { rapier, playerBody: false, quest });
    if (saved !== undefined) {
      const authored = sim.host.level; sim.dispose();
      const host = restoreSimHost(authored, { rapier }, saved, (h) => { sim = bindShardfileSim(h, source, assets, { rapier, restoring: true, quest }); });
      host.detachPlayerMotor();
    } else {
      const duplicate = strip.duplicates.find((row) => row.instance === target.instance); assert.ok(duplicate);
      installStripCollider(sim.host.physics, duplicate.mesh, sim.host.scope);
    }
    values.set(target.instance, sim); return sim;
  } }),
};
for (const mismatch of [
  { ...ports, home: { ...ports.home, bytes: homeBytes + 1 } },
  { ...ports, home: { ...ports.home, instance: target.instance } },
  { ...ports, allocator: new ResidencyAllocator() },
]) {
  assert.throws(() => new LiveGridHost(assembly, mismatch), /differs from its admitted page claim/);
  assert.equal(mismatch.allocator.has(`sim-continuations:live:${mismatch.home.instance}`), false);
}
assert.equal(allocator.entries().find((entry) => entry.id === `sim:${homeCell.instance}`).refs, 1);
const registry = new LiveGridHost(assembly, ports);
const step = () => { currentPhysics.step(); physicsSteps++; registry.afterPlayerStep(); };
try {
  assert.equal(allocator.entries().find((entry) => entry.id === `sim:${homeCell.instance}`).refs, 2);
  assert.equal(allocator.entries().find((entry) => entry.id === `sim:${homeCell.instance}`).bytes, homeBytes);
  if (durableOnly) assert.equal(allocator.has(`sim-continuations:live:${homeCell.instance}`), false);
  else assert.equal(allocator.entries().find((entry) => entry.id === `sim-continuations:live:${homeCell.instance}`).bytes, GRID_CONTINUATION_CACHE_BYTES);
  const homeMotor = player.motor;
  if (durableOnly) {
    factoryCanReload = false;
    await assert.rejects(registry.prefetch([target.instance]), /checkpoint reader before allocation/);
    assert.equal(regionCreations, 0); assert.equal(player.motor, homeMotor);
    factoryCanReload = true; registry.retry(target.instance);
  }
  await assert.rejects(registry.prefetch([target.instance]), /deferred by the shared budget/);
  assert.equal(regionCreations, 0); assert.equal(player.motor, homeMotor); assert.equal(registry.ready(target.instance), false);
  assert.equal(pageHost.physics.world.colliders.len(), 3); blocker.release(); registry.retry(target.instance);
  player.position.x = -249;
  for (let frame = 0; frame < 100; frame++) registry.beforeFixed();
  assert.deepEqual(registry.state().pending, [target.instance]);
  await registry.prefetch([target.instance]); const first = values.get(target.instance); assert.ok(first);
  for (let frame = 0; frame < 100; frame++) registry.beforeFixed();
  assert.deepEqual(registry.state().pending, []); assert.equal(regionCreations, 1);
  assert.equal(first.host.hasPlayerMotor, false); assert.equal(first.host.state.tick, 0);
  player.position.set(-261, 0.02, 0); assert.equal(registry.target(registry.worldFeet()), null);
  const cancelled = await registry.prepare(homeCell.instance, null); const original = player.motor; cancelled.cancel(); assert.equal(player.motor, original);
  const highway = await registry.prepare(homeCell.instance, null); highway.commit(); assert.equal(registry.current(), null);
  player.position.set(-299, 0.02, 0); const enter = await registry.prepare(null, target.instance); enter.commit();
  assert.equal(registry.worldFeet().x, -299); assert.equal(registry.current(), target.instance);
  await assert.rejects(registry.prefetch(['template-2']), /No durable frozen live region/);
  assert.equal(regionCreations, 1); assert.equal(registry.ready('template-2'), false);
  gameplay = false; for (let i = 0; i < 60; i++) step(); assert.equal(first.host.state.tick, 0);
  gameplay = true; for (let i = 0; i < 10; i++) step(); assert.equal(first.host.state.tick, 10);
  const actor = first.host.entities.get('grey-blob:1'); assert.ok(actor); actor.applyFinalDamage(5, new Vector3(), new Vector3()); const hp = actor.hp;
  first.colliders.get('template.door').setActive(false); first.host.flags.set('live.visited');
  durable = false; const beforeCheckpoint = player.motor;
  assert.equal(registry.checkpoint(target.instance), false); assert.equal(player.motor, beforeCheckpoint);
  assert.equal(first.host.hasPlayerMotor, false); assert.equal(saves.size, 0); durable = true;
  assert.equal(registry.checkpoint(target.instance), true); const leave = await registry.prepare(target.instance, null); leave.commit();
  if (durableOnly) assert.deepEqual(registry.state().continuations, { entries: 0, storedChars: 0, capacityChars: 0, claimedBytes: 0 });
  const frozen = first.host.state.tick; for (let i = 0; i < 600; i++) step(); assert.equal(first.host.state.tick, frozen);
  if (!durableOnly) { durable = false; assert.equal(registry.unload(target.instance), false); assert.equal(registry.ready(target.instance), true); }
  assert.equal(first.host.state.tick, frozen); durable = true;
  assert.equal(registry.unload(target.instance), true); const again = await registry.prepare(null, target.instance); again.commit();
  const restored = values.get(target.instance); assert.ok(restored);
  assert.equal(restored.host.entities.get('grey-blob:1').hp, hp); assert.equal(restored.colliders.get('template.door').active(), false); assert.equal(restored.host.flags.has('live.visited'), true);
  assert.equal(registry.state().crossings, 4); assert.equal(frameBinds, 4); assert.equal(physicsSteps, 670);
  assert.equal(facts.size, 0); assert.equal(coins, 0);
  assert.equal(pageHost.physics.world.colliders.len(), 2); // borrowed home keeps ground + seam, no duplicate player
  registry.dispose(); assert.equal(currentPhysics, pageHost.physics); assert.equal(pageHost.physics.world.colliders.len(), 3);
  assert.equal(allocator.entries().length, 1);
  assert.equal(allocator.entries()[0].id, `sim:${homeCell.instance}`);
  assert.equal(allocator.entries()[0].refs, 1);
  // The page's world and early claim remain live after registry teardown, until the page itself disposes.
  assert.equal(allocator.entries()[0].bytes, homeBytes);
  console.info(JSON.stringify({ nativeLiveGrid: true, quotaDeferred: true, crossings: 4, existingPhysicsSteps: physicsSteps, gameplayHeldTicks: 60, frozenTicks: 600, openedDoor: true, hurtCreature: hp, restored: true, borrowedHomeRetained: true, ...(durableOnly ? { durableOnly: true, retainedChars: registry.state().continuations.storedChars, ...(nativeBytes ? { nativeBytes: true } : {}) } : {}) }));
} finally { blocker.release(); registry.dispose(); player.motor.dispose(); pageHost.dispose(); pageResidency.dispose(); }
assert.deepEqual(allocator.entries(), []);
