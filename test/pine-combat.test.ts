import { describe, expect, it } from 'vitest';
import {
  KING_PHASE_AT, kingPhaseAt, ringCatches, inLane, inArc, behindPlayer, fleeHeading, fadeCooldown, bugleHour, burnTick,
  boltHitStop, wallPush, headingTo, wrapAngle,
} from '../src/pinehollow/combatMath';

// Pine Hollow's fight rules (src/pinehollow/combatMath.ts: PH-C2 the Antler King, PH-C3 the elites, PH-F1 the feel)

describe('the Antler King phases', () => {
  it('starts I at full, II at 60 %, III at 30 %', () => {
    expect(KING_PHASE_AT).toEqual([1, 0.6, 0.3]);
    expect(kingPhaseAt(1)).toBe(0);
    expect(kingPhaseAt(0.61)).toBe(0);
    expect(kingPhaseAt(0.6)).toBe(1);
    expect(kingPhaseAt(0.31)).toBe(1);
    expect(kingPhaseAt(0.3)).toBe(2);
    expect(kingPhaseAt(0)).toBe(2);
  });
});

describe('the root-ring stomp', () => {
  it('catches you standing on the ring, not inside or outside it', () => {
    expect(ringCatches(10, 10.5, 0.9, false)).toBe(true);
    expect(ringCatches(8, 10.5, 0.9, false)).toBe(false);
    expect(ringCatches(12, 10.5, 0.9, false)).toBe(false);
  });
  it('a jump clears it', () => { expect(ringCatches(10, 10, 0.9, true)).toBe(false); });
});

describe('lanes and arcs', () => {
  it('a lane holds its width along its length and stops at its ends', () => {
    expect(inLane(0, 5, 0, 0, 0, 10, 1.2)).toBe(true);
    expect(inLane(1.1, 5, 0, 0, 0, 10, 1.2)).toBe(true);
    expect(inLane(1.3, 5, 0, 0, 0, 10, 1.2)).toBe(false);
    expect(inLane(0, 10.5, 0, 0, 0, 10, 1.2)).toBe(false);
    expect(inLane(0, -0.5, 0, 0, 0, 10, 1.2)).toBe(false);
  });
  it('an arc is the heading ± arc inside the reach (heading faces (sin yaw, cos yaw))', () => {
    expect(inArc(0, 0, 0, 0, 5, 0.5, 6)).toBe(true);           // dead ahead (+z)
    expect(inArc(0, 0, 0, 0, -5, 0.5, 6)).toBe(false);         // behind
    expect(inArc(0, 0, Math.PI / 2, 5, 0, 0.5, 6)).toBe(true); // yaw π/2 faces +x
    expect(inArc(0, 0, 0, 0, 7, 0.5, 6)).toBe(false);          // out of reach
  });
  it('headings and angles', () => {
    expect(headingTo(0, 0, 0, 10)).toBeCloseTo(0);
    expect(headingTo(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('the Ghost Stag', () => {
  it('comes back BEHIND the player (the player faces (−sin yaw, −cos yaw))', () => {
    const q = behindPlayer(0, 0, 0, 15);          // yaw 0 looks down −z: behind is +z
    expect(q.x).toBeCloseTo(0); expect(q.z).toBeCloseTo(15);
    const r = behindPlayer(0, 0, Math.PI, 15);    // yaw π looks down +z: behind is −z
    expect(r.z).toBeCloseTo(-15);
  });
  it('flees away from you near its lair, and turns along the circle near its leash', () => {
    // at the lair, the player to the south: straight north
    expect(fleeHeading(0, 0, 0, -10, 0, 0, 60)).toBeCloseTo(0, 5);
    // at the leash edge, fleeing further out: the heading has turned well off straight away
    const h = fleeHeading(0, 58, 0, 48, 0, 0, 60);
    expect(Math.abs(wrapAngle(h))).toBeGreaterThan(0.8);
  });
  it('fades more often in phase 2', () => { expect(fadeCooldown(true)).toBeLessThan(fadeCooldown(false)); });
});

describe('the Imperial Bull bugles at dusk and by night only', () => {
  it('reads PineDayNight 0..1', () => {
    expect(bugleHour(0, 0)).toBe(false);
    expect(bugleHour(0.8, 0)).toBe(true);
    expect(bugleHour(0, 1)).toBe(true);
  });
});

describe('a fallen lantern burns in bites', () => {
  it('one bite per `every` seconds inside, reset outside', () => {
    let s = { acc: 0, bites: 0 }, bites = 0;
    for (let i = 0; i < 100; i++) { s = burnTick(s.acc, 0.02, true, 0.8); bites += s.bites; }
    expect(bites).toBe(2);                         // 2.0 s inside → 2 bites
    expect(burnTick(0.7, 0.02, false, 0.8)).toEqual({ acc: 0, bites: 0 });
  });
});

describe('the feel', () => {
  it('hit-stop grows body → head → kill and stays under the sword’s', () => {
    expect(boltHitStop(false, false)).toBeLessThan(boltHitStop(true, false));
    expect(boltHitStop(true, false)).toBeLessThan(boltHitStop(false, true));
    expect(boltHitStop(true, true)).toBeLessThan(0.14);
  });
  it('the arena wall pushes only past its face, harder further out', () => {
    expect(wallPush(20, 27.5)).toBe(0);
    expect(wallPush(28, 27.5)).toBeGreaterThan(0);
    expect(wallPush(30, 27.5)).toBeGreaterThan(wallPush(28, 27.5));
  });
});
