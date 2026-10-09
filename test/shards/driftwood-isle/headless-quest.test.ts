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
/** the puzzle barrel's native body (the quest keeper's continuation names its handle) */
function barrelBody(host: SimHost): { translation: () => { x: number; y: number; z: number } } {
  const saved = v.parse(v.object({ barrel: v.object({ handle: v.number() }) }), snapshotSimHost(host).adapters.find(a => a.id === QUEST_STEP)?.state);
  return host.physics.world.getRigidBody(saved.barrel.handle);
}
/**
 * The tide puzzle by play (the stick only): from behind the barrel, roll it north at a slow walk east of the cave's rocks
 * to plate b's row (staying centred behind it, going round when it drifts), then push it west into the rock face beside
 * plate b, which stops it on the plate; retried from the side it lies on until it rests there.
 */
function pushBarrelOntoPlateB(host: SimHost): void {
  const home = row('tide-barrel'), plateB = row('tide-plate-b'), roll = { x: 147, z: plateB.z }, slow = 0.25, push = 0.4;
  const body = barrelBody(host), barrelAt = (): { x: number; y: number; z: number } => body.translation();
  put(host, home.x + 0.9, home.y + 0.3, home.z - 2.5);
  for (let tick = 0; tick < 1800; tick++) {
    const b = barrelAt(), p = host.player.position;
    const dx = roll.x - b.x, dz = roll.z - b.z, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
    if (dl < 1 || b.z > plateB.z - 0.6) break;
    const rx = p.x - b.x, rz = p.z - b.z, along = rx * ux + rz * uz, side = -rx * uz + rz * ux;
    let mx: number, mz: number;
    if (along > -0.55 || Math.abs(side) > 0.3) {
      // not behind it: round the side the player is on, then to the spot behind it
      const s = side >= 0 ? 1 : -1, round = along > -0.55 && Math.abs(side) < 1.2;
      const tx = round ? b.x - uz * s * 1.4 - ux * 0.4 : b.x - ux, tz = round ? b.z + ux * s * 1.4 - uz * 0.4 : b.z - uz;
      mx = tx - p.x; mz = tz - p.z; const l = Math.hypot(mx, mz), k = Math.min(1, l / 0.6) / Math.max(l, 1e-6); mx *= k; mz *= k;
    } else { mx = ux + side * uz * 2; mz = uz - side * ux * 2; const l = Math.hypot(mx, mz); mx *= slow / l; mz *= slow / l; }
    steer(host, mx, mz);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let tick = 0; tick < 60; tick++) steer(host, 0, 0);
    const b = barrelAt();
    if (b.x < plateB.x + 0.4 && Math.abs(b.z - plateB.z) < 0.75) return;
    const dz = plateB.z - b.z, west = Math.abs(dz) < 0.45, dir = west ? { x: -1, z: 0 } : { x: 0, z: Math.sign(dz) }, side = { x: -dir.z, z: dir.x };
    const start = { x: b.x - dir.x * 1.3, z: b.z - dir.z * 1.3 };
    walk(host, [{ x: b.x + side.x * 1.4 - dir.x * 0.3, z: b.z + side.z * 1.4 - dir.z * 0.3 }, { x: start.x + side.x * 0.6, z: start.z + side.z * 0.6 }, start]);
    let resting = 0, last = b;
    for (let tick = 0; tick < 600 && resting <= 45; tick++) {
      const c = barrelAt(), p = host.player.position;
      if (west ? c.x < plateB.x - 0.6 : (c.z - plateB.z) * Math.sign(dz) > -0.1) break;
      const lat = west ? p.z - c.z : p.x - c.x;
      steer(host, dir.x * push - (west ? 0 : lat * 1.5), dir.z * push - (west ? lat * 1.5 : 0));
      resting = Math.hypot(c.x - last.x, c.z - last.z) < 1e-3 ? resting + 1 : 0; last = c;
    }
  }
}
function kill(host: SimHost, id: string): void {
  const actor = host.entities.get(id); if (actor === undefined) throw new Error(`missing ${id}`);
  host.combat.hit({ source: host.player.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount: 10_000, point: actor.position.clone(), dir: new Vector3(0, 0, 1), moveId: 'test.kill' });
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
    // the tide puzzle by play: the barrel rolled onto plate b, the player on plate a, the sluice latches open, and the
    // player walks through the open gate to the cave's shard
    expect(F.has('open:sluice')).toBe(false);
    pushBarrelOntoPlateB(original);
    const plateA = row('tide-plate-a');
    walk(original, [{ x: plateB.x - 0.3, z: plateB.z - 1.7 }, { x: plateB.x - 1.6, z: plateB.z - 0.9 }, { x: plateA.x + 0.9, z: plateA.z - 0.85 }, { x: plateA.x, z: plateA.z }]);
    for (let tick = 0; tick < 10; tick++) steer(original, 0, 0);
    expect([F.has('plate:tide-plate-a'), F.has('plate:tide-plate-b'), F.has('open:sluice')]).toEqual([true, true, true]);
    const shard = row('shard-cave');
    walk(original, [{ x: plateA.x + 0.9, z: plateA.z - 0.85 }, { x: plateB.x - 1.6, z: plateB.z - 0.9 }, { x: plateB.x + 1, z: plateB.z - 1.3 },
      { x: plateB.x + 1.1, z: 12.6 }, { x: shard.x, z: 13.4 }, { x: shard.x, z: 19.2 }, { x: shard.x, z: shard.z - 1.1 }]);
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
