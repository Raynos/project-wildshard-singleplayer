// The Yamen Well below the fragment's cut (dome D2, E169): what the view down the shaft ends in.
//   ghost levels  below LOW the galleries go on as far-LOD shells — a deck slab, its dark lip, a rail line, a lit
//                 window or two and a lantern per run, a room hung out now and then — level after level into the
//                 mist (a few hundred triangles a floor), so the canyon never stops at a flat cut,
//   the temple    a rock spur rising out of the deep with a small temple on it: a stone terrace, red columns, lit
//                 doors, a two-tier green-glazed roof, dark trees round it and a ring of lanterns — the glow the
//                 mockup's view down ends on, dissolving in the silk.
import { IcosahedronGeometry, Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import { Rng } from '../util';
import { FLOOR_H } from './well-galleries';
import { figure, kitLantern, litLantern, lowWin } from './well-lower-life';

const UP = new Vector3(0, 1, 0);

/** a wall that carries ghost levels: its start, outward normal, length, depth range, wash */
export interface GhostWall { p0: Vector3; n: Vector3; len: number; dMin: number; dMax: number; wash: number; g0?: number; g1?: number }

/**
 * The farthest LOD: from yTop down `floors` floors, each run of wall gets only a deck slab (its top, lip and
 * underside: 6 tris), a lit room or two (interior-mapped quads) and now and then a lantern or a room hung out — the
 * level lines going on into the silk. The runs sit `extra` m further out than the wall's galleries (the narrowing gap).
 */
export function ghostLevels(ctx: Ctx, kit: (y: number) => Kit, W: GhostWall, yTop: number, floors: number, extra: number, seed: number, cap: (u: number, y: number) => number = () => 99): void {
  const rng = new Rng(seed);
  const n = W.n.clone().setY(0).normalize();
  const u = new Vector3().crossVectors(UP, n).normalize();
  const world = (uu: number, y: number, d: number): Vector3 => W.p0.clone().setY(y).addScaledVector(u, uu).addScaledVector(n, d);
  const runs: { u0: number; u1: number; d: number }[] = [];
  const end = W.len - (W.g1 ?? 0);
  for (let s = W.g0 ?? 0; s < end - 0.5;) {
    let L = rng.range(5, 11);
    if (end - s - L < 3.5) L = end - s;
    runs.push({ u0: s, u1: s + L, d: rng.range(W.dMin, W.dMax) + extra * rng.range(0.4, 1) });
    s += L;
  }
  for (let f = 0; f < floors; f++) {
    const y = yTop - f * FLOOR_H;
    const k = kit(y);
    const t = f / Math.max(1, floors - 1);
    for (const r of runs) {
      if (rng.chance(0.2)) r.d = Math.min(W.dMax + extra, Math.max(W.dMin, r.d + rng.pick([-1.2, -0.8, 0.8, 1.2])));
      if (rng.chance(0.1)) continue;
      const L = r.u1 - r.u0, d = Math.min(r.d, cap(r.u0, y), cap(r.u1, y), cap((r.u0 + r.u1) / 2, y));
      const concrete = rng.chance(0.55);
      k.boxAxes(world((r.u0 + r.u1) / 2, y - 0.14, d / 2), u, UP, n, L / 2, 0.14, d / 2,
        concrete ? { wash: 0x8a8f97, line: 1.8, surf: SURF.concrete } : { wash: 0x564a40, line: 1.8, surf: SURF.wood },
        { top: concrete ? { wash: 0x61646b, line: 0 } : { wash: 0x6b635b, line: 0 }, bottom: { wash: 0x4d4f55, line: 1 }, sides: 4 });
      const nw = rng.int(1, Math.max(1, Math.round(L / 3.5)));
      for (let i = 0; i < nw; i++) lowWin(ctx, rng, world(rng.range(r.u0 + 0.8, r.u1 - 0.8), y + 0.4, 0.01), u, n, rng.range(1.2, 2.0), rng.chance(0.4) ? 2.1 : 1.4, W.wash, false, 0.7 - 0.3 * t);
      if (rng.chance(0.4 - 0.25 * t)) {
        const p = world(rng.range(r.u0 + 0.6, r.u1 - 0.6), y + 2.3, d - 0.3);
        kitLantern(k, p.x, p.y, p.z, 0.9);
      }
      if (L > 4 && rng.chance(0.2) && d + 2.4 < cap(r.u0, y) && d + 2.4 < cap(r.u1, y)) {
        const w = rng.range(2.4, Math.min(4.2, L - 1)), ua = rng.range(r.u0 + 0.4, r.u1 - 0.4 - w), out = rng.range(1.2, 2.4);
        k.boxAxes(world(ua + w / 2, y + 1.1, d + out / 2 - 0.05), u, UP, n, w / 2, 1.28, out / 2 + 0.05, { wash: rng.pick([0x8a8378, 0x7c7f86, 0x6f5a46, 0x7e8a86]), kind: K.facade, row: FLOOR_H, col: 2.4, seed: rng.range(0, 90), line: 1 },
          { top: { wash: rng.pick([0x5c6168, 0x7c6a58, 0x6f747c]), kind: K.tiles, line: 1 }, sides: 1 | 2 | 4 });
      }
    }
  }
}

/** a hip roof over a w × d rectangle centred at c (eave height c.y), rising `rise`, overhanging `over` */
function hipRoof(k: Kit, c: Vector3, w: number, d: number, rise: number, over: number, tile: number): void {
  const hw = w / 2 + over, hd = d / 2 + over, ridge = Math.max(0.3, hw - hd);
  const e = [new Vector3(c.x - hw, c.y, c.z + hd), new Vector3(c.x + hw, c.y, c.z + hd), new Vector3(c.x + hw, c.y, c.z - hd), new Vector3(c.x - hw, c.y, c.z - hd)] as const;
  const r0 = new Vector3(c.x - ridge, c.y + rise, c.z), r1 = new Vector3(c.x + ridge, c.y + rise, c.z);
  const look: Look = { wash: tile, kind: K.tiles, row: 0.32, col: 0.28, line: 1, accent: true };
  const slantS = Math.hypot(hd, rise);
  // the long slopes (front: south +z, back: north −z), the hips (two triangles)
  k.quad4(e[0], e[1], r1, r0, 2 * hw, slantS, look, 0, 0, E.v0);
  k.quad4(e[2], e[3], r0, r1, 2 * hw, slantS, look, 0, 0, E.v0);
  k.tri(e[1], e[2], r1, look);
  k.tri(e[3], e[0], r0, look);
  // the ridge and the undersides (seen from below: a dark soffit)
  k.beam(r0.clone().add(new Vector3(-0.2, 0.08, 0)), r1.clone().add(new Vector3(0.2, 0.08, 0)), 0.18, 0.18, { wash: 0x9c2418, line: 1, accent: true });
  const soffit: Look = { wash: 0x3a2e26, line: 0.6 };
  k.quad4(r0, r1, e[1], e[0], 2 * hw, slantS, soffit, 0, 0, E.none);
  k.quad4(r1, r0, e[3], e[2], 2 * hw, slantS, soffit, 0, 0, E.none);
  // the eave board, ochre-and-green
  for (let i = 0; i < 4; i++) {
    const a = e[i], b = e[(i + 1) % 4];
    if (a === undefined || b === undefined) continue;
    k.beam(a.clone().add(new Vector3(0, -0.08, 0)), b.clone().add(new Vector3(0, -0.08, 0)), 0.1, 0.16, { wash: 0x6fae8c, line: 1, accent: true });
  }
}

/**
 * The temple on its rock spur: the spur from `yBase` up to the terrace at `top`, centred at (x, z), radius r. Its
 * lanterns are kit ones with baked emitters (they light the terrace's pool without the paper mesh's triangles).
 */
export function deepTemple(ctx: Ctx, k: Kit, x: number, z: number, yBase: number, top: number, r: number): void {
  const rng = new Rng(7117);
  // the spur: a rough column, wider at its foot, ruled only at its rims (a lathe of irregular radii)
  const prof: [number, number][] = [];
  const H = top - yBase;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push([r * (1.15 - 0.35 * Math.sin(t * Math.PI * 0.9) + rng.range(-0.08, 0.08)) * (t > 0.95 ? 1.04 : 1), t * H - 0.6]);
  }
  k.lathe(x, yBase, z, prof, 9, { wash: 0x5f5b55, kind: K.stone, line: 1 }, true, 3);
  // the terrace: a flagged disc with a stone lip
  k.cyl(x, top - 0.6, z, r * 1.05, r * 1.05, 0.6, 14, { wash: 0x7c7870, line: 1.8, surf: SURF.stone }, { caps: false });
  k.cyl(x, top, z, r * 1.05, r * 1.05, 0.001, 14, { wash: 0x6a6760, kind: K.flag, line: 0, wet: 0.6 });
  // the hall: 6 × 4.2 m, red columns, lit doors all round, a two-tier glazed roof
  const hw = 3, hd = 2.1, hy = top;
  k.box(x, hy, z, 2 * hw + 0.8, 0.45, 2 * hd + 0.8, { wash: 0x8a857c, line: 1.8, surf: SURF.stone });
  const base = hy + 0.45;
  k.box(x, base, z, 2 * hw - 0.3, 2.6, 2 * hd - 0.3, { wash: 0x7e1e1a, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer }, { top: null, bottom: null });
  for (let i = -2; i <= 2; i++) {
    for (const s of [-1, 1]) {
      k.cyl(x + i * (hw / 2.1), base, z + s * hd, 0.16, 0.14, 2.7, 6, { wash: 0xa8341f, line: 1, accent: true, surf: SURF.lacquer }, { caps: false });
    }
  }
  // glowing lattice doors on the south and north faces, windows on the ends
  for (const s of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const p = new Vector3(x + i * 1.7, base + 0.05, z + s * (hd - 0.14));
      k.quad(p.clone().add(new Vector3(-0.6 * s, 0, 0)), new Vector3(s, 0, 0), UP, 1.2, 2.2, { wash: 0xffc98a, emit: 1.25, kind: K.bars, row: 0.35, col: 0.22, line: 1, accent: true });
    }
    k.quad(new Vector3(x + s * (hw - 0.14), base + 0.9, z + 0.7 * s), new Vector3(0, 0, -s), UP, 1.4, 1.1, { wash: 0xffbf78, emit: 1.1, kind: K.bars, row: 0.3, col: 0.3, line: 1, accent: true });
  }
  hipRoof(k, new Vector3(x, base + 2.75, z), 2 * hw, 2 * hd, 1.1, 0.9, 0x2f8a6a);
  k.box(x, base + 3.3, z, 2 * hw - 1.4, 0.9, 2 * hd - 1.2, { wash: 0x7e1e1a, kind: K.panel, line: 1, accent: true }, { top: null, bottom: null });
  hipRoof(k, new Vector3(x, base + 4.1, z), 2 * hw - 1.6, 2 * hd - 1.2, 1.3, 0.7, 0x2f8a6a);
  // the incense burner, the path, the lanterns (paper ones on posts, their pools light the terrace)
  k.cyl(x, top, z + hd + 2.2, 0.45, 0.55, 0.9, 8, { wash: 0x3a3d44, line: 1 });
  k.box(x, top + 0.9, z + hd + 2.2, 1.1, 0.35, 1.1, { wash: 0x2a2c31, line: 1 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const p = new Vector3(x + Math.cos(a) * r * 0.86, top, z + Math.sin(a) * r * 0.86);
    k.beam(p, p.clone().add(new Vector3(0, 2.1, 0)), 0.1, 0.1, { wash: 0x7e1e1a, line: 1, accent: true });
    litLantern(ctx, k, p.clone().setY(p.y + 2.1), 1.1, true);
  }
  // the trees round it: dark round crowns on short trunks (brush-round, never ruled)
  const ico = new IcosahedronGeometry(1, 1);
  const pos = ico.getAttribute('position').array;
  const leaf: Look = { wash: 0x2e5a3f, kind: K.leaf, line: 0, accent: true };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
    if (Math.abs(Math.sin(a)) > 0.85 && Math.sin(a) > 0) continue; // keep the south approach open
    const rr = r * rng.range(0.62, 0.8);
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const s = rng.range(1.5, 2.3);
    k.limb(new Vector3(px, top, pz), new Vector3(px, top + 1.4, pz), 0.18, 0.12, 5, { wash: 0x3a2e26, line: 0 });
    k.blob(pos, null, px, top + 1.2 + s, pz, s, s * 0.85, s, { ...leaf, wash: rng.pick([0x2e5a3f, 0x3d6b48, 0x27503a]) }, true);
  }
  // monks / pilgrims on the terrace
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, Math.PI * 2);
    figure(k, rng, new Vector3(x + Math.cos(a) * rng.range(3.6, 4.6), top, z + Math.sin(a) * rng.range(3.0, 3.8)), new Vector3(-Math.cos(a), 0, -Math.sin(a)));
  }
  // a stair down the spur's south face, lanterns along it
  for (let i = 0; i < 10; i++) {
    const y = top - 0.6 - i * 0.6;
    const zz = z + r * 1.04 + 0.4 + i * 0.1;
    k.box(x + 1.6 - i * 0.35, y - 0.3, zz, 1.2, 0.3, 0.9, { wash: 0x6f6b64, line: 1.8, surf: SURF.stone });
    if (i % 3 === 1) kitLantern(k, x + 1.0 - i * 0.35, y + 1.2, zz + 0.4, 0.8);
  }
}
