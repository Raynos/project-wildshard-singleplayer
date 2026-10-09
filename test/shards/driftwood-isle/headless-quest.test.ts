// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_INTERACT } from '../../../src/shards/driftwood-isle/quest/interactables';
import { QUEST_DONE } from '../../../src/shards/driftwood-isle/quest/questLine';
import { DRIFTWOOD_ACT, DRIFTWOOD_INTERACT as ACTOR, QUEST_STEP, REWARD_FLAG, driftwoodSpots } from '../../../src/shards/driftwood-isle/runtime/quest';
import { SWORDS_STEP } from '../../../src/shards/driftwood-isle/runtime/swords';
import { ALTAR_FLAG, CAPTAIN_DEAD_FLAG } from '../../../src/shards/driftwood-isle/runtime/captain';
import { DRIFTWOOD_CYCLE_S, DRIFTWOOD_DAY_START, prepareHeadlessRuntime } from '../../../src/shards/driftwood-isle/runtime/headless';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
let tape: readonly HeadlessCommand[] = [];
const emitted: HeadlessEffect[] = [];
const effects = { commands: () => tape, emit: (effect: HeadlessEffect) => { emitted.push(effect); } };
const boot = (): SimHost => { tape = []; emitted.length = 0; const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
const restore = (saved: string): SimHost => {
  const decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: decoded, ...effects }); });
};
const spots = driftwoodSpots(), still = { moveX: 0, moveZ: 0, yaw: 0 };
const rowIndex = (id: string): number => { const i = DRIFTWOOD_INTERACT.rows.findIndex(d => d.id === id); if (i === -1) throw new Error(`missing row ${id}`); return i; };
/** put the player's feet at (x, y, z) */
const put = (host: SimHost, x: number, y: number, z: number): void => { const at = new Vector3(x, y, z); host.player.motor.resetAt(at); host.player.position.copy(at); };
/** stand the player's feet `gap` m off a baked row and press its prompt */
const press = (host: SimHost, value: number, at: { x: number; y: number; z: number }, gap = 0.6): void => {
  put(host, at.x + gap, at.y, at.z); tape = [{ kind: 'script', actorId: ACTOR, value }]; host.step(still); tape = [];
};
const row = (id: string): { x: number; y: number; z: number } => { const spot = spots.rows[rowIndex(id)]; if (spot === undefined) throw new Error(`missing spot ${id}`); return spot; };
const act = (id: string): number => DRIFTWOOD_ACT.row + rowIndex(id);
const facts = (): string[] => emitted.flatMap(e => e.kind === 'fact' ? [`${e.name}@${e.actorId}`] : []);
/** one tick of play: the stick (world x / z) through the tick protocol's player command, as a worker steps it */
const steer = (host: SimHost, moveX: number, moveZ: number): void => {
  tape = [{ kind: 'player', moveX, moveZ, yaw: 0 }]; host.step({ moveX, moveZ, yaw: 0 }); tape = [];
};
/** walk the player through waypoints (x, z) by the stick alone, easing in at each; a waypoint it cannot reach is left after 4 s */
function walk(host: SimHost, points: readonly { x: number; z: number }[]): void {
  for (const w of points) for (let tick = 0; tick < 240; tick++) {
    const p = host.player.position, dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    const k = Math.min(1, d / 0.8) / d; steer(host, dx * k, dz * k);
  }
}
/** the puzzle barrel's native body: its pose */
interface BarrelBody { translation: () => { x: number; y: number; z: number }; rotation: () => { x: number; y: number; z: number; w: number } }
/** the puzzle barrel's native body (the quest keeper's continuation names its handle) */
function barrelBody(host: SimHost): BarrelBody {
  const saved = v.parse(v.object({ barrel: v.object({ handle: v.number() }) }), snapshotSimHost(host).adapters.find(a => a.id === QUEST_STEP)?.state);
  return host.physics.world.getRigidBody(saved.barrel.handle);
}
/**
 * The tide puzzle by play (the stick only), closed loop, so its outcome never hinges on the last bits of a tip or a roll:
 * each move reads where the barrel lies and how, then pushes it straight at plate b along one of its own axes (along its
 * length it is shoved, across it it rolls; standing, it tips the way it is pushed), from behind, centred, slowly near the
 * end, and is judged by where the barrel got to; the next move starts from there, until it rests on the plate. The cove's
 * crabs are cleared first (one scuttling into the barrel shoves it off the plate), and a barrel wedged where no push
 * moves it (across the lane between the two blocks) is walked into until the never-jam rule sends it home.
 */
function pushBarrelOntoPlateB(host: SimHost): void {
  clearCrabs(host, row('tide-plate-b'), 20);
  const home = row('tide-barrel'), plateB = row('tide-plate-b'), body = barrelBody(host), at = (): { x: number; y: number; z: number } => body.translation();
  put(host, home.x + 0.9, home.y + 0.3, home.z - 2.5);
  let stuck = 0;
  for (let move = 0; move < 16; move++) {
    const c = at(), dx = plateB.x - c.x, dz = plateB.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.35 || (d < 0.7 && host.flags.has('plate:tide-plate-b'))) return;
    // the barrel's length in the world (its body's local y), level when it lies on its side
    const q = body.rotation(), ax = 2 * (q.x * q.y - q.w * q.z), ay = 1 - 2 * (q.x * q.x + q.z * q.z), az = 2 * (q.y * q.z + q.w * q.x), al = Math.hypot(ax, az);
    let ux = dx / d, uz = dz / d, far = d;
    if (Math.abs(ay) < 0.7 && al > 1e-6) {
      const hx = ax / al, hz = az / al, along = dx * hx + dz * hz, across = -dx * hz + dz * hx;
      if (Math.abs(along) >= Math.abs(across)) { const s = Math.sign(along); ux = hx * s; uz = hz * s; far = Math.abs(along); }
      else { const s = Math.sign(across); ux = -hz * s; uz = hx * s; far = Math.abs(across); }
    }
    // round to the spot behind it, on the side the player is on
    const p0 = host.player.position, side = (p0.x - c.x) * -uz + (p0.z - c.z) * ux >= 0 ? 1 : -1;
    if ((p0.x - c.x) * ux + (p0.z - c.z) * uz > -0.6) walk(host, [{ x: c.x - uz * side * 1.4 + ux * 0.2, z: c.z + ux * side * 1.4 + uz * 0.2 }, { x: c.x - uz * side * 1.2 - ux * 1.2, z: c.z + ux * side * 1.2 - uz * 1.2 }]);
    walk(host, [{ x: c.x - ux * 1.3, z: c.z - uz * 1.3 }]);
    // push it `far` along u, keeping on the line through its centre, until it got there or rests against the player
    let rest = 0, last = at();
    for (let tick = 0; tick < 900 && rest < 30; tick++) {
      const b = at(), p = host.player.position, gone = (b.x - c.x) * ux + (b.z - c.z) * uz;
      if (gone >= far - 0.05) break;
      const lat = (p.x - b.x) * -uz + (p.z - b.z) * ux, speed = far - gone > 1.2 ? 0.3 : 0.12;
      steer(host, ux * speed + uz * lat * 2, uz * speed - ux * lat * 2);
      rest = Math.hypot(b.x - last.x, b.z - last.z) < 1e-3 && Math.hypot(p.x - b.x, p.z - b.z) < 1 ? rest + 1 : 0; last = b;
    }
    for (let tick = 0; tick < 45; tick++) steer(host, 0, 0);
    // wedged (twice no further): the page's never-jam rule, by play — walk hard into it until it goes home, and start again
    const moved = at(); stuck = Math.hypot(moved.x - c.x, moved.z - c.z) < 0.1 ? stuck + 1 : 0;
    if (stuck < 2) continue;
    for (let tick = 0; tick < 400; tick++) {
      const b = at(), p = host.player.position, dx2 = b.x - p.x, dz2 = b.z - p.z, d2 = Math.hypot(dx2, dz2);
      if (Math.hypot(b.x - home.x, b.z - home.z) < 0.5) break;
      steer(host, dx2 / d2, dz2 / d2);
    }
    stuck = 0;
    walk(host, [{ x: plateB.x - 0.4, z: plateB.z - 1.1 }, { x: home.x - 0.9, z: home.z + 2 }]);
  }
}
/** plate b's ring at 1.9 m, from its north round the east to its south west: a barrel resting within 0.7 m of the plate never touches it */
function plateBRing(): { x: number; z: number }[] {
  const b = row('tide-plate-b'), r = 1.9, k = r * Math.SQRT1_2;
  return [{ x: b.x, z: b.z + r }, { x: b.x + k, z: b.z + k }, { x: b.x + r, z: b.z }, { x: b.x + k, z: b.z - k }, { x: b.x, z: b.z - r }, { x: b.x - k, z: b.z - k }];
}
/** the way from the player round the barrel on plate b to the ring's south west point: the nearest ring point, then on round the east */
function roundPlateB(host: SimHost): { x: number; z: number }[] {
  const ring = plateBRing(), p = host.player.position;
  let from = 0, best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) { const q = ring[i]; if (q === undefined) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < best) { best = d; from = i; } }
  return ring.slice(from);
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.kill' });
}
/** the cove's reef crabs within `r` m of `at` fall to the player (they scuttle into the puzzle's barrel and shove it off a plate) */
function clearCrabs(host: SimHost, at: { x: number; z: number }, r: number): void {
  const near = [...host.entities].flatMap(([id, a]) => a.kind === 'crab' && Math.hypot(a.position.x - at.x, a.position.z - at.z) < r ? [id] : []);
  for (const id of near) kill(host, id);
  host.step(still);
}

it('bakes one spot per interactables row and the page\'s day clock spellings', () => {
  expect(spots.rows.map(r => r.id)).toEqual(DRIFTWOOD_INTERACT.rows.map(d => d.id));
  const backdrop = readFileSync('src/shards/driftwood-isle/look/backdrop.ts', 'utf8');
  expect(backdrop).toContain('const CYCLE_S = 48 * 60;'); expect(DRIFTWOOD_CYCLE_S).toBe(48 * 60);
  expect(backdrop).toContain(': 0.2 * DAY });'); expect(DRIFTWOOD_DAY_START).toBe(0.2 * (20 / 24));
});

it('plays the Sealed Ring\'s interactables at the page\'s points: talk, chest, beacon, the hold\'s key / pump / winch / strongbox, the sword, the barrel pushed onto a plate by play, the sluice and the cave\'s shard, the altar, the reward, with exact restore mid-beat', () => {
  const original = boot(); let restored: SimHost | undefined;
  try {
    const F = original.flags;
    expect(original.dayClock?.phase).toBeCloseTo(DRIFTWOOD_DAY_START, 6);
    // Wendell: out of reach nothing; at his head his talk starts the quest and files the castaway feat
    press(original, DRIFTWOOD_ACT.talk, { x: spots.talk.x + 8, y: spots.talk.y - 1.62, z: spots.talk.z }, 0);
    expect(F.has('talked:castaway')).toBe(false);
    press(original, DRIFTWOOD_ACT.talk, { x: spots.talk.x, y: spots.talk.y - 1.62, z: spots.talk.z }, 0.8);
    expect(F.has('talked:castaway')).toBe(true); expect(facts()).toContain('driftwood.castaway@castaway:1');
    // the lookout: the beacon is cold without the flint; the chest holds it; the shard rises once the beacon burns
    press(original, act('beacon'), row('beacon')); expect(F.has('lit:beacon')).toBe(false);
    press(original, act('shard-lookout'), row('shard-lookout')); expect(F.has('shard:lookout')).toBe(false);
    press(original, act('castaway-chest'), row('castaway-chest')); expect([F.has('open:castaway-chest'), F.has('has:flint')]).toEqual([true, true]);
    press(original, act('beacon'), row('beacon')); press(original, act('shard-lookout'), row('shard-lookout'));
    expect([F.has('lit:beacon'), F.has('shard:lookout')]).toEqual([true, true]); expect(facts()).toContain('driftwood.shards@shards:1');
    // the wreck: the pump is padlocked and the sword guarded while the sailor stands
    const sailor = [...original.entities].find(([, a]) => a.kind === 'sailor')?.[0]; if (sailor === undefined) throw new Error('missing the sailor');
    press(original, act('hold-pump'), row('hold-pump')); expect(F.has('lever:hold-pump')).toBe(false);
    press(original, DRIFTWOOD_ACT.sword, { x: spots.sword.x, y: spots.sword.y - 1.2, z: spots.sword.z }, 0.3);
    const held = (host: SimHost): number => v.parse(v.object({ held: v.number() }), JSON.parse(v.parse(v.string(), snapshotSimHost(host).adapters.find(a => a.id === SWORDS_STEP)?.state))).held;
    expect(held(original)).toBe(0);
    kill(original, sailor); original.step();
    const fell = original.entities.get(sailor)?.position.clone() ?? new Vector3();
    const key = v.parse(v.object({ key: v.object({ x: v.number(), y: v.number(), z: v.number() }) }), snapshotSimHost(original).adapters.find(a => a.id === QUEST_STEP)?.state).key;
    expect([key.x, key.z]).toEqual([fell.x, fell.z]);
    press(original, act('hold-key'), key, 0.4); expect(F.has('key:hold')).toBe(true);
    press(original, act('hold-winch'), row('hold-winch')); expect(F.has('winch:up')).toBe(false); // jammed while flooded
    press(original, act('hold-pump'), row('hold-pump')); press(original, act('hold-winch'), row('hold-winch'));
    press(original, act('strongbox'), row('strongbox')); expect([F.has('winch:up'), F.has('shard:wreck')]).toEqual([true, true]);
    press(original, DRIFTWOOD_ACT.sword, { x: spots.sword.x, y: spots.sword.y - 1.2, z: spots.sword.z }, 0.3);
    expect(held(original)).toBe(1);
    // the cave: a player on a plate holds it down (the second wants the barrel), the sluice stays shut on one
    const plate = row('tide-plate-a'), plateB = row('tide-plate-b'); put(original, plate.x, plate.y + 0.05, plate.z); original.step(still); original.step(still);
    expect(F.has('plate:tide-plate-a')).toBe(true); expect(F.has('open:sluice')).toBe(false);
    put(original, plate.x + 4, plate.y + 0.3, plate.z); original.step(still); expect(F.has('plate:tide-plate-a')).toBe(false);
    // a sea glass is a walk-in take
    const glass = row('glass-1'); put(original, glass.x, glass.y + 0.05, glass.z); original.step(still);
    expect(F.has('glass:1')).toBe(true); expect(facts()).toContain('driftwood.glass@glass:1');
    // the tide puzzle by play: the barrel pushed onto plate b, the player round it onto plate a, the sluice latches open,
    // and the player walks round the barrel and through the open gate to the cave's shard
    expect(F.has('open:sluice')).toBe(false);
    pushBarrelOntoPlateB(original);
    const plateA = row('tide-plate-a');
    walk(original, [...roundPlateB(original), { x: plateB.x - 1.6, z: plateB.z - 0.9 }, { x: plateA.x + 0.9, z: plateA.z - 0.85 }, { x: plateA.x, z: plateA.z }]);
    for (let tick = 0; tick < 10; tick++) steer(original, 0, 0);
    expect([F.has('plate:tide-plate-a'), F.has('plate:tide-plate-b'), F.has('open:sluice')]).toEqual([true, true, true]);
    const shard = row('shard-cave');
    const east = plateBRing().reverse().slice(0, 4);
    walk(original, [{ x: plateA.x + 0.9, z: plateA.z - 0.85 }, { x: plateB.x - 1.6, z: plateB.z - 0.9 }, ...east,
      { x: plateB.x + 1.9, z: 12.6 }, { x: shard.x, z: 13.4 }, { x: shard.x, z: 19.2 }, { x: shard.x, z: shard.z - 1.1 }]);
    tape = [{ kind: 'script', actorId: ACTOR, value: act('shard-cave') }]; original.step(still); tape = [];
    expect(F.has('shard:cave')).toBe(true); expect(facts()).toContain('driftwood.shards@shards:3');
    // the altar wakes the captain, his death opens the reward
    press(original, act('altar'), row('altar')); expect(F.has(ALTAR_FLAG)).toBe(true);
    const captain = [...original.entities].find(([, a]) => a.kind === 'captain')?.[0]; if (captain === undefined) throw new Error('missing the captain');
    kill(original, captain); original.step(); expect(F.has(CAPTAIN_DEAD_FLAG)).toBe(true);
    put(original, spots.reward.x + 3, spots.reward.y, spots.reward.z);
    for (let tick = 0; tick < 120; tick++) original.step(still);
    expect(F.has(REWARD_FLAG)).toBe(false);
    restored = restore(serializeSimSnapshot(snapshotSimHost(original)));
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = 0; tick < 330; tick++) { original.step(still); restored.step(still); }
    expect([original.flags.has(REWARD_FLAG), original.flags.has(QUEST_DONE), restored.flags.has(QUEST_DONE)]).toEqual([true, true, true]);
    expect(facts()).toContain('driftwood.quest@quest:1');
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
  } finally { tape = []; restored?.dispose(); original.dispose(); }
}, 60_000);
