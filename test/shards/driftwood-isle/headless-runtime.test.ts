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
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_ISLE, PRACTICE_CRAB } from '../../../src/shards/driftwood-isle/manifest';
import { MONKEY } from '../../../src/shards/driftwood-isle/species/monkey';
import { MONKEY_VARIANTS } from '../../../src/shards/driftwood-isle/species/monkeyVariants';
import { driftwoodBake } from '../../../src/shards/driftwood-isle/runtime/baked';
import { CAPTAIN_SCALE, DRIFTWOOD_FIGHT, FAUNA_DRAWS, ISLAND_STEP } from '../../../src/shards/driftwood-isle/runtime/keeper';
import { ALTAR_FLAG, CAPTAIN_DEAD_FLAG } from '../../../src/shards/driftwood-isle/runtime/captain';
import { CAPTAIN } from '../../../src/shards/driftwood-isle/species/captain';
import { SWORDS_STEP, driftwoodSwordProfiles } from '../../../src/shards/driftwood-isle/runtime/swords';
import { KILLS_STEP, SAILOR_DEAD_FLAG } from '../../../src/shards/driftwood-isle/runtime/kills';
import { SWORD_IRON, SWORD_WOOD } from '../../../src/game/weapons/starterMeleeProfile';
import { DRIFTWOOD_FAUNA_TUNING, faunaPlacement } from '../../../src/shards/driftwood-isle/runtime/fauna';
import { LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { SEA_RAMP_RUN } from '../../../src/shards/driftwood-isle/world/build';
import { ENTRY_RAMP_RUN } from '../../../src/shards/driftwood-isle/runtime/entries';
import { prepareHeadlessRuntime } from '../../../src/shards/driftwood-isle/runtime/headless';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
/** the tick's commands every booted host reads (the swords' attack taps); empty unless a test fills it */
let tape: readonly HeadlessCommand[] = [];
/** the effects the hosts emitted (the kill feats' ledger facts) */
const emitted: HeadlessEffect[] = [];
const effects = { commands: () => tape, emit: (effect: HeadlessEffect) => { emitted.push(effect); } };
const boot = (): SimHost => { tape = []; emitted.length = 0; const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const bake = driftwoodBake();
/** stand the player `gap` m in front of `actor` (on the floor), facing it */
const standBy = (host: SimHost, actor: { position: Vector3 }, gap: number): void => {
  const at = new Vector3(actor.position.x, 0, actor.position.z + gap); at.y = bake.floorAt(at.x, at.z) + 0.3;
  host.player.motor.resetAt(at); host.player.position.copy(at); host.player.yaw = 0;
};
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
});

it('walks every lane of the four entries up its flared sea ramp onto the deck (SF72 pick (c), the entry proof)', () => {
  expect(ENTRY_RAMP_RUN).toBe(SEA_RAMP_RUN);
  const host = boot();
  try {
    for (let tick = 0; tick < 60; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const prove = plan.proveEntries; if (prove === undefined) throw new Error('Driftwood has no entry proof');
    const colliders = host.physics.world.colliders.len(), proof = prove(host);
    expect(proof.lanes).toBe(4 * 23);
    expect(proof.steps).toBeGreaterThan(4 * 23 * 300);
    expect(host.physics.world.colliders.len()).toBe(colliders); // the proof's capsule is released
  } finally { host.dispose(); }
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

it('runs the bodies on the page\'s distance bands: a capsule only within 45 m, a body past 160 m neither decides nor moves', () => {
  const host = boot();
  try {
    expect(host.bodyBands).toEqual({ physics: true });
    const still = { moveX: 0, moveZ: 0, yaw: 0 }, p = host.player.position, crab = host.entities.get(bake.habitat.practice);
    if (crab === undefined) throw new Error('missing practice crab');
    // the player 20 m from the practice crab, off the pier
    const beside = new Vector3(crab.position.x, 0, crab.position.z + 20); beside.y = bake.floorAt(beside.x, beside.z) + 0.5;
    host.player.motor.resetAt(beside); host.player.position.copy(beside);
    host.step(still);
    const flat = (a: { position: Vector3 }): number => Math.hypot(a.position.x - p.x, a.position.z - p.z);
    const bodies = [...host.entities.values()], far = bodies.filter(a => a.position.distanceTo(p) > 170), near = bodies.filter(a => a.alive && flat(a) < 45);
    expect(far.length).toBeGreaterThan(10); expect(near.length).toBeGreaterThan(0);
    near.forEach(a => { expect(a.motor).not.toBeNull(); });
    bodies.filter(a => flat(a) > 55).forEach(a => { expect(a.motor).toBeNull(); });
    const before = far.map(a => [a.position.clone(), a.yaw] as const);
    for (let tick = 0; tick < 300; tick++) host.step(still);
    far.forEach((a, i) => { expect([a.position.distanceTo(before[i]?.[0] ?? new Vector3(Infinity)), a.yaw]).toEqual([0, before[i]?.[1]]); });
    expect(snapshotSimHost(host).bands?.rows.length).toBeGreaterThan(0);
  } finally { host.dispose(); }
});

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

it('wakes the Drowned Captain on the altar under the manager\'s next id: he rises, fights the player in his arena, restores exactly mid-fight and his death ends it', () => {
  expect(CAPTAIN.variants.map(row => row.scale)).toEqual([CAPTAIN_SCALE]);
  const original = boot(); let restored: SimHost | undefined;
  try {
    const { pool } = bake.captain, still = { moveX: 0, moveZ: 0, yaw: 0 };
    // the player 3 m from his pool, inside the arena
    const at = new Vector3(pool.x + 3, 0, pool.z); at.y = bake.floorAt(at.x, at.z) + 0.3;
    original.player.motor.resetAt(at); original.player.position.copy(at);
    const attempts: string[] = [], cuts: number[] = [];
    original.events.on('boss.attempt', ({ outcome }) => { attempts.push(outcome); }, original.scope);
    original.events.on('damage.dealt', ({ req }) => { if (req.target === original.player.health && req.sourceTags.includes('creature.captain')) cuts.push(req.amount); }, original.scope);
    original.step(still);
    expect([...original.entities.keys()]).not.toContain('creature:34');
    original.flags.set(ALTAR_FLAG);
    const captain = original.entities.get('creature:34'); if (captain === undefined) throw new Error('no captain on the altar');
    expect([captain.kind, captain.scale, captain.mem['poolX'], captain.mem['arena'], captain.mem['awake']]).toEqual(['captain', 1.35, pool.x, bake.captain.arena, 1]);
    let fighting = -1;
    for (let tick = 0; tick < 300 && fighting < 0; tick++) { original.step(still); if (captain.state === 'stalk') fighting = tick; }
    expect(fighting).toBeGreaterThan(60); expect(captain.yOffset).toBe(0);
    for (let tick = 0; tick < 240; tick++) original.step(still);
    expect(cuts).toContain(24); // his cut landed
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 600; tick++) { original.step(still); restored.step(still); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    // a player who died in the arena ends that attempt ('lost'); leaving the arena and coming back starts another
    const away = new Vector3(pool.x + 40, 0, pool.z); away.y = bake.floorAt(away.x, away.z) + 0.3;
    for (const to of [away, at]) { original.player.motor.resetAt(to); original.player.position.copy(to); original.step(still); }
    expect(attempts.every(outcome => outcome === 'lost' || outcome === 'left')).toBe(true);
    kill(original, 'creature:34'); original.step(still);
    expect(original.flags.has(CAPTAIN_DEAD_FLAG)).toBe(true); expect(attempts.at(-1)).toBe('won');
  } finally { restored?.dispose(); original.dispose(); }
}, 60_000);

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

it('swings the swords on the swept melee clock: the combo\'s blows land on the named target within reach, a blow staggers, and a mid-swing restore is exact', () => {
  // the page's profiles (loadout/rows.ts): the starter wooden / iron sword with the declared rows' numbers
  const [wood, iron] = driftwoodSwordProfiles(source.items.rows);
  expect([wood.id, wood.damage, wood.reach, wood.cooldown, wood.heavyCharge, wood.comboGap, wood.chainLag, wood.moves]).toEqual(['weapon.sword', 12, 2.2, 0.08, 0.45, SWORD_WOOD.comboGap, SWORD_WOOD.chainLag, SWORD_WOOD.moves]);
  expect([iron.id, iron.damage]).toEqual([SWORD_IRON.id, 28]);
  const original = boot(); let restored: SimHost | undefined;
  try {
    const crab = original.entities.get('creature:13'); if (crab === undefined) throw new Error('missing big crab');
    const blows: { amount: number; move: string | undefined; weapon: string | undefined }[] = [];
    original.events.on('damage.dealt', ({ req }) => { if (req.weaponId !== undefined) blows.push({ amount: req.amount, move: req.moveId, weapon: req.weaponId }); }, original.scope);
    standBy(original, crab, 1.6);
    const still = { moveX: 0, moveZ: 0, yaw: 0 }, tap: HeadlessCommand[] = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'creature:13' } }];
    // a tap every 8 ticks for a second: the light combo runs slash → backhand → finisher, each blow struck once
    for (let tick = 0; tick < 60; tick++) { tape = tick % 8 === 0 ? tap : []; original.step(still); }
    tape = [];
    const swords = v.parse(v.object({ swings: v.number(), hits: v.number() }), JSON.parse(v.parse(v.string(), snapshotSimHost(original).adapters.find(a => a.id === SWORDS_STEP)?.state)));
    expect(swords.swings).toBeGreaterThanOrEqual(3); expect(swords.hits).toBe(blows.length);
    expect(blows.slice(0, 3)).toEqual([{ amount: 12, move: 'move.slash', weapon: 'weapon.sword' }, { amount: 12, move: 'move.backhand', weapon: 'weapon.sword' }, { amount: 16, move: 'move.finisher', weapon: 'weapon.sword' }]);
    expect(crab.stunned || !crab.alive).toBe(true);
    // a target past the reach is never struck: the clock swings, the blade meets nothing
    const boar = original.entities.get('creature:1'); if (boar === undefined) throw new Error('missing boar');
    standBy(original, boar, 6); const before = blows.length;
    for (let tick = 0; tick < 40; tick++) { tape = tick % 8 === 0 ? [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'creature:1' } }] : []; original.step(still); }
    expect(blows.length).toBe(before);
    // up close the blow lands and the boar staggers (the hunting brain hears it); mid-swing the continuation is exact
    standBy(original, boar, 1.4);
    for (let tick = 0; tick < 12; tick++) { tape = tick === 0 ? [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'creature:1' } }] : []; original.step(still); }
    expect(blows.length).toBe(before + 1); expect(boar.stunned).toBe(true);
    tape = [];
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 240; tick++) {
      tape = tick % 10 === 0 ? [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: 'creature:1' } }] : [];
      original.step(still); restored.step(still);
    }
    tape = [];
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { tape = []; restored?.dispose(); original.dispose(); }
}, 60_000);

it('files the kill hooks: the sailor\'s death sets dead:sailor, each kill of a feat\'s kind emits its ledger fact up to the feat\'s count, and the counts restore', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const crabs = [...original.entities].filter(([, a]) => a.kind === 'crab').map(([id]) => id), sailor = [...original.entities].find(([, a]) => a.kind === 'sailor')?.[0];
    if (sailor === undefined || crabs.length < 3) throw new Error('missing the sailor or the crabs');
    // the pipeline's death events reach their listeners at the tick's flush
    crabs.slice(0, 2).forEach(id => { kill(original, id); }); original.step();
    expect(emitted).toEqual([{ kind: 'fact', name: 'driftwood.crab10', actorId: 'crab10:1' }, { kind: 'fact', name: 'driftwood.crab10', actorId: 'crab10:2' }]);
    expect(original.flags.has(SAILOR_DEAD_FLAG)).toBe(false);
    kill(original, sailor); original.step(); kill(original, sailor); original.step();
    expect(original.flags.has(SAILOR_DEAD_FLAG)).toBe(true);
    expect(emitted.slice(2)).toEqual([{ kind: 'fact', name: 'driftwood.sailor', actorId: 'sailor:1' }]); // a dead body dies once
    expect(snapshotSimHost(original).adapters.find(a => a.id === KILLS_STEP)?.state).toEqual({ sailor: 1, crab10: 2, monkey6: 0 });
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    emitted.length = 0;
    kill(restored, crabs[2] ?? ''); restored.step();
    expect(emitted).toEqual([{ kind: 'fact', name: 'driftwood.crab10', actorId: 'crab10:3' }]);
  } finally { restored?.dispose(); original.dispose(); }
});

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


it('queues a dead boar on the spawn stream, walks out of sight, restores the pending queue and returns the same variant to its herd', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const boar = original.entities.get('creature:0'); if (boar === undefined) throw new Error('missing boar');
    const variant = boar.variant, seed = boar.seed;
    standBy(original, boar, 1.4); kill(original, boar.entityId); original.step();
    const queueState = () => v.parse(v.object({ ecology: v.object({ pending: v.array(v.object({ due: v.number(), herd: v.number(), x: v.number(), z: v.number(), id: v.string() })) }) }), snapshotSimHost(original).adapters.find(a => a.id === ISLAND_STEP)?.state).ecology.pending;
    const queued = queueState()[0]; if (queued === undefined) throw new Error('boar did not queue');
    expect(queued.id).toBe('creature:0'); expect(queued.due).toBeGreaterThanOrEqual(300); expect(queued.due).toBeLessThanOrEqual(421);
    const goal = { x: -7, z: -194 };
    for (let tick = 0; tick < 3000; tick++) {
      const p = original.player.position, dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
      original.step(d < 1 ? undefined : { moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(-dx, -dz) });
      if (Math.hypot(p.x - queued.x, p.z - queued.z) >= 65) break;
    }
    expect(Math.hypot(original.player.position.x - queued.x, original.player.position.z - queued.z)).toBeGreaterThanOrEqual(60);
    const dueTick = Math.ceil((queued.due + 2) * 60);
    // One restore near the due time, so both hosts only replay the short suffix across materialization.
    while (original.state.tick < dueTick - 120) original.step();
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 180; tick++) { original.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    const back = [...original.entities.values()].find(a => a.kind === 'boar' && a.entityId === 'creature:34');
    if (back === undefined) throw new Error('boar did not return');
    expect(back.alive).toBe(true); expect(back.variant).toBe(variant); expect(back.seed).not.toBe(seed);
    const keeper = v.parse(v.object({ bodies: v.array(v.object({ id: v.string(), herd: v.number() })) }), snapshotSimHost(original).adapters.find(a => a.id === ISLAND_STEP)?.state);
    expect(keeper.bodies.find(b => b.id === back.entityId)?.herd).toBe(queued.herd);
    expect(Math.hypot(back.position.x - queued.x, back.position.z - queued.z)).toBeLessThanOrEqual(6);
    expect(queueState()).toEqual([]);
  } finally { restored?.dispose(); original.dispose(); }
}, 90_000);

it('keeps the dead sailor queued through daytime and reinstalls him only at night on the wreck hold floor', () => {
  const host = boot(); let restored: SimHost | undefined;
  try {
    const sailor = host.entities.get('creature:33'), clock = host.dayClock;
    if (sailor === undefined || clock === undefined) throw new Error('missing sailor or day clock');
    clock.setTime('midday');
    const x = sailor.position.x, z = sailor.position.z;
    kill(host, sailor.entityId);
    for (let tick = 0; tick < 60 * 185; tick++) host.step();
    expect([...host.entities.values()].filter(a => a.kind === 'sailor' && a.alive)).toEqual([]);
    clock.setTime('night');
    for (let tick = 0; tick < 65; tick++) host.step();
    const back = [...host.entities.values()].find(a => a.kind === 'sailor' && a.alive);
    if (back === undefined) throw new Error('sailor did not rise');
    expect([back.position.x, back.position.z]).toEqual([x, z]);
    const floor = bake.holdFloorAt(x, z) ?? bake.floorAt(x, z);
    expect(back.position.y).toBeCloseTo(floor, 3);
    expect(back.groundHeight?.(x, z, back.position.y + 1)).toBe(floor);
    restored = restore(serializeSimSnapshot(snapshotSimHost(host)));
    const restoredSailor = restored.entities.get(back.entityId);
    expect(restoredSailor?.groundHeight?.(x, z, back.position.y + 1)).toBe(floor);
    for (let tick = 0; tick < 60; tick++) { host.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  } finally { restored?.dispose(); host.dispose(); }
}, 60_000);

it('charges the held heavy on the real sword clock and restores mid-charge before the same 24-damage blow', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const target = original.entities.get('creature:13'); if (target === undefined) throw new Error('missing crab');
    standBy(original, target, 1.6);
    const still = { moveX: 0, moveZ: 0, yaw: 0 }, hold: HeadlessCommand[] = [{ kind: 'player', ...still, heavy: { targetId: target.entityId } }];
    const blows: number[] = [];
    original.events.on('damage.dealt', ({ req }) => { if (req.moveId === 'move.heavy') blows.push(req.amount); }, original.scope);
    for (let tick = 0; tick < 15; tick++) { tape = hold; original.step(still); }
    expect(blows).toEqual([]);
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 60; tick++) { tape = tick < 15 ? hold : []; original.step(still); restored.step(still); }
    expect(blows).toEqual([24]);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { tape = []; restored?.dispose(); original.dispose(); }
});

it('lunges through the real player dash to a target beyond light reach and restores the dash/contact suffix', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const target = original.entities.get('creature:13'); if (target === undefined) throw new Error('missing crab');
    standBy(original, target, 3.8); const before = original.player.position.clone();
    const still = { moveX: 0, moveZ: 0, yaw: 0 }, blows: number[] = [];
    original.events.on('damage.dealt', ({ req }) => { if (req.weaponId === 'weapon.sword') blows.push(req.amount); }, original.scope);
    tape = [{ kind: 'player', ...still, attack: { targetId: target.entityId } }]; original.step(still); tape = [];
    for (let tick = 0; tick < 3; tick++) original.step(still);
    expect(original.player.position.distanceTo(before)).toBeGreaterThan(0.1);
    expect(snapshotSimHost(original).player.dash?.t).toBeGreaterThan(0);
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    for (let tick = 0; tick < 40; tick++) { original.step(still); restored.step(still); }
    expect(blows).toEqual([12]);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { tape = []; restored?.dispose(); original.dispose(); }
});

it('keeps an unlocked target outside the sword cone out of the dash and wakes paused enemies on the real dodge press', () => {
  const host = boot();
  try {
    const target = host.entities.get('creature:13'); if (target === undefined) throw new Error('missing crab');
    standBy(host, target, 3.8); const before = host.player.position.clone();
    tape = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: Math.PI, attack: { targetId: target.entityId } }];
    host.step({ moveX: 0, moveZ: 0, yaw: Math.PI }); tape = [];
    expect(snapshotSimHost(host).player.dash).toBeUndefined();
    expect(Math.hypot(host.player.position.x - before.x, host.player.position.z - before.z)).toBeLessThan(0.01);
    // Move the test player out of the AI band; the actual DODGE input wakes the enemy despite the paused clock.
    const at = new Vector3(-7, 0, -194); at.y = bake.floorAt(at.x, at.z) + 0.3;
    host.player.motor.resetAt(at); host.player.position.copy(at); host.step();
    const frames = () => host.bodyBandState()?.rows.find(row => row.id === target.entityId)?.brain.tickFrame;
    const prior = frames(); let dodges = 0;
    host.events.on('player.dodge', () => { dodges++; }, host.scope);
    expect(host.player.position.distanceTo(target.position)).toBeGreaterThan(160);
    host.step(); expect(frames()).toBe(prior);
    host.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true });
    expect(frames()).toBeGreaterThan(prior ?? -1);
    host.step({ moveX: 0, moveZ: 0, yaw: 0, dodge: true });
    expect(frames()).toBe(-1); // paused again: the cooldown refuses a second wake
    expect(dodges).toBe(1);
    expect(snapshotSimHost(host).player.dodge?.cd).toBeGreaterThan(0);
  } finally { tape = []; host.dispose(); }
});

it('uses only the last player command for sword inputs and never hits an old target for an unaimed heavy', () => {
  const host = boot();
  try {
    const target = host.entities.get('creature:13'); if (target === undefined) throw new Error('missing crab');
    standBy(host, target, 1.6);
    const still = { moveX: 0, moveZ: 0, yaw: 0 }, cuts: number[] = [];
    host.events.on('damage.dealt', ({ req }) => { if (req.weaponId === 'weapon.sword') cuts.push(req.amount); }, host.scope);
    tape = [{ kind: 'player', ...still, attack: { targetId: target.entityId }, heavy: { targetId: target.entityId } }, { kind: 'player', ...still }]; host.step(still); tape = [];
    const state = () => v.parse(v.object({ swings: v.number(), target: v.nullable(v.string()) }), JSON.parse(v.parse(v.string(), snapshotSimHost(host).adapters.find(a => a.id === SWORDS_STEP)?.state)));
    expect(state()).toEqual({ swings: 0, target: null });
    tape = [{ kind: 'player', ...still, attack: { targetId: target.entityId } }]; host.step(still); tape = [];
    for (let tick = 0; tick < 45; tick++) host.step(still);
    expect(cuts).toEqual([12]);
    for (let tick = 0; tick < 30; tick++) { tape = [{ kind: 'player', ...still, heavy: {} }]; host.step(still); }
    tape = []; for (let tick = 0; tick < 45; tick++) host.step(still);
    expect(state().swings).toBe(2); expect(state().target).toBeNull(); expect(cuts).toEqual([12]);
  } finally { tape = []; host.dispose(); }
});
