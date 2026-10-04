// oxlint-disable-next-line import/no-nodejs-modules -- Native live-grid witness uses committed immutable assets, without DOM globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the shipped Rapier binary and admitted template payloads.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import source from '../../../src/shards/_template/shard.config.ts';
import { createShardfileSim, bindShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { createSimHost } from '../../../src/engine/sim.ts';
import { restoreSimHost } from '../../../src/engine/sim/snapshot.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { prepareFrameMotors } from '../../../src/engine/physics/frame.ts';
import { generateStrip } from '../../../src/engine/sim/strips.ts';
import { installStripCollider } from '../../../src/engine/physics/stripColliders.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { LiveGridHost } from '../../../src/game/grid/live.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(new URL(`../../../src/shards/_template/assets/${file.hash}`, import.meta.url))]));
const assembly = new GridAssembly({ developer: false, devserver: false }), homeCell = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
const level = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [], weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
const pageHost = createSimHost(level, { rapier }), empty = assembly.emptyNeighbour.edge;
const strip = generateStrip({ id: 'west', axis: 'x', origin: { x: -277.5, z: 0 }, profiles: [empty, empty], adjacent: [target, homeCell] });
installStripCollider(pageHost.physics, strip.mesh, pageHost.scope);
let currentPhysics = pageHost.physics, gameplay = true, frameBinds = 0;
const player = { position: pageHost.player.position, yaw: 0, health: pageHost.player.health, owner: pageHost.player, motor: pageHost.releasePlayerMotor() };
const saves = new Map(), values = new Map();
const facts = new Set(); let coins = 0;
const quest = { fact: (id) => { facts.add(id); }, coins: (amount) => { coins += amount; } };
let physicsSteps = 0;
const registry = new LiveGridHost(assembly, {
  home: { instance: homeCell.instance, physics: pageHost.physics, bytes: 1, checkpoint: () => true }, player, allocator: new ResidencyAllocator(),
  highway: { bytes: strip.mesh.positions.byteLength + strip.mesh.indices.byteLength, create: () => {
    const host = createSimHost({ ...level, ground: { size: 2000, height: 0 } }, { rapier, playerBody: false, ground: false });
    installStripCollider(host.physics, strip.mesh, host.scope); return { host, dispose: () => host.dispose() };
  } },
  readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 }, bundle: () => ({ criticalWireBytes: 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 }) },
  save: (id, snapshot) => { saves.set(id, structuredClone(snapshot)); return true; },
  gameplayReady: () => gameplay,
  bindFrame: ({ physics }) => { currentPhysics = physics; frameBinds++; },
  admit: async () => ({ bytes: source.budgets.sim.resident, create: async (saved) => {
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
});
const step = () => { currentPhysics.step(); physicsSteps++; registry.afterPlayerStep(); };
try {
  await registry.prefetch([target.instance]); const first = values.get(target.instance); assert.ok(first);
  assert.equal(first.host.hasPlayerMotor, false); assert.equal(first.host.state.tick, 0);
  player.position.set(-261, 0.02, 0); assert.equal(registry.target(registry.worldFeet()), null);
  const cancelled = await registry.prepare(homeCell.instance, null); const original = player.motor; cancelled.cancel(); assert.equal(player.motor, original);
  const highway = await registry.prepare(homeCell.instance, null); highway.commit(); assert.equal(registry.current(), null);
  player.position.set(-299, 0.02, 0); const enter = await registry.prepare(null, target.instance); enter.commit();
  assert.equal(registry.worldFeet().x, -299); assert.equal(registry.current(), target.instance);
  gameplay = false; for (let i = 0; i < 60; i++) step(); assert.equal(first.host.state.tick, 0);
  gameplay = true; for (let i = 0; i < 10; i++) step(); assert.equal(first.host.state.tick, 10);
  const actor = first.host.entities.get('grey-blob:1'); assert.ok(actor); actor.applyFinalDamage(5, new Vector3(), new Vector3()); const hp = actor.hp;
  first.colliders.get('template.door').setActive(false); first.host.flags.set('live.visited');
  assert.equal(registry.checkpoint(target.instance), true); const leave = await registry.prepare(target.instance, null); leave.commit();
  const frozen = first.host.state.tick; for (let i = 0; i < 600; i++) step(); assert.equal(first.host.state.tick, frozen);
  assert.equal(registry.unload(target.instance), true); const again = await registry.prepare(null, target.instance); again.commit();
  const restored = values.get(target.instance); assert.ok(restored);
  assert.equal(restored.host.entities.get('grey-blob:1').hp, hp); assert.equal(restored.colliders.get('template.door').active(), false); assert.equal(restored.host.flags.has('live.visited'), true);
  assert.equal(registry.state().crossings, 4); assert.equal(frameBinds, 4); assert.equal(physicsSteps, 670);
  assert.equal(facts.size, 0); assert.equal(coins, 0);
  assert.equal(pageHost.physics.world.colliders.len(), 2); // borrowed home keeps ground + seam, no duplicate player
  registry.dispose(); assert.equal(currentPhysics, pageHost.physics); assert.equal(pageHost.physics.world.colliders.len(), 3);
  console.info(JSON.stringify({ nativeLiveGrid: true, crossings: 4, existingPhysicsSteps: physicsSteps, gameplayHeldTicks: 60, frozenTicks: 600, openedDoor: true, hurtCreature: hp, restored: true, borrowedHomeRetained: true }));
} finally { registry.dispose(); player.motor.dispose(); pageHost.dispose(); }
