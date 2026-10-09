// The hero lab's mahjong table and its stools (lab P4 "hero", E169), layout-only: the square and the stair seat their
// TRELLIS sitters by `mahjongSeats`; the brushed figures themselves are ../world/hero/figures.ts's.
import { Vector3 } from 'three';
import { K, type Kit, type Look } from '../world/kit';
import type { Rng } from '@wildshard/engine/core/rng';
import type { KitX } from '../world/hero/kitx';
import { person } from '../world/hero/figures';

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
