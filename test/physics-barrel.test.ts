// PHYSICS.md P7-L1: the puzzle barrel rolls. It is a free cylinder now: the player's capsule walking into it tips it,
// on its side it rolls (across the push, down a slope), it trips a plate whichever way it lies, and `BarrelWatch`
// sends it home when it is wedged, lost offshore, or past its leash — so the cave puzzle never jams. The last test
// pushes it across Driftwood's real beach (the baked heightfield) from its start onto the cave's tide plate.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { Bodies, type Body } from '../src/physics/bodies';
import { CharacterMotor } from '../src/physics/CharacterMotor';
import { groups } from '../src/physics/groups';
import { addTerrain } from '../src/physics/terrain';
import { floorBelow } from '../src/physics/query';
import { parseBakedTerrain } from '../src/world/BakedTerrain';
import { BARREL_BODY, BARREL_LOST_T, BARREL_WEDGE_T, BarrelWatch, Live, plateDown, type BarrelEnv } from '../src/world/interact/Interactables';
import type { BarrelDef } from '../src/world/interact/types';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import driftwoodBake from '../public/assets/baked/driftwood-isle/terrain.bin?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());
const DT = 1 / 60, R = BARREL_BODY.shape.cylinder.radius, HALF = BARREL_BODY.shape.cylinder.halfHeight;

/** a world with a flat floor (top at y = 0) */
async function world(): Promise<Physics> {
  const Rp = await rapier();
  const ph = new Physics(Rp);
  ph.world.createCollider(Rp.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  return ph;
}

/** a ramp `deg` steep, `len` long, its foot on the floor at x = 0, rising toward +x */
function ramp(ph: Physics, deg: number, len: number): void {
  const a = deg * Math.PI / 180, q = { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) };
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(len / 2, 0.05, 4)
    .setTranslation(len / 2 * Math.cos(a) + 0.05 * Math.sin(a), len / 2 * Math.sin(a) - 0.05 * Math.cos(a), 0).setRotation(q).setCollisionGroups(groups('WORLD')));
}

const row: BarrelDef = { kind: 'barrel', id: 'tide-barrel', leash: 36, at: { poi: 'world', x: 0, z: 0 } };
/** the barrel with the kit's own owner (a barrel row's `Live`), so `plateDown(…, 'barrel')` knows it */
const spawnBarrel = (bodies: Bodies, at: { x: number; y: number; z: number }, rot?: { x: number; y: number; z: number; w: number }): Body =>
  bodies.spawn({ ...BARREL_BODY, owner: new Live(row) }, at, undefined, rot);
/** lying on its side, its axis along z */
const SIDE_Z = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
/** the barrel's axis' y (1 upright, 0 on its side) */
const axisY = (b: Body): number => { const q = b.rb.rotation(); return 1 - 2 * (q.x * q.x + q.z * q.z); };
/** rolling, not sliding: the spin about its axis carries it at its speed (ω·r ≈ v) */
const rollRatio = (b: Body): number => { const w = b.rb.angvel(); return Math.hypot(w.x, w.y, w.z) * R / Math.max(1e-3, b.speed); };

const motorOf = (ph: Physics): CharacterMotor => new CharacterMotor(ph, { radius: 0.35, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD', 'CREATURE', 'ITEM'] });

/** the player: feet, the velocity it asks for, gravity; `walk` moves it one fixed step toward (vx, vz) m/s */
function player(ph: Physics) {
  const motor = motorOf(ph), position = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: 0, z: 0 };
  return {
    motor, position, velocity,
    walk(vx: number, vz: number): void {
      velocity.x = vx; velocity.z = vz; velocity.y -= 22 * DT;
      const r = motor.move(position, { x: vx * DT, y: velocity.y * DT, z: vz * DT });
      if (r.grounded && velocity.y < 0) velocity.y = 0;
    },
  };
}

function tick(ph: Physics, bodies: Bodies): void { bodies.pre(DT); ph.step(); bodies.post(DT); }

describe('the barrel rolls (P7-L1)', () => {
  it('walked into, it tips over; pushed from the side it rolls along the flat ahead of the player', async () => {
    const ph = await world(), bodies = new Bodies(ph), pl = player(ph);
    const b = spawnBarrel(bodies, { x: 2, y: HALF + 0.01, z: 0 });
    let tippedAt = -1;
    for (let i = 0; i < 60 * 3 && tippedAt < 0; i++) {
      pl.walk(3, 0); tick(ph, bodies);
      if (axisY(b) < 0.2) tippedAt = i / 60;
    }
    expect(tippedAt).toBeGreaterThan(0);
    expect(tippedAt).toBeLessThan(2);          // it tips within a couple of seconds of being walked into
    for (let i = 0; i < 60; i++) { pl.walk(0, 0); tick(ph, bodies); }
    expect(b.curr.y).toBeCloseTo(R, 1);        // on its side
    // it fell along the push; the player goes round and pushes it across its length
    const q = b.rb.rotation(), ax = 2 * (q.x * q.y - q.w * q.z), az = 2 * (q.y * q.z + q.w * q.x), n = Math.hypot(ax, az);
    const from = { x: b.curr.x, z: b.curr.z }, to = { x: from.x - az / n * 30, z: from.z + ax / n * 30 };
    let rolled = 0;
    for (let i = 0; i < 60 * 8; i++) {
      const [vx, vz] = shepherd(b, pl.position, to);
      pl.walk(vx, vz); tick(ph, bodies);
      if (b.speed > 1 && Math.abs(axisY(b)) < 0.2 && rollRatio(b) > 0.8) rolled++;
    }
    expect(rolled).toBeGreaterThan(120);       // > 2 s of it really rolling (its spin carries it), not skating
    expect(Math.hypot(b.curr.x - from.x, b.curr.z - from.z)).toBeGreaterThan(8); // and it went a long way
  });

  it('pushed over the lip of a gentle (8°) slope it rolls down on its own and stops on the flat below; on a 2.5° slope it lies still', async () => {
    const ph = await world(), bodies = new Bodies(ph), pl = player(ph);
    ramp(ph, 8, 10);
    const a = 8 * Math.PI / 180, top = 9 * Math.cos(a);
    // on its side at the top, its axis across the slope; the player behind it (uphill) gives it one shove downhill
    const b = spawnBarrel(bodies, { x: top, y: top * Math.tan(a) + R + 0.02, z: 0 }, SIDE_Z);
    pl.position.x = top + R + 0.5; pl.position.y = pl.position.x * Math.tan(a) + 0.05;
    for (let i = 0; i < 30; i++) { pl.walk(-1.5, 0); tick(ph, bodies); }
    let maxSpeed = 0, rolling = 0;
    for (let i = 0; i < 60 * 15; i++) {
      pl.walk(0, 0); tick(ph, bodies);
      maxSpeed = Math.max(maxSpeed, b.speed);
      if (b.speed > 0.5 && rollRatio(b) > 0.8) rolling++;
    }
    expect(maxSpeed).toBeGreaterThan(1.8);          // it rolled away down the slope, well past the 1.5 m/s shove
    expect(rolling).toBeGreaterThan(60);
    expect(b.curr.x).toBeLessThan(0);               // off the foot of the slope
    expect(b.curr.x).toBeGreaterThan(-15);          // and stopped there (sand: its rolling resistance)
    expect(b.speed).toBeLessThan(0.05);

    const ph2 = await world(), bodies2 = new Bodies(ph2);
    ramp(ph2, 2.5, 10);
    const a2 = 2.5 * Math.PI / 180, x2 = 5 * Math.cos(a2);
    const c = spawnBarrel(bodies2, { x: x2, y: x2 * Math.tan(a2) + R + 0.02, z: 0 }, SIDE_Z);
    for (let i = 0; i < 60 * 5; i++) tick(ph2, bodies2);
    expect(Math.abs(c.curr.x - x2)).toBeLessThan(0.3);    // a 2.5° beach doesn't carry it off
  });

  it('trips a plate standing, or lying on its side either way (even across the rim) — not lying beside it', async () => {
    const plate = { position: { x: 0, y: 0, z: 0 }, yaw: 0.3 };
    const cases: [string, { x: number; y: number; z: number }, { x: number; y: number; z: number; w: number } | undefined, boolean][] = [
      ['standing', { x: 0.1, y: HALF + 0.01, z: 0 }, undefined, true],
      ['on its side, along z', { x: 0, y: R + 0.01, z: 0.2 }, SIDE_Z, true],
      ['on its side, along x', { x: 0.3, y: R + 0.01, z: 0 }, { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, true],
      ['on its side, across the rim', { x: 0.8, y: R + 0.01, z: 0 }, { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, true],
      ['on its side, beside it', { x: 1.5, y: R + 0.01, z: 0 }, SIDE_Z, false],
    ];
    for (const [name, at, rot, down] of cases) {
      const ph = await world(), bodies = new Bodies(ph);
      spawnBarrel(bodies, at, rot);
      for (let i = 0; i < 30; i++) tick(ph, bodies);
      expect(plateDown(ph, plate, 1.3, 'barrel'), name).toBe(down);
      expect(plateDown(ph, plate, 1.3, 'any'), name).toBe(down);
    }
  });
});

describe('the barrel never jams the puzzle (BarrelWatch)', () => {
  const env = (pl: { position: BarrelEnv['player']['position']; velocity: BarrelEnv['player']['velocity'] }, over: Partial<BarrelEnv> = {}): BarrelEnv =>
    ({ player: pl, floorAt: () => 0, water: () => -5, onPlate: () => false, ...over });

  it('wedged: walked into a pocket it can\'t leave, it goes home after BARREL_WEDGE_T — but a push that moves it never trips it', async () => {
    const ph = await world(), bodies = new Bodies(ph), pl = player(ph);
    // a rock pocket open toward −x: its back at x = 3, its sides at z = ±0.55; the barrel in it, the player walking in
    const wall = (hx: number, hz: number, x: number, z: number): void => { ph.world.createCollider(ph.R.ColliderDesc.cuboid(hx, 1, hz).setTranslation(x, 1, z).setCollisionGroups(groups('WORLD'))); };
    wall(0.25, 1, 3.25, 0); wall(1.5, 0.25, 1.5, 0.8); wall(1.5, 0.25, 1.5, -0.8);
    const b = spawnBarrel(bodies, { x: 2.55, y: HALF + 0.01, z: 0 });
    const watch = new BarrelWatch({ x: -3, y: 0, z: 0 }, 36), e = env(pl);
    pl.position.x = -1;
    let goneAt = -1;
    for (let i = 0; i < 60 * 14 && goneAt < 0; i++) {
      pl.walk(3, 0); tick(ph, bodies);
      if (watch.check(b.curr, DT, e)) goneAt = i / 60;
    }
    expect(goneAt).toBeGreaterThan(BARREL_WEDGE_T);          // not before it had been stuck that long
    expect(goneAt).toBeLessThan(BARREL_WEDGE_T + 5);          // but soon after it got stuck
    expect(Math.hypot(b.curr.x - 2.55, b.curr.z)).toBeLessThan(0.6);   // it really was stuck (it rattles about in there)
    // a long straight push across open ground: it moves, so it is never "wedged"
    const ph2 = await world(), bodies2 = new Bodies(ph2), pl2 = player(ph2);
    const c = spawnBarrel(bodies2, { x: 2, y: HALF + 0.01, z: 0 });
    const w2 = new BarrelWatch({ x: 2, y: 0, z: 0 }, 36), e2 = env(pl2);
    for (let i = 0; i < 60 * 8; i++) {
      const dx = c.curr.x - pl2.position.x, dz = c.curr.z - pl2.position.z, d = Math.hypot(dx, dz) || 1;
      pl2.walk(2.5 * dx / d, 2.5 * dz / d); tick(ph2, bodies2);
      expect(w2.check(c.curr, DT, e2)).toBe(false);
    }
  });

  it('lost offshore or under the world: home after BARREL_LOST_T; past the leash: at once; at a plate: never', () => {
    const still = { position: { x: 50, y: 0, z: 50 }, velocity: { x: 0, y: 0, z: 0 } };
    const run = (w: BarrelWatch, c: { x: number; y: number; z: number }, e: BarrelEnv, s: number): number => {
      for (let i = 0; i < 60 * s; i++) if (w.check(c, DT, e)) return i / 60;
      return -1;
    };
    // offshore: the sea floor under it 0.8 m under the water line
    const sea = env(still, { floorAt: () => -0.8, water: () => 0 });
    const t = run(new BarrelWatch({ x: 0, y: 0, z: 0 }, 36), { x: 5, y: -0.4, z: 0 }, sea, 10);
    expect(t).toBeGreaterThan(BARREL_LOST_T - 0.05); expect(t).toBeLessThan(BARREL_LOST_T + 0.1);
    // wading-deep water by the shore is not lost
    expect(run(new BarrelWatch({ x: 0, y: 0, z: 0 }, 36), { x: 5, y: 0.2, z: 0 }, env(still, { floorAt: () => -0.2, water: () => 0 }), 10)).toBe(-1);
    // fallen through the ground
    expect(run(new BarrelWatch({ x: 0, y: 0, z: 0 }, 36), { x: 5, y: -3, z: 0 }, env(still), 10)).toBeGreaterThan(BARREL_LOST_T - 0.05);
    // past the leash: the first check
    expect(run(new BarrelWatch({ x: 0, y: 0, z: 0 }, 36), { x: 37, y: HALF, z: 0 }, env(still), 1)).toBe(0);
    // at a plate: never, even offshore-looking or wedged
    const pusher = { position: { x: 4.4, y: 0, z: 0 }, velocity: { x: 3, y: 0, z: 0 } };
    expect(run(new BarrelWatch({ x: 0, y: 0, z: 0 }, 36), { x: 5, y: HALF, z: 0 }, env(pusher, { onPlate: () => true, floorAt: () => -2, water: () => 0 }), 20)).toBe(-1);
    // at home: never (nothing to fix)
    expect(run(new BarrelWatch({ x: 5, y: 0, z: 0 }, 36), { x: 5.3, y: HALF, z: 0 }, env(pusher), 20)).toBe(-1);
  });
});

describe('Driftwood\'s cave puzzle, on the real beach', () => {
  it('pushed from its start by the wreck\'s bow, it gets onto the tide plate in front of the cave mouth', async () => {
    const Rp = await rapier();
    const g = parseBakedTerrain(await (await fetch(driftwoodBake)).arrayBuffer());
    if (!g) throw new Error('no Driftwood bake');
    const ph = new Physics(Rp);
    addTerrain(ph, g.heights, g.res, g.size);
    ph.world.step();
    const ground = (x: number, z: number): number => floorBelow(ph, x, z, 40, 80) ?? 0;
    // the anchors (src/world/Cove.ts): the cave mouth at (142, 14.5) facing −z; plateB = local (2.9, −4.6); barrelStart (147.5, 3.5)
    const plate = { position: { x: 144.9, y: ground(144.9, 9.9), z: 9.9 }, yaw: 0 };
    const home = { x: 147.5, y: ground(147.5, 3.5), z: 3.5 };
    const bodies = new Bodies(ph), pl = player(ph);
    const b = spawnBarrel(bodies, { x: home.x, y: home.y + HALF + 0.01, z: home.z });
    const watch = new BarrelWatch(home, row.leash);
    const e: BarrelEnv = { player: pl, floorAt: ground, water: () => 0.8, onPlate: (c) => Math.hypot(c.x - plate.position.x, c.z - plate.position.z) < 0.95 };
    // the player starts 3 m down the beach from it
    pl.position.x = home.x + 2; pl.position.z = home.z - 2; pl.position.y = ground(pl.position.x, pl.position.z) + 0.05;
    let onAt = -1, resets = 0, heldFor = 0;
    for (let i = 0; i < 60 * 90 && heldFor < 60; i++) {
      const [vx, vz] = shepherd(b, pl.position, plate.position);
      pl.walk(vx, vz); tick(ph, bodies);
      if (watch.check(b.curr, DT, e)) { resets++; b.teleport({ x: home.x, y: home.y + HALF + 0.01, z: home.z }, { x: 0, y: 0, z: 0, w: 1 }); watch.clear(); }
      const down = plateDown(ph, plate, 1.3, 'barrel');
      if (down && onAt < 0) onAt = i / 60;
      heldFor = down && b.speed < 0.05 ? heldFor + 1 : 0;
    }
    expect(onAt).toBeGreaterThan(0);
    expect(heldFor).toBe(60);                  // at rest on the plate, holding it down
    expect(resets).toBe(0);                    // no jam on the way
  }, 20_000);
});

/**
 * A player herding the barrel toward `to`: walk round to the far side of it (never through it), then push it toward
 * `to`, slower as it closes in (a rolling barrel coasts), and wait while it is still rolling.
 */
function shepherd(b: Body, feet: { x: number; z: number }, to: { x: number; z: number }): [number, number] {
  const c = b.curr, tx = to.x - c.x, tz = to.z - c.z, td = Math.hypot(tx, tz);
  if (td < 0.15) return [0, 0];
  const ux = tx / td, uz = tz / td;
  const behindX = c.x - ux * 1.0, behindZ = c.z - uz * 1.0;
  const ex = behindX - feet.x, ez = behindZ - feet.z, ed = Math.hypot(ex, ez);
  if (b.speed > 0.8 && ed > 0.6) return [0, 0];   // it is rolling on its own: let it
  const go = (x: number, z: number, speed: number): [number, number] => { const d = Math.hypot(x, z) || 1; return [x / d * speed, z / d * speed]; };
  if (ed > 0.35) {
    const ahead = (feet.x - c.x) * ux + (feet.z - c.z) * uz;   // > 0: the player is on the target side of it
    if (ahead > -0.5) {
      const side = (feet.x - c.x) * -uz + (feet.z - c.z) * ux >= 0 ? 1 : -1; // round it on the side the player is on
      return go(c.x - uz * side * 1.4 - ux * 0.6 - feet.x, c.z + ux * side * 1.4 - uz * 0.6 - feet.z, 3);
    }
    return go(ex, ez, 3);
  }
  return go(ux, uz, Math.min(2.5, Math.max(0.6, td * 1.2)));
}
