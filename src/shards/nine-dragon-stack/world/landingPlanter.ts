// The landings' stone planter (stairstreet-upper.ts's C2, E281), the runtime half: the planter model's specimen builds it
// (../models/landingPlanter.ts) and the stair's layout (../generators/stairstreet-upper.ts) draws its eight copies into the
// terraces' kit, with the leaves, colours and stone it shares with the rest of the stair.
import { Color, IcosahedronGeometry, Vector3 } from 'three';
import { K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import type { Rng } from '@wildshard/engine/core/rng';

const UP = new Vector3(0, 1, 0);

export const ASHLAR: Look = { wash: 0x7a7872, kind: K.stone, line: 1, wet: 0.5, surf: SURF.stone };

export const COPING: Look = { wash: 0x8a877f, kind: K.stone, line: 1.8, wet: 0.5 };

export const LEAF_COLS = [0x3f6a3e, 0x4f7a44, 0x355a3a, 0x5a8a4a, 0x2f5236] as const;

export const FLOWER_COLS = [0xf2eee4, 0xe98aa8, 0xd9443a, 0xf0c86a] as const;

/** the plants' dark cores and the flowers (a low icosphere) */
export const ICO0 = Array.from(new IcosahedronGeometry(1, 0).getAttribute('position').array);

export const tint = (c: number, t: number): number => new Color(c).multiplyScalar(t).getHex();

/** one leaf from `base` along `dir` (unit), its blade spread along `side` (unit, ⟂ dir); both faces */
export function leafQuad(k: Kit, base: Vector3, dir: Vector3, side: Vector3, L: number, W: number, look: Look): void {
  const mid = base.clone().addScaledVector(dir, L * 0.42);
  const a = base, c = base.clone().addScaledVector(dir, L);
  const b = mid.clone().addScaledVector(side, W / 2), d = mid.clone().addScaledVector(side, -W / 2);
  k.quad4(a, b, c, d, W, L, look);
  k.quad4(a, d, c, b, W, L, look);
}

export const leafLook = (rng: Rng, lift: number): Look => ({ wash: tint(rng.pick(LEAF_COLS), rng.range(0.8, 1.1) * (0.82 + 0.35 * lift)), line: 0.55, wet: 0.35 });

/** a bush of `n` leaves round (cx, cy, cz), radius `r`: leaves fan out and up from a dark core */
export function leafBush(k: Kit, rng: Rng, cx: number, cy: number, cz: number, r: number, n: number, phi: readonly [number, number] = [0.15, 1.25], narrow = 0.42): void {
  k.blob(ICO0, null, cx, cy, cz, r * 0.5, r * 0.42, r * 0.5, { wash: 0x243a26, line: 0 }, true);
  for (let i = 0; i < n; i++) {
    const th = rng.range(0, Math.PI * 2), ph = rng.range(phi[0], phi[1]);
    const dir = new Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    const base = new Vector3(cx, cy, cz).addScaledVector(new Vector3(dir.x, 0, dir.z), r * rng.range(0.1, 0.35)).add(new Vector3(0, rng.range(-0.3, 0.2) * r, 0));
    const side = new Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(dir, rng.range(-0.7, 0.7));
    const L = r * rng.range(0.6, 0.95);
    leafQuad(k, base, dir, side, L, L * narrow, leafLook(rng, Math.sin(ph)));
  }
}

/** a planter's size (w along the landing, d out from its wall) */
export const PLANTER = { w: 1.1, d: 0.5 } as const;

/** a stone planter in flower at (x, y, z): an ashlar trough, its coping, three leafy bushes, a spray of one flower's colour */
export function landingPlanter(k: Kit, rng: Rng, p: { readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly d: number }): void {
  k.box(p.x, p.y, p.z, p.w, 0.5, p.d, { ...ASHLAR, wash: 0x6f6d68 }, { top: { wash: 0x2e2a24, line: 0 } });
  k.box(p.x, p.y + 0.5, p.z, p.w + 0.08, 0.07, p.d + 0.08, COPING);
  for (let j = 0; j < 3; j++) leafBush(k, rng, p.x + (j - 1) * p.w * 0.3, p.y + 0.62, p.z, rng.range(0.26, 0.36), 26);
  const fc = rng.pick(FLOWER_COLS);
  for (let j = 0; j < 9; j++) k.blob(ICO0, null, p.x + rng.range(-p.w / 2, p.w / 2) * 0.85, p.y + rng.range(0.75, 0.95), p.z + rng.range(-0.12, 0.12), 0.035, 0.028, 0.035, { wash: fc, line: 0, accent: true, emit: 0.05 });
}
