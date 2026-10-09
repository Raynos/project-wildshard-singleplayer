// The Well's parts that are models too (E346, models/bridgePosts.ts and laundry.ts): the crossings' stone lamp post and
// lotus-capped balustrade post, and the lower Well's laundry pole and line. The runtime half of the Well
// (../generators/well-bridges.ts, well-lower-life.ts lay it out at build time, baked: ./layoutBake.ts); the models'
// specimens and the layout both build them.
import { Vector3 } from 'three';
import { K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import type { Rng } from '@wildshard/engine/core/rng';

const UP = new Vector3(0, 1, 0);

export const STONE: Look = { wash: 0x66676b, kind: K.stone, line: 1, wet: 0.35, surf: SURF.concrete };

export const STEEL_DK: Look = { wash: 0x26282d, line: 0.7 };

export const CLOTHES = [0xeceae2, 0x6f9ccf, 0xc23b22, 0xd9a441, 0xe8dfc9, 0x2e5fa3, 0x7fbf9a] as const;

/**
 * The stone lamp post (models/bridgePosts.ts `lampPostModel`): a stone post with a lotus cap and an iron crook reaching
 * `out` (+1: +z, −1: −z) — its paper lantern is a paper lantern of its own (the fragment's lantern set)
 */
export function lampPostStone(k: Kit, x: number, y: number, z: number, out: number): void {
  k.box(x, y, z, 0.3, 2.1, 0.3, STONE);
  k.cyl(x, y + 2.1, z, 0.2, 0.14, 0.12, 8, STONE);
  k.beam(new Vector3(x, y + 2.05, z), new Vector3(x, y + 2.05, z + out * 0.55), 0.06, 0.06, STEEL_DK);
}

/**
 * The balustrade's lotus-capped post (models/bridgePosts.ts `lotusPostModel`): a 26 cm stone post, 1.02 m, under a
 * lotus cap and bud — `capped` false on the far crossings (lod 2), where the cap is under a pixel
 */
export function lotusPost(k: Kit, x: number, y: number, z: number, capped: boolean): void {
  k.box(x, y, z, 0.26, 1.02, 0.26, STONE);
  if (capped) {
    k.cyl(x, y + 1.02, z, 0.17, 0.14, 0.1, 8, STONE);
    k.cyl(x, y + 1.12, z, 0.14, 0.02, 0.3, 8, STONE, { caps: false });
  }
}

/** a pole from a (on the wall) to b, things pegged on across `n` (the wall's normal) */
export function laundryPole(k: Kit, rng: Rng, a: Vector3, b: Vector3, n: Vector3): void {
  k.beam(a, b, 0.035, 0.035, { wash: 0x8a7a55, line: 0.6 });
  for (let t = 0.2; t < 0.9; t += rng.range(0.25, 0.4)) {
    const p = a.clone().lerp(b, t);
    const h = rng.range(0.45, 0.9);
    k.quad(p.clone().add(new Vector3(0, -h, 0)), n, UP, rng.range(0.3, 0.5), h, { wash: rng.pick(CLOTHES), kind: K.cloth, row: rng.chance(0.3) ? 1 : 0, col: 0.1, line: 0.6, accent: true });
  }
}

/** the lower Well's laundry line from a to b; false (nothing drawn) when shorter than 0.8 m */
export function laundryLine(k: Kit, rng: Rng, a: Vector3, b: Vector3): boolean {
  const L = a.distanceTo(b);
  if (L < 0.8) return false;
  const sag = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -L * 0.24 * t * (1 - t), 0));
  for (let i = 0; i < 3; i++) k.beam(sag(i / 3), sag((i + 1) / 3), 0.015, 0.015, { wash: 0x2a2c31, line: 0.4 });
  const d = new Vector3().subVectors(b, a).setY(0).normalize();
  for (let t = rng.range(0.05, 0.15); t < 0.88;) {
    const w = rng.range(0.4, 0.9), h = rng.range(0.5, 1.0);
    k.quad(sag(t).add(new Vector3(0, -h, 0)), d, UP, w, h, { wash: rng.pick(CLOTHES), kind: K.cloth, row: rng.chance(0.3) ? 1 : 0, col: 0.12, line: 0.7, accent: true });
    t += (w + rng.range(0.1, 0.35)) / L;
  }
  return true;
}
