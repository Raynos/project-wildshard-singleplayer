// PHYSICS.md P7: items are bodies. The body service (cap, sleep, interpolation, buoyancy), a coconut that rolls down a
// slope and stops, the puzzle barrel pushed by a CharacterMotor until a wall stops it, and a plate that trips for a body
// standing on it and not for one beside it.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { Bodies, type Body } from '../src/physics/bodies';
import { CharacterMotor } from '../src/physics/CharacterMotor';
import { groups } from '../src/physics/groups';
import { COCONUT_BODY } from '../src/entities/Enemies';
import { BARREL_BODY, plateDown } from '../src/world/interact/Interactables';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** a world with a flat floor (top at y = 0) */
async function world(): Promise<Physics> {
  const R = await rapier();
  const ph = new Physics(R);
  ph.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  return ph;
}

/** one fixed step the way Game runs it: pre → step → post */
function tick(ph: Physics, bodies: Bodies, n = 1): void {
  for (let i = 0; i < n; i++) { bodies.pre(); ph.step(); bodies.post(1 / 60); }
}

const DRY = { surface: (): number | undefined => undefined, buoyancy: 0, drag: 0 };
const coconut = (bodies: Bodies, x: number, y: number, z: number): Body =>
  bodies.spawn({ ...COCONUT_BODY, group: 'ITEM', owner: 'coconut', float: DRY }, { x, y, z });

describe('body service', () => {
  it('caps the awake bodies: the farthest expendable ones are removed, the farthest others put to sleep, `keep` never', async () => {
    const ph = await world();
    const bodies = new Bodies(ph, { x: 0, y: 0, z: 0 }, 4);
    const removed: string[] = [];
    const spawn = (name: string, x: number, extra: { expendable?: boolean; keep?: boolean } = {}): Body =>
      bodies.spawn({ shape: { ball: 0.2 }, material: 'wood', owner: name, ...extra, onRemoved: () => { removed.push(name); } }, { x, y: 5, z: 0 });
    const near = spawn('near', 1, { expendable: true });
    const farJunk = spawn('far-junk', 30, { expendable: true });
    const farKeep = spawn('far-keep', 40, { keep: true });
    const farItem = spawn('far-item', 20);
    const mid = spawn('mid', 10, { expendable: true });
    const mid2 = spawn('mid2', 8);
    tick(ph, bodies);
    // 6 awake, cap 4: the two farthest cullable ones go — far-junk (removed, expendable), far-item (asleep)
    expect(bodies.awake).toBe(4);
    expect(removed).toEqual(['far-junk']);
    expect(farJunk.alive).toBe(false);
    expect(farItem.rb.isSleeping()).toBe(true);
    expect(farKeep.rb.isSleeping()).toBe(false);
    for (const b of [near, mid, mid2]) expect(b.rb.isSleeping()).toBe(false);
    expect(bodies.list).toHaveLength(5);
  });

  it('a body at rest falls asleep and stops counting; interpolation sits between the last two steps', async () => {
    const ph = await world();
    const bodies = new Bodies(ph);
    const b = bodies.spawn({ shape: { cuboid: { x: 0.2, y: 0.2, z: 0.2 } }, material: 'wood', owner: null }, { x: 0, y: 1, z: 0 });
    tick(ph, bodies, 10);
    const p = { x: 0, y: 0, z: 0 };
    b.pose(0.5, p);
    expect(p.y).toBeCloseTo((b.prev.y + b.curr.y) / 2, 6);
    expect(b.curr.y).toBeLessThan(b.prev.y);   // still falling
    tick(ph, bodies, 240);
    expect(b.curr.y).toBeCloseTo(0.2, 1);
    expect(b.rb.isSleeping()).toBe(true);
    expect(bodies.awake).toBe(0);
  });

  it('a landing reads as a knock (impact), and a floating body rides the water line', async () => {
    const ph = await world();
    const bodies = new Bodies(ph);
    const b = coconut(bodies, 0, 2, 0);
    let peak = 0;
    for (let i = 0; i < 90; i++) { tick(ph, bodies); peak = Math.max(peak, b.takeImpact()); }
    expect(peak).toBeGreaterThan(2);   // hit the floor at ~6 m/s
    // a pool 2 m deep: the floor at y = −2, the water at y = 0
    const deep = await (async () => {
      const R = await rapier(), p = new Physics(R);
      p.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -2.5, 0).setCollisionGroups(groups('WORLD')));
      return p;
    })();
    const wet = new Bodies(deep);
    const c = wet.spawn({ ...COCONUT_BODY, group: 'ITEM', owner: 'coconut' , float: { ...COCONUT_BODY.float, surface: () => 0 } }, { x: 0, y: 1.5, z: 0 });
    tick(deep, wet, 600);
    expect(c.curr.y).toBeGreaterThan(-0.13);   // afloat, not on the bottom at −1.87
    expect(c.curr.y).toBeLessThan(0.13);
    expect(c.wet).toBeGreaterThan(0);
  });
});

describe('coconut', () => {
  it('rolls down a slope and stops on the flat below it', async () => {
    const ph = await world();
    const { R } = ph;
    // a 12° dune face 8 m long, running down toward −x onto the flat floor
    const ang = 12 * Math.PI / 180, len = 8;
    const q = { x: 0, y: 0, z: Math.sin(ang / 2), w: Math.cos(ang / 2) }; // +x end up
    const cx = len / 2 * Math.cos(ang), cy = len / 2 * Math.sin(ang);
    ph.world.createCollider(R.ColliderDesc.cuboid(len / 2, 0.05, 3).setTranslation(cx - 0.05 * Math.sin(ang), cy - 0.05 * Math.cos(ang), 0).setRotation(q).setCollisionGroups(groups('WORLD')));
    const bodies = new Bodies(ph);
    const top = len * Math.cos(ang) - 0.5;
    const b = coconut(bodies, top, top * Math.tan(ang) + 0.2, 0);
    let maxSpeed = 0;
    for (let i = 0; i < 60 * 12; i++) { tick(ph, bodies); maxSpeed = Math.max(maxSpeed, b.speed); }
    expect(maxSpeed).toBeGreaterThan(1);           // it really rolled
    expect(b.curr.x).toBeLessThan(0);              // off the foot of the slope, onto the flat
    expect(b.curr.x).toBeGreaterThan(-12);         // and stopped there, not rolling on forever
    expect(b.curr.y).toBeCloseTo(0.13, 1);
    expect(b.speed).toBeLessThan(0.05);
  });
});

describe('puzzle barrel', () => {
  it('is pushed by the player capsule, and a wall stops it (and the player behind it)', async () => {
    const ph = await world();
    const { R } = ph;
    ph.world.createCollider(R.ColliderDesc.cuboid(0.25, 2, 4).setTranslation(6.25, 2, 0).setCollisionGroups(groups('WORLD'))); // a wall, its face at x = 6
    const bodies = new Bodies(ph);
    const barrel = bodies.spawn({ ...BARREL_BODY, owner: 'barrel' }, { x: 2, y: 0.49, z: 0 });
    const motor = new CharacterMotor(ph, { radius: 0.35, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD', 'CREATURE', 'ITEM'] });
    const feet = { x: 0, y: 0, z: 0 };
    let vy = 0, movedAt = -1;
    for (let i = 0; i < 60 * 8; i++) {
      vy -= 22 / 60;
      // walk at it (P7-L1: it tips over and can be knocked off the line, so the player follows it)
      const dx = barrel.curr.x - feet.x, dz = barrel.curr.z - feet.z, d = Math.hypot(dx, dz) || 1;
      const r = motor.move(feet, { x: 4.3 / 60 * dx / d, y: vy / 60, z: 4.3 / 60 * dz / d });
      if (r.grounded && vy < 0) vy = 0;
      tick(ph, bodies);
      if (movedAt < 0 && barrel.curr.x > 2.5) movedAt = i;
    }
    expect(movedAt).toBeGreaterThan(0);                     // it moved
    expect(barrel.curr.x).toBeGreaterThan(5);                // all the way to the wall …
    // … and not into it: its reach along x (its axis' x part × the half length, the rest × the radius) stops at the face
    const q = barrel.rb.rotation(), ax = Math.abs(2 * (q.x * q.y - q.w * q.z));
    expect(barrel.curr.x + ax * 0.475 + Math.sqrt(Math.max(0, 1 - ax * ax)) * 0.38).toBeLessThanOrEqual(6 + 0.03);
    expect(barrel.curr.y).toBeLessThan(0.5);                 // on the floor (upright or tipped over, P7-L1)
    expect(feet.x).toBeLessThan(6 - 0.35);                  // the player stopped too (behind or beside it)
  });
});

describe('pressure plate', () => {
  it('trips for a barrel or the player standing on it, not beside it; `by` picks who counts', async () => {
    const ph = await world();
    const bodies = new Bodies(ph);
    const plate = { position: { x: 0, y: 0, z: 0 }, yaw: 0.4 };
    const barrel = bodies.spawn({ ...BARREL_BODY, owner: 'not-a-live' }, { x: 0.2, y: 0.49, z: -0.1 });
    tick(ph, bodies, 30);
    expect(plateDown(ph, plate, 1.3, 'any')).toBe(true);
    expect(plateDown(ph, plate, 1.3, 'player')).toBe(false);
    barrel.teleport({ x: 1.6, y: 0.49, z: 0 });              // beside it: 0.9 m past the rim's centre line
    tick(ph, bodies, 5);
    expect(plateDown(ph, plate, 1.3, 'any')).toBe(false);
    const motor = new CharacterMotor(ph, { radius: 0.35, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD', 'ITEM'] });
    const feet = { x: -0.1, y: 0.2, z: 0.2 };
    for (let i = 0; i < 20; i++) { motor.move(feet, { x: 0, y: -0.1, z: 0 }); tick(ph, bodies); }
    expect(plateDown(ph, plate, 1.3, 'player')).toBe(true);
    expect(plateDown(ph, plate, 1.3, 'barrel')).toBe(false); // an owner that isn't the kit's barrel row
    feet.x = -1.5;
    motor.move(feet, { x: 0, y: -0.1, z: 0 }); tick(ph, bodies);
    expect(plateDown(ph, plate, 1.3, 'player')).toBe(false);
  });
});
