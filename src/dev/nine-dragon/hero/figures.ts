// Copied from the hero lab (src/dev/nd-lab/hero/figures.ts, round-7-lab-hero) into the clean room.
// The crowd kit and the mahjong table (lab P4 "hero", E169). Living things are brushed, never ruled: the figures are
// smooth swept limbs and ellipsoids (KitX) with no ruled face edges — their outline is the post silhouette (and, near
// the eye, the brushed ink hull). Flat washes in the five ink tones for the coats, one skin, a few accent colours
// (a red umbrella, a jade jacket) — the mockups' crowd is dark coats against pale silk.
import { Vector3 } from 'three';
import { K, type Kit, type Look } from '../kit';
import type { Rng } from '../util';
import { type KitX, type XLook, curve } from './kitx';

const COATS = [0x2a2c31, 0x33363e, 0x3b3f4a, 0x283044, 0x4a4336, 0x55504a, 0x3e4a44, 0x6b6f78, 0x2d2a2a, 0x8a8f96, 0x5b6470] as const;
const TROUSERS = [0x1f2126, 0x2a2c31, 0x34363d, 0x3d3a35] as const;
const SKIN = 0xc9a58a;
const HAIR = [0x1b1b1e, 0x2a2622, 0x8f9097, 0xb9b8b4] as const;

export type Pose = 'walk' | 'stand' | 'sit' | 'cook';

export interface PersonOpt {
  pose: Pose;
  umbrella?: number | null;
  /** 0..1 stride phase (walkers) */
  stride?: number;
  /** a flat cap / a conical hat / bare */
  hat?: 'cap' | 'cone' | 'none';
  coat?: number;
  long?: boolean;
}

/** one figure at (x, y, z) facing yaw `r` (0 = facing +z) */
export function person(x: KitX, rng: Rng, px: number, py: number, pz: number, r: number, o: PersonOpt): void {
  const cosr = Math.cos(r), sinr = Math.sin(r);
  // local (right, up, forward) → world
  const P = (lx: number, ly: number, lz: number): Vector3 => new Vector3(px + lx * cosr + lz * sinr, py + ly, pz - lx * sinr + lz * cosr);
  const s = rng.range(0.94, 1.05);
  const coat: XLook = { wash: o.coat ?? rng.pick(COATS), line: 0 };
  const trousers: XLook = { wash: rng.pick(TROUSERS), line: 0 };
  const skin: XLook = { wash: SKIN, line: 0 };
  const shoe: XLook = { wash: 0x141417, line: 0 };
  const R = new Vector3(cosr, 0, -sinr), U = new Vector3(0, 1, 0), F = new Vector3(sinr, 0, cosr);
  const limb = (pts: Vector3[], r0: number, r1: number, lk: XLook): void => { x.sweep(curve(pts, 3), (t) => r0 + (r1 - r0) * t, 7, lk, { capStart: true, capEnd: true }); };
  const long = o.long ?? rng.chance(0.45);
  const head = (c: Vector3): void => {
    x.sweep([c.clone().add(new Vector3(0, -0.2 * s, 0)), c.clone().add(new Vector3(0, -0.07 * s, 0))], () => 0.05 * s, 6, skin);
    x.ellipsoid(c, R, U, F, 0.095 * s, 0.115 * s, 0.105 * s, skin, (d) => 1 + (d.z > 0.5 ? 0.04 : 0), 6, 8);
    const hat = o.hat ?? (rng.chance(0.3) ? 'cap' : rng.chance(0.15) ? 'cone' : 'none');
    const hair: XLook = { wash: rng.pick(HAIR), line: 0 };
    if (hat === 'cap') {
      x.ellipsoid(c.clone().add(new Vector3(0, 0.05 * s, 0)), R, U, F, 0.108 * s, 0.07 * s, 0.115 * s, { wash: 0x222428, line: 0 }, (d) => (d.y < 0 ? 0.3 : 1), 5, 10);
      x.ellipsoid(c.clone().add(new Vector3(0, 0.04 * s, 0)).addScaledVector(F, 0.07 * s), R, U, F, 0.09 * s, 0.015 * s, 0.08 * s, { wash: 0x1c1d21, line: 0 }, () => 1, 4, 8);
    } else if (hat === 'cone') {
      x.sweep([c.clone().add(new Vector3(0, 0.03 * s, 0)), c.clone().add(new Vector3(0, 0.2 * s, 0))], (t) => 0.3 * s * (1 - t) + 0.005, 12, { wash: 0xb89a62, line: 1, accent: true }, { capStart: true });
    } else {
      x.ellipsoid(c.clone().add(new Vector3(0, 0.03 * s, -0.01 * s)), R, U, F, 0.1 * s, 0.1 * s, 0.108 * s, hair, (d) => (d.y < -0.1 && d.z > 0 ? 0.2 : 1), 5, 8);
    }
  };
  if (o.pose === 'sit') {
    // on a stool (seat top at 0.45), leaning into the table, forearms on it
    const hip = 0.47;
    for (const sx of [-1, 1]) {
      limb([P(sx * 0.1, hip, -0.02), P(sx * 0.11, hip + 0.02, 0.4 * s)], 0.08 * s, 0.065 * s, trousers);
      limb([P(sx * 0.11, hip + 0.02, 0.4 * s), P(sx * 0.12, 0.08, 0.44 * s)], 0.06 * s, 0.05 * s, trousers);
      x.ellipsoid(P(sx * 0.12, 0.04, 0.5 * s), R, U, F, 0.05, 0.045, 0.12, shoe, () => 1, 4, 8);
    }
    const sh = P(0, hip + 0.55 * s, 0.14 * s);
    limb([P(0, hip, -0.02), P(0, hip + 0.3 * s, 0.06 * s), sh], 0.19 * s, 0.17 * s, coat);
    x.ellipsoid(sh.clone().add(new Vector3(0, 0.02, 0)), R, U, F, 0.23 * s, 0.1 * s, 0.14 * s, coat, () => 1, 5, 10);
    for (const sx of [-1, 1]) {
      const shoulder = sh.clone().addScaledVector(R, sx * 0.2 * s);
      const elbow = P(sx * 0.24 * s, hip + 0.28 * s, 0.34 * s);
      const hand = P(sx * 0.13 * s, hip + 0.3 * s, 0.56 * s);
      limb([shoulder, elbow, hand], 0.062 * s, 0.05 * s, coat);
      x.ellipsoid(hand, R, U, F, 0.04, 0.03, 0.05, skin, () => 1, 4, 6);
    }
    head(sh.clone().add(new Vector3(0, 0.28 * s, 0)).addScaledVector(F, 0.06 * s));
    return;
  }
  const walk = o.pose === 'walk';
  const ph = (o.stride ?? rng.next()) * Math.PI * 2;
  const st = walk ? 0.2 : 0.02;
  const hipY = 0.9 * s;
  for (const sx of [-1, 1]) {
    const sw = Math.sin(ph) * st * sx;
    const knee = P(sx * 0.1, hipY * 0.52, sw * 0.55 + (walk ? 0.03 : 0));
    const ankle = P(sx * 0.1, 0.08, sw);
    limb([P(sx * 0.1, hipY, 0), knee, ankle], 0.078 * s, 0.052 * s, trousers);
    x.ellipsoid(ankle.clone().add(new Vector3(0, -0.04, 0)).addScaledVector(F, 0.05), R, U, F, 0.05, 0.045, 0.12, shoe, () => 1, 4, 8);
  }
  const lean = o.pose === 'cook' ? 0.08 : walk ? 0.04 : 0;
  const sh = P(0, 1.42 * s, lean);
  // the coat: a long A-line or a short jacket, then the shoulders
  if (long) x.sweep(curve([P(0, 0.45 * s, lean * 0.2), P(0, 0.95 * s, lean * 0.5), sh], 3), (t) => (0.25 - 0.06 * t) * s, 10, coat, { capStart: true, flat: 0.8 });
  else x.sweep(curve([P(0, 0.8 * s, 0), P(0, 1.1 * s, lean * 0.6), sh], 3), (t) => (0.205 - 0.03 * t) * s, 10, coat, { capStart: true, flat: 0.8 });
  x.ellipsoid(sh.clone().add(new Vector3(0, 0.03, 0)), R, U, F, 0.23 * s, 0.1 * s, 0.14 * s, coat, () => 1, 5, 10);
  for (const sx of [-1, 1]) {
    const shoulder = sh.clone().addScaledVector(R, sx * 0.21 * s);
    const umb = o.umbrella !== undefined && o.umbrella !== null && sx > 0;
    const sw = -Math.sin(ph) * st * sx * 0.8;
    const elbow = umb ? P(sx * 0.26 * s, 1.14 * s, 0.14) : o.pose === 'cook' ? P(sx * 0.24 * s, 1.1 * s, 0.2) : P(sx * 0.26 * s, 1.1 * s, sw * 0.5);
    const hand = umb ? P(sx * 0.12 * s, 1.3 * s, 0.26) : o.pose === 'cook' ? P(sx * 0.14 * s, 1.08 * s, 0.45) : P(sx * 0.27 * s, 0.82 * s, sw);
    limb([shoulder, elbow, hand], 0.062 * s, 0.05 * s, coat);
    x.ellipsoid(hand, R, U, F, 0.04, 0.045, 0.04, skin, () => 1, 4, 6);
  }
  if (o.pose === 'cook') {
    x.sweep([P(0, 0.62 * s, 0.2 * s), P(0, 1.15 * s, 0.2 * s)], () => 0.2 * s, 8, { wash: 0xe9e5da, line: 0 }, { flat: 0.15, up: F });
  }
  head(sh.clone().add(new Vector3(0, 0.27 * s, 0)).addScaledVector(F, 0.03 * s));
  if (o.umbrella !== undefined && o.umbrella !== null) {
    const top = P(0.08 * s, 2.08 * s, 0.12);
    const hand = P(0.12 * s, 1.3 * s, 0.26);
    x.sweep([hand.clone().add(new Vector3(0, -0.1, 0)), top.clone().add(new Vector3(0, 0.12, 0))], () => 0.012, 4, { wash: 0x1c1c1f, line: 0 });
    // a ribbed canopy: a shallow dome with the rib tips dipping
    x.ellipsoid(top, R, U, F, 0.62, 0.26, 0.62, { wash: o.umbrella, line: 0, accent: true },
      (d) => (d.y < 0.05 ? 0.0 : 1 - 0.07 * Math.abs(Math.sin(Math.atan2(d.z, d.x) * 4))), 5, 16);
  }
}

/** a plastic stool (the concept's blue-grey / red), seat top at 0.45 */
export function stool(k: Kit, x: KitX, px: number, py: number, pz: number, r: number, wash: number): void {
  const lk: Look = { wash, line: 0.8, accent: true };
  k.box(px, py + 0.4, pz, 0.36, 0.05, 0.36, lk, { rotY: r });
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const c = Math.cos(r), s = Math.sin(r);
    const ox = (lx * c + lz * s) * 0.15, oz = (-lx * s + lz * c) * 0.15;
    x.sweep([new Vector3(px + ox * 1.25, py, pz + oz * 1.25), new Vector3(px + ox, py + 0.41, pz + oz)], () => 0.025, 5, { wash, line: 0, accent: true });
  }
}

/** where the four seats of a mahjong table are: stool centre and the yaw that faces the table */
export function mahjongSeats(px: number, pz: number, r: number): { x: number; z: number; yaw: number }[] {
  return [0, 1, 2, 3].map((side) => {
    const a = r + (side * Math.PI) / 2;
    return { x: px + Math.sin(a) * -0.78, z: pz + Math.cos(a) * -0.78, yaw: a };
  });
}

/** a mahjong table: a wooden frame, green felt, four walls of tiles, a few discards, four stools and up to 4 players */
export function mahjong(k: Kit, x: KitX, rng: Rng, px: number, py: number, pz: number, r: number, players: number, stoolWash: number, stools = true): void {
  const c = Math.cos(r), s = Math.sin(r);
  const at = (lx: number, lz: number): [number, number] => [px + lx * c + lz * s, pz - lx * s + lz * c];
  k.box(px, py + 0.7, pz, 0.98, 0.07, 0.98, { wash: 0x5a3a26, line: 1, accent: true }, { rotY: r, top: { wash: 0x2f6a4c, line: 1, accent: true } });
  for (const [lx, lz] of [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]] as const) {
    const [ax, az] = at(lx, lz);
    k.box(ax, py, az, 0.06, 0.7, 0.06, { wash: 0x3d2a1e, line: 0.6 }, { rotY: r });
  }
  const tile: Look = { wash: 0xefe8d6, line: 0.6, accent: true };
  const back: Look = { wash: 0x3c8a64, line: 0.6, accent: true };
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // a two-high wall of 9 tiles along this side
    for (let i = 0; i < 9; i++) {
      const lx = -0.28 + i * 0.07, lz = 0.3;
      const wx = px + lx * ca + lz * sa, wz = pz - lx * sa + lz * ca;
      k.box(wx, py + 0.77, wz, 0.062, 0.05, 0.042, i % 3 === 0 ? back : tile, { rotY: a });
    }
    // the player's standing hand, facing them
    for (let i = 0; i < 7; i++) {
      const lx = -0.2 + i * 0.066, lz = 0.4;
      const wx = px + lx * ca + lz * sa, wz = pz - lx * sa + lz * ca;
      k.box(wx, py + 0.77, wz, 0.058, 0.075, 0.035, tile, { rotY: a });
    }
    for (let i = 0; i < 3; i++) {
      const lx = rng.range(-0.18, 0.18), lz = rng.range(-0.1, 0.18);
      const wx = px + lx * ca + lz * sa, wz = pz - lx * sa + lz * ca;
      k.box(wx, py + 0.77, wz, 0.06, 0.02, 0.08, { ...tile, kind: K.plain }, { rotY: a + rng.range(-0.4, 0.4) });
    }
  }
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const [sx, sz] = [px + Math.sin(a) * -0.78, pz + Math.cos(a) * -0.78];
    if (stools) stool(k, x, sx, py, sz, a, stoolWash);
    if (side < players) person(x, rng, sx, py, sz, a, { pose: 'sit', hat: rng.chance(0.4) ? 'cap' : 'none' });
  }
}
