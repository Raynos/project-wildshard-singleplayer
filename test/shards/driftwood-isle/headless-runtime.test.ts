// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { Rng } from '../../../src/engine/core/rng';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_ISLE, PRACTICE_CRAB } from '../../../src/shards/driftwood-isle/manifest';
import { MONKEY } from '../../../src/shards/driftwood-isle/species/monkey';
import { MONKEY_VARIANTS } from '../../../src/shards/driftwood-isle/species/monkeyVariants';
import { driftwoodBake } from '../../../src/shards/driftwood-isle/runtime/baked';
import { DRIFTWOOD_FIGHT, FAUNA_DRAWS, ISLAND_STEP } from '../../../src/shards/driftwood-isle/runtime/keeper';
import { DRIFTWOOD_FAUNA_TUNING, faunaPlacement } from '../../../src/shards/driftwood-isle/runtime/fauna';
import { LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { prepareHeadlessRuntime } from '../../../src/shards/driftwood-isle/runtime/headless';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
const effects = { commands: () => [], emit: () => { throw new Error('the island keeper emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const bake = driftwoodBake();
/** The player's tape: off the pier landing up the path past the practice crab, then away north and back. */
const route = [new Vector3(-7, 0, -150), new Vector3(-7, 0, -120), new Vector3(-20, 0, -90), new Vector3(-7, 0, -100)];
function step(host: SimHost): void {
  const tick = host.state.tick, goal = route[Math.min(route.length - 1, Math.floor(tick / 900))] ?? new Vector3(), p = host.player.position;
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  host.step(d < 1.5 ? { moveX: Math.sin(tick / 40), moveZ: Math.cos(tick / 40), yaw: 0 } : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.kill' }); // a direct test blow: no sword is owned yet
}

it('holds the renderer-free spellings equal to the browser\'s (monkey variants, sea level, spawn)', () => {
  expect(MONKEY_VARIANTS).toBe(MONKEY.variants);
  expect(LOWERED_SEA).toBe(DRIFTWOOD_ISLE.ground.terrain?.waterLevel());
  expect(DRIFTWOOD_FIGHT.attackers).toBe(DRIFTWOOD_ISLE.fight?.attackers); expect(DRIFTWOOD_FIGHT.telegraphed).toBe(DRIFTWOOD_ISLE.fight?.telegraphed);
  expect(plan.level.seed).toBe(0x5ea1); expect(plan.level.player.at).toEqual({ x: 0, y: 1.2, z: -194 }); expect(plan.level.player.yaw).toBe(Math.PI);
  expect(plan.proveEntries).toBeUndefined(); // finish stays refused until the entry proof is real
});

it('spawns the 34 load-time bodies in the manager\'s order, reproducing every baked kind, variant, herd, seed, scale and point', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(bake.actors.map(actor => actor.id));
    const fauna = bake.actors.filter(a => a.kind === 'boar' || a.kind === 'bear'), stream = faunaPlacement(0x5ea1, fauna);
    for (const actor of bake.actors) {
      const live = host.entities.get(actor.id); if (live === undefined || actor.at === null) throw new Error(`missing ${actor.id}`);
      expect([actor.id, live.kind, live.variant, live.seed, live.scale]).toEqual([actor.id, actor.kind, actor.variant, actor.seed, actor.scale]);
      // a fauna body stands where its anchor search drew it, at its drawn yaw (runtime/fauna.ts)
      const at = stream.spawns.get(actor.id) ?? actor.at;
      expect(live.position.x).toBeCloseTo(at.x, 9); expect(live.position.z).toBeCloseTo(at.z, 9);
      if (stream.spawns.has(actor.id)) expect(live.yaw).toBeCloseTo(stream.spawns.get(actor.id)?.yaw ?? Number.NaN, 9);
    }
    // the bake's `at` is each body's memory goal when the page was captured: every fauna body that had not yet thought stood
    // on its drawn spawn exactly; the first boar had already picked its first wander goal
    const moved = fauna.filter(a => { const s = stream.spawns.get(a.id); return s === undefined || a.at === null || Math.hypot(s.x - a.at.x, s.z - a.at.z) > 1e-9; });
    expect(moved.map(a => a.id)).toEqual(['creature:0']);
    expect(stream.draws).toBe(FAUNA_DRAWS);
    // the herd centres are the anchors' draws: the first members' spawns sit round them (the brain's placement ring, 1.5–9 m)
    stream.centres.forEach(([cx, cz], herd) => { for (const a of fauna.filter(f => f.herd === herd)) { const s = stream.spawns.get(a.id); expect(s === undefined ? -1 : Math.hypot(s.x - cx, s.z - cz)).toBeGreaterThanOrEqual(1.5); } });
    expect(DRIFTWOOD_FAUNA_TUNING).toEqual(DRIFTWOOD_ISLE.faunaTuning);
    // the fauna's baked seeds all come from the creature stream's first 148 draws (their anchor searches)
    const rng = new Rng(0x5ea1 + 31), head: number[] = []; for (let i = 0; i < FAUNA_DRAWS; i++) head.push(rng.next());
    for (const actor of bake.actors.filter(a => a.kind === 'boar' || a.kind === 'bear')) expect(head).toContain(actor.seed);
    // every body stands on the island above the sea, the sailor on the sunk hold's own floor (the wreck's deck, not the sand)
    for (const actor of host.entities.values()) if (actor.kind !== 'sailor') expect(actor.position.y).toBeGreaterThan(LOWERED_SEA);
    const sailor = [...host.entities.values()].find(a => a.kind === 'sailor');
    if (sailor === undefined) throw new Error('no sailor');
    // the hold's midships deck is broken open where he rises (Enemies.placeSailor): the creature floor is the sand under the hull
    expect(sailor.levelGround).toBe(false); expect(sailor.position.y).toBeCloseTo(bake.floorAt(sailor.position.x, sailor.position.z), 6);
  } finally { host.dispose(); }
});

it('stands the player on the baked floor and the pier: 10k ticks of walking stay finite and on the island', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 10_000; tick++) step(host);
    expect(host.state.tick).toBe(10_000);
    const p = host.player.position;
    expect(p.y).toBeGreaterThan(bake.floorAt(p.x, p.z) - 0.2); expect(Math.hypot(p.x, p.z + 194)).toBeGreaterThan(60); // off the pier, up the path
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
  } finally { host.dispose(); }
}, 60_000);

it('brings the practice crab back 45 s after it dies once the player is 30 m off, after its shell fades, as a fresh body', () => {
  const host = boot();
  try {
    const slot = bake.habitat.practice, before = host.entities.get(slot)?.seed;
    kill(host, slot);
    host.player.position.set(PRACTICE_CRAB.x, 2, PRACTICE_CRAB.z + 10); // near: it never comes back
    for (let tick = 0; tick < 60 * 50; tick++) host.step();
    expect(host.entities.get(slot)?.alive).toBe(false);
    host.player.motor.resetAt(new Vector3(-7, 3, -100)); host.player.position.set(-7, 3, -100);
    for (let tick = 0; tick < 60 * 2; tick++) host.step();
    // a fresh body under the manager's next entity id (EntityIds: the load-time roster took creature:0–33)
    expect(host.entities.has(slot)).toBe(false);
    const fresh = host.entities.get('creature:34');
    expect(fresh?.alive).toBe(true); expect(fresh?.kind).toBe('crab'); expect(fresh?.variant).toBe('small'); expect(fresh?.seed).not.toBe(before);
    expect(fresh?.position.x).toBeCloseTo(PRACTICE_CRAB.x, 1); expect(fresh?.position.z).toBeCloseTo(PRACTICE_CRAB.z, 1);
  } finally { host.dispose(); }
});

it('runs the enemies\' shipping policies: the crabs close in and snap, a strike lands on the player within the attack tokens', () => {
  const host = boot(), crab = host.entities.get('creature:13'), states = new Set<string>();
  if (crab === undefined) throw new Error('missing big crab');
  let lowest = host.player.health.attributes.health, attacking = 0;
  try {
    const at = new Vector3(crab.position.x + 4, bake.floorAt(crab.position.x + 4, crab.position.z) + 0.5, crab.position.z);
    host.player.motor.resetAt(at); host.player.position.copy(at);
    for (let tick = 0; tick < 1800; tick++) {
      host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      for (const actor of host.entities.values()) if (actor.kind === 'crab') states.add(String(actor.mem['st']));
      attacking = Math.max(attacking, [...host.entities.values()].filter(a => a.alive && a.attackPhase >= 0).length);
      lowest = Math.min(lowest, host.player.health.attributes.health);
    }
    expect(states).toContain('1'); expect(states).toContain('2'); // engaged (sidestepping), then attacking
    expect(lowest).toBeLessThan(host.player.health.attributes.maxHealth);
    expect(attacking).toBeGreaterThan(0); expect(attacking).toBeLessThanOrEqual(2);
  } finally { host.dispose(); }
});

it('runs the fauna through the hunting brain: wander paths on the baked navmesh, a sounder that notices, a charge that lands, a hit that wakes', () => {
  const host = boot();
  try {
    const blows: string[] = [];
    host.events.on('damage.dealt', ({ req }) => { if (req.target === host.player.health) blows.push(req.sourceTags.join(' ')); }, host.scope);
    const boars = [...host.entities.values()].filter(a => a.kind === 'boar'), start = boars.map(a => a.position.clone());
    // 20 s standing on the pier: the sounders graze and wander (paths from the navmesh), nobody notices the far player
    for (let tick = 0; tick < 1200; tick++) host.step();
    expect(boars.some((a, i) => a.position.distanceTo(start[i] ?? a.position) > 1)).toBe(true);
    expect(boars.every(a => a.state !== 'charge')).toBe(true);
    // the keeper's continuation carries every fauna memory; some follow navmesh path corners
    const keeper = v.parse(v.object({ fauna: v.object({ memories: v.array(v.nullable(v.object({ path: v.array(v.unknown()) }))) }) }),
      snapshotSimHost(host).adapters.find(adapter => adapter.id === ISLAND_STEP)?.state);
    expect(keeper.fauna.memories.filter(m => m !== null)).toHaveLength(13);
    expect(keeper.fauna.memories.some(m => m !== null && m.path.length > 1)).toBe(true);
    // walk at the first sounder's centre: it notices, stalks and charges; a charge lands as a creature blow
    const goal = new Vector3(74.7, 0, -141.9);
    for (let tick = 0; tick < 3600 && !blows.some(b => b.includes('creature.boar')); tick++) {
      const p = host.player.position, dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
      host.step(d < 2 ? undefined : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz) });
    }
    expect(blows.some(b => b.includes('creature.boar') && b.includes('feel.blow'))).toBe(true);
    // a blow that doesn't kill: the hunting brain's hit reaction, at once
    const near = boars.filter(a => a.alive).sort((a, b) => a.position.distanceTo(host.player.position) - b.position.distanceTo(host.player.position))[0];
    if (near === undefined) throw new Error('no boar left');
    host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: near.combatActor(), amount: 1, point: near.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.poke' });
    expect(near.alive).toBe(true); expect(near.lastHitT).toBeGreaterThan(-Infinity);
    // mid-hunt, the continuation is exact: memories, paths, the speed meter, sight and the hunting brain's clock
    const restored = restore(serializeSimSnapshot(snapshotSimHost(host)));
    try {
      const away = (h: SimHost): void => { const p = h.player.position; h.step({ moveX: -p.x / Math.hypot(p.x, p.z), moveZ: -p.z / Math.hypot(p.x, p.z), yaw: 0 }); };
      for (let tick = 0; tick < 900; tick++) { away(host); away(restored); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { restored.dispose(); }
  } finally { host.dispose(); }
}, 90_000);

it('releases a real coconut on a monkey\'s throw: it flies in the host\'s world, strikes the player, lands, and restores mid-flight exactly', () => {
  const dynamic = (host: SimHost): number => { let n = 0; host.physics.world.forEachRigidBody(b => { if (b.isDynamic()) n++; }); return n; };
  const original = boot(); let restored: SimHost | undefined;
  try {
    // 7 m off the first troop's monkey (creature:22, the grove at 105, 108)
    const m = original.entities.get('creature:22'); if (m === undefined) throw new Error('missing monkey');
    const at = new Vector3(m.position.x + 7, 0, m.position.z); at.y = bake.floorAt(at.x, at.z) + 0.3;
    original.player.motor.resetAt(at); original.player.position.copy(at);
    let hits = 0, most = 0, flying = -1;
    original.events.on('damage.dealt', ({ req }) => { if (req.moveId === 'strike.monkey.coconut' && req.amount === 8) hits++; }, original.scope);
    for (let tick = 0; tick < 2400 && flying < 0; tick++) { original.step({ moveX: 0, moveZ: 0, yaw: 0 }); if (dynamic(original) > 0) flying = original.state.tick; }
    expect(flying).toBeGreaterThan(0);
    for (let tick = 0; tick < 5; tick++) original.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(dynamic(original)).toBeGreaterThan(0);
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 1500; tick++) {
      original.step({ moveX: 0, moveZ: 0, yaw: 0 }); restored.step({ moveX: 0, moveZ: 0, yaw: 0 });
      most = Math.max(most, dynamic(original));
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(hits).toBeGreaterThan(0); expect(most).toBeGreaterThan(1); expect(most).toBeLessThanOrEqual(16);
  } finally { restored?.dispose(); original.dispose(); }
}, 90_000);

/** the restore test's tape up to a checkpoint: walk, two kills, then wait 43 m off while the practice crab comes back */
const checkpointTape = (host: SimHost, at: number): void => {
  for (let tick = host.state.tick; tick < at; tick++) {
    if (tick === 100) kill(host, bake.habitat.practice);
    if (tick === 400) kill(host, 'creature:13');
    if (tick === 600) { const away = new Vector3(-7, bake.floorAt(-7, -100) + 0.5, -100); host.player.motor.resetAt(away); host.player.position.copy(away); }
    // off the path after the walk: the player waits 43 m from the practice crab's spot while it comes back
    if (tick < 600) step(host); else host.step({ moveX: 0, moveZ: 0, yaw: 0 });
  }
};
// One test per checkpoint, each with its own budget: the string round trip of the native world is most of a checkpoint's
// cost under CI coverage; the continuations compare with expectSameSimSnapshot.
it.each([0, 1, 700, 3700])('restores exactly at tick %i (install, mid-walk, after a practice crab came back), reinstalling the saved roster before restore', (at) => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    checkpointTape(original, at);
    if (at === 3700) expect(original.entities.get('creature:34')?.alive).toBe(true);
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 900; tick++) {
      if (tick === 120) { kill(original, 'creature:22'); kill(restored, 'creature:22'); }
      step(original); step(restored);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(snapshotSimHost(original).adapters.some(adapter => adapter.id === ISLAND_STEP)).toBe(true);
  } finally { restored?.dispose(); original.dispose(); }
}, 90_000);

it('refuses a saved roster whose recipe no longer matches the baked spec', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) step(host);
    const saved = snapshotSimHost(host);
    const actor = saved.adapters.find(adapter => adapter.id === 'runtime.actor.creature:33');
    if (actor === undefined || typeof actor.state !== 'string') throw new Error('missing saved sailor recipe');
    actor.state = actor.state.replace('"hp":60', '"hp":61');
    expect(() => restore(serializeSimSnapshot(saved))).toThrow('Incompatible dynamic simulation actor recipe');
  } finally { host.dispose(); }
});

it('imports the trusted headless runtime without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/driftwood-isle/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
