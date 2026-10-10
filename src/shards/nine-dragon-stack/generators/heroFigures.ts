// Copied from the hero lab (the dev labs (deleted in E357 F7), round-7-lab-hero) into the clean room.
// The crowd kit (lab P4 "hero", E169; the mahjong table and its stools are ../../generators/figures.ts's). Living things are brushed, never ruled: the figures are
// smooth swept limbs and ellipsoids (KitX) with no ruled face edges — their outline is the post silhouette (and, near
// the eye, the brushed ink hull). Flat washes in the five ink tones for the coats, one skin, a few accent colours
// (a red umbrella, a jade jacket) — the mockups' crowd is dark coats against pale silk.
import { Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { type KitX, type XLook, curve } from '../world/hero/kitx';

const COATS = [0x2a2c31, 0x33363e, 0x3b3f4a, 0x283044, 0x4a4336, 0x55504a, 0x3e4a44, 0x6b6f78, 0x2d2a2a, 0x8a8f96, 0x5b6470] as const;
const TROUSERS = [0x1f2126, 0x2a2c31, 0x34363d, 0x3d3a35] as const;
const SKIN = 0xc9a58a;
const HAIR = [0x1b1b1e, 0x2a2622, 0x8f9097, 0xb9b8b4] as const;

/**
 * E304 / E343 (Jake's pick B): the brushed figures' ink face — the jiehua way of drawing a figure's face in a few strokes:
 * two dark eye dots under two brow strokes, a nose ridge a shade darker than the skin and a short mouth stroke; the cook's
 * face (a bare, pale egg before) reads at the counter. ~90 triangles a figure, merged into the same kit draw (no new draw,
 * no instancing change).
 */
const INK: XLook = { wash: 0x17171a, line: 0 };
const NOSE: XLook = { wash: 0xb08d74, line: 0 };
const LIP: XLook = { wash: 0x8a4a3e, line: 0 };
function inkFace(x: KitX, c: Vector3, R: Vector3, U: Vector3, F: Vector3, s: number): void {
  const at = (r: number, u: number, f: number): Vector3 => c.clone().addScaledVector(R, r * s).addScaledVector(U, u * s).addScaledVector(F, f * s);
  for (const sx of [-1, 1]) {
    x.ellipsoid(at(sx * 0.036, 0.012, 0.094), R, U, F, 0.014 * s, 0.009 * s, 0.006 * s, INK, () => 1, 3, 6);    // eye
    x.ellipsoid(at(sx * 0.038, 0.04, 0.092), R, U, F, 0.022 * s, 0.005 * s, 0.006 * s, INK, () => 1, 3, 6);     // brow
  }
  x.ellipsoid(at(0, -0.018, 0.103), R, U, F, 0.011 * s, 0.024 * s, 0.01 * s, NOSE, () => 1, 3, 6);               // nose
  x.ellipsoid(at(0, -0.058, 0.093), R, U, F, 0.02 * s, 0.005 * s, 0.006 * s, LIP, () => 1, 3, 6);                // mouth
}

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
    inkFace(x, c, R, U, F, s);
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
