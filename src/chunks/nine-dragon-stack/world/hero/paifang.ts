// Copied from the hero lab (src/dev/nd-lab/hero/paifang.ts, round-7-lab-hero) into the clean room.
// The paifang (lab P4 "hero", E169): the cinnabar three-bay gate of Lantern Square, built ruled (jiehua) and rich enough to
// carry the frame the way the mockups' gate does. What reads in the targets (round-6 style A, round-4 A) and is here:
// - CURVED roofs: a concave slope (flat at the eave, steep at the ridge), the eave sagging to the middle and flying up at
//   the four corners (翼角起翘), a thick eave edge, hip ridges that end in a curl, chiwen curling up off the main ridge;
// - glazed malachite tiles with ruled courses (the Kit's `tiles` pattern, continuous across the curved grid);
// - painted eaves: an azurite soffit, a row of rafter ends in blue / green / gold under every eave;
// - dougong brackets on every lintel, sparrow braces (雀替) in gold at each post-lintel joint;
// - cinnabar posts on stone plinths with drum stones (抱鼓石), a black-and-gold plaque, couplets, hanging lanterns.
// Signs go through the clean room's SignBuilder (plaque + couplets); lanterns through a callback (ctx.lantern).
import { Vector3 } from 'three';
import { E, K, type Kit, type Look } from '../kit';
import type { SignBuilder } from '../../look/signs';
import { type KitX, curve } from './kitx';

export interface PaifangSpec {
  /** centre of the gate on the ground */
  x: number;
  y: number;
  z: number;
  /** the four post x positions (world), west to east */
  posts: readonly [number, number, number, number];
  /** height scale (1 = the centre bay's posts 6.4 m to the lintel top) */
  s: number;
  plaque: string;
  couplets: readonly [string, string];
  /** red neon along the eaves (round-4 A / concept 03), off in round-6 A */
  neonEaves: number | null;
}

const CINNABAR: Look = { wash: 0x9c3627, line: 1, accent: true };
const CIN_DARK: Look = { wash: 0x8e2217, line: 1, accent: true };
const STONE: Look = { wash: 0x7c7b7e, line: 1 };
const STONE_PANEL: Look = { wash: 0x85848a, kind: K.panel, line: 1 };
const GOLD: Look = { wash: 0xd2a347, line: 1, accent: true, gloss: true };
const AZURITE: Look = { wash: 0x2e5fa3, line: 1, accent: true };
const MALACHITE: Look = { wash: 0x2f8a6a, line: 1, accent: true };
const LIGHT_MAL: Look = { wash: 0x6fae8c, line: 1, accent: true };
const TILE = 0x245f4c;
const RIDGE: Look = { wash: 0x1d4a3b, line: 1, accent: true };

export interface RoofSpec { cx: number; y0: number; cz: number; w: number; d: number; h: number; lift: number; flare: number; tile: number; neon: number | null }

/**
 * A curved hip roof. The four hip lines run from the flying eave corners (lifted by `lift`, pushed out by `flare`) to
 * the ridge ends; each slope is a grid between two hips, sagged back down in the middle of the eave. Seams match
 * because both slopes at a hip evaluate the same hip curve.
 */
export function curvedRoof(k: Kit, x: KitX, signs: SignBuilder | null, r: RoofSpec): void {
  const W = r.w / 2, D = r.d / 2, R = Math.max(0.2, W - D);
  const prof = (v: number): number => r.h * v ** 1.65;
  const hip = (sx: number, sz: number, v: number): Vector3 => {
    const e = (1 - v) ** 2;
    return new Vector3(r.cx + sx * ((W + (R - W) * v) + r.flare * e), r.y0 + prof(v) + r.lift * e, r.cz + sz * ((D - D * v) + r.flare * e));
  };
  const sagY = (u: number, v: number): number => r.lift * (1 - v) ** 2 * (1 - Math.abs(2 * u - 1) ** 2.4);
  const sagOut = (u: number, v: number): number => r.flare * (1 - v) ** 2 * (1 - Math.abs(2 * u - 1) ** 2.4);
  const NU = 10, NV = 6;
  const tl: Look = { wash: r.tile, kind: K.tiles, line: 1, accent: true };
  // one slope: `a` and `b` are the hips it spans (as functions of v), `out` its outward horizontal axis
  const slope = (a: (v: number) => Vector3, b: (v: number) => Vector3, out: Vector3): Vector3[][] => {
    const P: Vector3[][] = [];
    for (let j = 0; j <= NV; j++) {
      const row: Vector3[] = [];
      const v = j / NV;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const p = a(v).lerp(b(v), u);
        p.y -= sagY(u, v);
        p.addScaledVector(out, -sagOut(u, v));
        row.push(p);
      }
      P.push(row);
    }
    let vo = 0;
    for (let j = 0; j < NV; j++) {
      let uo = 0;
      const r0 = P[j] ?? [], r1 = P[j + 1] ?? [];
      const hgt = ((r0[NU / 2] ?? new Vector3()).distanceTo(r1[NU / 2] ?? new Vector3()));
      for (let i = 0; i < NU; i++) {
        const p00 = r0[i], p10 = r0[i + 1], p11 = r1[i + 1], p01 = r1[i];
        if (p00 === undefined || p10 === undefined || p11 === undefined || p01 === undefined) continue;
        const w = Math.max(p00.distanceTo(p10), 1e-3);
        const edges = (j === 0 ? E.v0 : 0) | (i === 0 ? E.u0 : 0) | (i === NU - 1 ? E.u1 : 0);
        k.quad4(p00, p10, p11, p01, w, Math.max(hgt, 1e-3), tl, uo, vo, edges);
        uo += w;
      }
      vo += hgt;
    }
    return P;
  };
  const front = slope((v) => hip(-1, 1, v), (v) => hip(1, 1, v), new Vector3(0, 0, 1));
  const back = slope((v) => hip(1, -1, v), (v) => hip(-1, -1, v), new Vector3(0, 0, -1));
  const east = slope((v) => hip(1, 1, v), (v) => hip(1, -1, v), new Vector3(1, 0, 0));
  const west = slope((v) => hip(-1, -1, v), (v) => hip(-1, 1, v), new Vector3(-1, 0, 0));
  // the eave edge (a thick band under each slope's bottom row), the soffit, the rafter ends
  const eaveT = 0.2 * (r.h / 1.6);
  for (const P of [front, back, east, west]) {
    const e = P[0] ?? [];
    for (let i = 0; i < NU; i++) {
      const a = e[i], b = e[i + 1];
      if (a === undefined || b === undefined) continue;
      const a2 = a.clone().add(new Vector3(0, -eaveT, 0)), b2 = b.clone().add(new Vector3(0, -eaveT, 0));
      k.quad4(a2, b2, b, a, a.distanceTo(b), eaveT, { ...RIDGE, edges: E.v0 | E.v1 });
      // soffit strip back under the roof, painted azurite with a gold line
      const inA = a2.clone().lerp(new Vector3(r.cx, a2.y, r.cz), 0.1).add(new Vector3(0, 0.08, 0));
      const inB = b2.clone().lerp(new Vector3(r.cx, b2.y, r.cz), 0.1).add(new Vector3(0, 0.08, 0));
      k.quad4(b2, a2, inA, inB, a.distanceTo(b), a2.distanceTo(inA), { wash: 0x1f3a52, line: 1, accent: true, edges: E.v0 });
    }
    // the painted eave board under every eave (彩画): an azurite / malachite panel strip with a gold rule, where loop 1-12
    // hung rows of rafter ends that read as a comb at a distance
    for (let i = 0; i < NU; i++) {
      const a = e[i], b = e[i + 1];
      if (a === undefined || b === undefined) continue;
      const a2 = a.clone().add(new Vector3(0, -eaveT, 0)), b2 = b.clone().add(new Vector3(0, -eaveT, 0));
      const inw = (p: Vector3): Vector3 => new Vector3(r.cx - p.x, 0, r.cz - p.z).normalize().multiplyScalar(0.12);
      const a3 = a2.clone().add(inw(a2)), b3 = b2.clone().add(inw(b2));
      const drop = new Vector3(0, -0.26 * (r.h / 1.6), 0);
      k.quad4(a3.clone().add(drop), b3.clone().add(drop), b3, a3, a.distanceTo(b), -drop.y, { wash: i % 2 === 0 ? 0x2e5fa3 : 0x2f8a6a, kind: K.panel, line: 1, accent: true, edges: E.v0 | E.v1 });
    }
  }
  // the main ridge and its chiwen, curling up and inward
  const top = r.y0 + r.h;
  k.box(r.cx, top - 0.08, r.cz, 2 * R + 0.2, 0.34, 0.3, RIDGE);
  k.box(r.cx, top + 0.26, r.cz, 2 * R, 0.06, 0.2, { ...GOLD, gloss: false });
  for (const sx of [-1, 1]) {
    const bx = r.cx + sx * R;
    x.sweep(curve([new Vector3(bx, top - 0.05, r.cz), new Vector3(bx + sx * 0.12, top + 0.45, r.cz), new Vector3(bx - sx * 0.05, top + 0.85, r.cz), new Vector3(bx - sx * 0.35, top + 0.8, r.cz), new Vector3(bx - sx * 0.4, top + 0.55, r.cz)], 4),
      (t) => 0.2 * (1 - t * 0.65), 8, { wash: 0x245e48, line: 1, accent: true }, { flat: 0.55, up: new Vector3(0, 0, 1), capStart: true, capEnd: true });
    x.sweep([new Vector3(bx - sx * 0.05, top + 0.5, r.cz), new Vector3(bx - sx * 0.05, top + 1.0, r.cz)], (t) => 0.035 * (1 - t), 5, { wash: 0xd2a347, line: 1, accent: true });
  }
  // hip ridges: a rounded beam down each hip, the end curling up past the corner
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const pts: Vector3[] = [];
    for (let j = 0; j <= 8; j++) pts.push(hip(sx, sz, 1 - j / 8).add(new Vector3(0, 0.12, 0)));
    const end = hip(sx, sz, 0);
    const outDir = new Vector3(sx, 0, sz).normalize();
    pts.push(end.clone().addScaledVector(outDir, 0.35).add(new Vector3(0, 0.3, 0)));
    pts.push(end.clone().addScaledVector(outDir, 0.42).add(new Vector3(0, 0.62, 0)));
    x.sweep(pts, (t) => 0.13 * (1 - t * 0.55), 7, { wash: 0x245e48, line: 1, accent: true }, { capEnd: true });
    // a small beast on each hip end
    const bp = hip(sx, sz, 0.18).add(new Vector3(0, 0.28, 0));
    x.ellipsoid(bp, new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), 0.1, 0.14, 0.1, { wash: 0xd2a347, line: 1, accent: true });
    if (r.neon !== null && signs !== null && sz > 0) {
      const c0 = hip(sx, sz, 0).add(new Vector3(0, 0.05, 0.05));
      const c1 = hip(sx, sz, 0.55).add(new Vector3(0, 0.05, 0.05));
      signs.tube(c0, c1, new Vector3(sx, 0.4, sz).normalize(), 0.06, r.neon, 4.5);
    }
  }
  if (r.neon !== null && signs !== null) {
    const e = front[0] ?? [];
    for (let i = 0; i < NU; i++) {
      const a = e[i], b = e[i + 1];
      if (a === undefined || b === undefined) continue;
      signs.tube(a.clone().add(new Vector3(0, 0.02, 0.06)), b.clone().add(new Vector3(0, 0.02, 0.06)), new Vector3(0, 0.3, 1).normalize(), 0.07, r.neon, 4.5);
    }
  }
}

/** a row of dougong brackets on a lintel top, from x0 to x1 at height y, the gate's plane at z */
function dougong(k: Kit, x0: number, x1: number, y: number, z: number, s: number): void {
  const n = Math.max(2, Math.round((x1 - x0) / (0.62 * s)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    k.box(x, y, z, 0.24 * s, 0.14 * s, 0.34 * s, GOLD);
    k.box(x, y + 0.14 * s, z, 0.62 * s, 0.12 * s, 0.2 * s, i % 2 === 0 ? AZURITE : MALACHITE);
    k.box(x, y + 0.14 * s, z, 0.16 * s, 0.12 * s, 0.7 * s, i % 2 === 0 ? MALACHITE : AZURITE);
    for (const dx of [-0.26, 0, 0.26]) k.box(x + dx * s, y + 0.26 * s, z, 0.16 * s, 0.1 * s, 0.24 * s, GOLD);
    k.box(x, y + 0.36 * s, z, 0.9 * s, 0.1 * s, 0.26 * s, i % 2 === 0 ? MALACHITE : AZURITE);
  }
}

/** a sparrow brace: a carved gold bracket in the corner where a post meets a lintel (sx = which way it reaches) */
function sparrowBrace(x: KitX, px: number, y: number, z: number, sx: number, len0: number, s: number): void {
  const len = len0 * 0.6;
  const pts = curve([new Vector3(px, y - len * 0.55, z), new Vector3(px + sx * len * 0.25, y - len * 0.2, z), new Vector3(px + sx * len, y - 0.04 * s, z)], 4);
  x.sweep(pts, (t) => (0.09 - t * 0.05) * s, 6, { wash: 0xd2a347, line: 1, accent: true }, { flat: 0.45, up: new Vector3(0, 0, 1), capStart: true, capEnd: true });
  x.sweep(curve([new Vector3(px + sx * 0.1 * s, y - len * 0.35, z), new Vector3(px + sx * len * 0.45, y - len * 0.32, z), new Vector3(px + sx * len * 0.55, y - len * 0.12, z)], 3), (t) => 0.05 * s * (1 - t * 0.5), 5, { wash: 0xb23020, line: 1, accent: true }, { flat: 0.6, up: new Vector3(0, 0, 1) });
}

/** a drum stone (抱鼓石): a plinth block with a carved drum on top, braced against a post along ±z */
function drumStone(k: Kit, x: KitX, px: number, y: number, pz: number, s: number): void {
  k.box(px, y, pz, 0.46 * s, 0.9 * s, 0.9 * s, STONE_PANEL);
  const c = new Vector3(px, y + 1.18 * s, pz);
  x.sweep([c.clone().add(new Vector3(-0.2 * s, 0, 0)), c.clone().add(new Vector3(0.2 * s, 0, 0))], () => 0.3 * s, 14, { wash: 0xb9b5ab, line: 1 }, { capStart: true, capEnd: true, up: new Vector3(0, 1, 0) });
  x.sweep([c.clone().add(new Vector3(-0.21 * s, 0, 0)), c.clone().add(new Vector3(0.21 * s, 0, 0))], () => 0.18 * s, 12, { wash: 0x9f9b92, line: 1 }, { capStart: true, capEnd: true, up: new Vector3(0, 1, 0) });
}

/** the gate itself; lantern(x, y, z, scale) hangs one lantern from its top */
export function buildPaifang(k: Kit, x: KitX, signs: SignBuilder, lantern: (x: number, y: number, z: number, s: number) => void, P: PaifangSpec): void {
  const { y, z, s } = P;
  const [p0, p1, p2, p3] = P.posts;
  const cx = (p1 + p2) / 2;
  const tall = 8.0 * s, short = 6.2 * s;
  const posts: [number, number, number][] = [[p0, 0.3 * s, short], [p1, 0.38 * s, tall], [p2, 0.38 * s, tall], [p3, 0.3 * s, short]];
  for (const [px, r, h] of posts) {
    k.box(px, y, z, 1.25 * s, 0.34 * s, 1.25 * s, { ...STONE, line: 2 });
    k.box(px, y + 0.34 * s, z, 0.95 * s, 0.9 * s, s, STONE_PANEL);
    k.cyl(px, y + 1.24 * s, z, r * 1.2, r * 1.2, 0.18 * s, 16, GOLD);
    k.cyl(px, y + 1.42 * s, z, r, r * 0.94, h - 1.42 * s, 16, CINNABAR);
    k.cyl(px, y + h - 0.35 * s, z, r * 1.08, r * 1.08, 0.16 * s, 16, GOLD);
    drumStone(k, x, px, y + 0.34 * s, z - 0.95 * s, s);
    drumStone(k, x, px, y + 0.34 * s, z + 0.95 * s, s);
  }
  // centre bay: two lintels, the plaque between, a painted frieze with gold rules
  const bw = p2 - p1;
  k.box(cx, y + 5.0 * s, z, bw + 0.9 * s, 0.5 * s, 0.56 * s, CINNABAR);
  k.box(cx, y + 5.07 * s, z + 0.29 * s, bw - 0.1 * s, 0.34 * s, 0.03 * s, { ...AZURITE, kind: K.panel });
  k.box(cx, y + 5.07 * s, z - 0.29 * s, bw - 0.1 * s, 0.34 * s, 0.03 * s, { ...AZURITE, kind: K.panel });
  k.box(cx, y + 6.75 * s, z, bw + 1.4 * s, 0.6 * s, 0.62 * s, CINNABAR);
  k.box(cx, y + 6.83 * s, z + 0.32 * s, bw + 0.9 * s, 0.42 * s, 0.03 * s, { ...MALACHITE, kind: K.panel });
  k.box(cx, y + 6.83 * s, z - 0.32 * s, bw + 0.9 * s, 0.42 * s, 0.03 * s, { ...MALACHITE, kind: K.panel });
  // the plaque: a black board in a gold frame, raised off a cinnabar field; flanking painted panels with gold medallions
  k.box(cx, y + 5.5 * s, z, bw, 1.25 * s, 0.34 * s, CIN_DARK);
  k.box(cx, y + 5.36 * s, z, 3.3 * s, 1.52 * s, 0.46 * s, GOLD);
  k.box(cx, y + 5.46 * s, z, 3.0 * s, 1.32 * s, 0.5 * s, { wash: 0x15120f, line: 1.2, accent: true });
  for (const sx of [-1, 1]) {
    const mx = cx + sx * (1.65 * s + (bw / 2 - 1.65 * s) / 2);
    k.box(mx, y + 5.62 * s, z, Math.max(0.2, bw / 2 - 1.8 * s), 0.9 * s, 0.4 * s, { ...LIGHT_MAL, kind: K.panel });
    x.ellipsoid(new Vector3(mx, y + 6.07 * s, z + 0.22 * s), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), 0.24 * s, 0.24 * s, 0.05 * s, { wash: 0xd2a347, line: 1, accent: true });
    x.ellipsoid(new Vector3(mx, y + 6.07 * s, z - 0.22 * s), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), 0.24 * s, 0.24 * s, 0.05 * s, { wash: 0xd2a347, line: 1, accent: true });
  }
  for (const nz of [1, -1]) {
    signs.place({ at: new Vector3(cx, y + 6.12 * s, z + nz * 0.2 * s), normal: new Vector3(0, 0, nz), size: 0.78 * s, spec: { text: P.plaque, color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.7 }, null);
  }
  dougong(k, p1 - 0.5 * s, p2 + 0.5 * s, y + 7.05 * s, z, s);
  curvedRoof(k, x, signs, { cx, y0: y + 7.55 * s, cz: z, w: bw + 3.2 * s, d: 2.9 * s, h: 1.75 * s, lift: 0.75 * s, flare: 0.35 * s, tile: TILE, neon: P.neonEaves });
  // sparrow braces under the centre lintel
  sparrowBrace(x, p1 + 0.38 * s, y + 4.75 * s, z, 1, 1.3 * s, s);
  sparrowBrace(x, p2 - 0.38 * s, y + 4.75 * s, z, -1, 1.3 * s, s);
  // side bays
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) {
    const m = (a + b) / 2;
    const w = b - a;
    k.box(m, y + 3.95 * s, z, w, 0.4 * s, 0.46 * s, CINNABAR);
    k.box(m, y + 4.0 * s, z + 0.24 * s, w - 0.5 * s, 0.26 * s, 0.03 * s, { ...AZURITE, kind: K.panel });
    k.box(m, y + 4.35 * s, z, w - 0.3 * s, 0.6 * s, 0.24 * s, { ...LIGHT_MAL, kind: K.panel });
    k.box(m, y + 4.95 * s, z, w + 0.8 * s, 0.48 * s, 0.52 * s, CINNABAR);
    k.box(m, y + 5.0 * s, z + 0.27 * s, w + 0.3 * s, 0.32 * s, 0.03 * s, { ...MALACHITE, kind: K.panel });
    dougong(k, a - 0.3 * s, b + 0.3 * s, y + 5.43 * s, z, s * 0.9);
    curvedRoof(k, x, signs, { cx: m, y0: y + 5.85 * s, cz: z, w: w + 2.3 * s, d: 2.4 * s, h: 1.35 * s, lift: 0.6 * s, flare: 0.28 * s, tile: TILE, neon: P.neonEaves });
    sparrowBrace(x, a + 0.32 * s, y + 3.75 * s, z, 1, 0.9 * s, s);
    sparrowBrace(x, b - 0.32 * s, y + 3.75 * s, z, -1, 0.9 * s, s);
    // lanterns in the side bays
    lantern(m - w * 0.22, y + 3.72 * s, z, 0.95 * s);
    lantern(m + w * 0.22, y + 3.72 * s, z, 0.95 * s);
  }
  // couplets on the inner posts: white boards, black kai
  signs.place({ at: new Vector3(p1, y + 3.2 * s, z + 0.4 * s), normal: new Vector3(0, 0, 1), size: 0.44 * s, spec: { text: P.couplets[0], color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  signs.place({ at: new Vector3(p2, y + 3.2 * s, z + 0.4 * s), normal: new Vector3(0, 0, 1), size: 0.44 * s, spec: { text: P.couplets[1], color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  // the centre bay's lanterns under the lintel
  for (let i = 0; i < 3; i++) lantern(p1 + bw * (0.25 + i * 0.25), y + 4.75 * s, z, 1.1 * s);
}

/** a paper lantern hanging from its top at (x, y, z): ribbed red body (emissive), gold caps, a tassel */
export function buildLantern(k: Kit, x: KitX, px: number, py: number, pz: number, s: number): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push([(0.07 + Math.sin(t * Math.PI) * 0.27) * s, (-0.66 + t * 0.54) * s]);
  }
  k.lathe(px, py, pz, prof, 12, { wash: 0xff5236, emit: 1.35, line: 0.7, accent: true }, true, 0);
  k.cyl(px, py - 0.14 * s, pz, 0.1 * s, 0.1 * s, 0.06 * s, 8, { wash: 0xd2a347, line: 0.8, accent: true });
  k.cyl(px, py - 0.72 * s, pz, 0.1 * s, 0.1 * s, 0.06 * s, 8, { wash: 0xd2a347, line: 0.8, accent: true });
  x.sweep([new Vector3(px, py - 0.72 * s, pz), new Vector3(px, py - 1.1 * s, pz)], (t) => (0.035 + t * 0.03) * s, 6, { wash: 0xc2301f, line: 0.6, accent: true }, { capEnd: true });
  x.sweep([new Vector3(px, py - 0.08 * s, pz), new Vector3(px, py + 0.06, pz)], () => 0.008, 4, { wash: 0x222222, line: 0.3 });
}
