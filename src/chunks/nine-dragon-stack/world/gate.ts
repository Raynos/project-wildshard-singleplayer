// Dome B (E169, round-10-dome-b): the paifang of Lantern Square at hero quality — the gate the spawn looks at and the
// dome-B anchor stands under. Grown from the hero lab's paifang (hero/paifang.ts) against the dome-B look-loop targets
// (art/nine-dragon-stack/round-10-dome-b-*/target-*.jpg: the gate seen from 10–15 m and from above):
// - dark, weathered cinnabar lacquer posts (not toy orange) with gold bands, on carved Sumeru stone bases (須彌座)
//   with a lotus cushion; drum stones (抱鼓石) with ringed, bossed drum faces and a crouching beast on top;
// - painted beams (旋子彩画): gold-ruled end bands, an azurite field, a malachite cartouche, gold rosettes;
// - dense three-tier dougong sets under every roof (坐斗, crossed arms, 升 blocks, slanted 昂), 栱眼 panels between;
// - thick curved hip roofs: raised glazed tile rolls down every slope (real relief: a ruled Kit alone reads flat), a
//   painted rafter soffit under the whole roof (from below the old roofs were hollow shells), a painted eave board,
//   ridge beasts on the hips, chiwen and a flaming pearl on the main ridge;
// - the black-and-gold 九龍 plaque in a raised gold frame (the old plaque sat INSIDE its own board and never showed),
//   couplets, lanterns; a pair of stone lions (石獅) on plinths before the centre bay.
import { Vector3 } from 'three';
import { E, K, type Kit, type Look } from './kit';
import type { SignBuilder } from '../look/signs';
import { type KitX, type XLook, curve } from './hero/kitx';
import { Rng } from '../util';
import { SURF } from '../look/paint';

export interface GateSpec {
  x: number;
  y: number;
  z: number;
  posts: readonly [number, number, number, number];
  s: number;
  plaque: string;
  couplets: readonly [string, string];
  neonEaves: number | null;
  /** the lion pedestals before the centre bay (the organic lab's TRELLIS lions stand on them, props3d.ts) */
  lions: boolean;
}

// the washes, fitted to the dome-B targets by ΔE00 (round 2: lacquer #a3463a vs #823c31, stone #636365 vs #544e4e)
// the painted surfaces (paint.ts, lab P5): weathered lacquer on the posts and beams; the stone takes the broad, soft
// concrete wash (SURF.concrete, 6 m), not the 1.7 m granite dabs (SURF.stone read as grain: the coordinator, round 7)
const LACQUER: Look = { wash: 0x662117, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const LACQUER_DK: Look = { wash: 0x561812, line: 1, accent: true, surf: SURF.lacquer };
const STONE: Look = { wash: 0x534d4e, line: 1, wet: 0.3, surf: SURF.concrete };
const STONE_PANEL: Look = { wash: 0x58524f, kind: K.panel, line: 1, wet: 0.2 };
const RELIEF: XLook = { wash: 0x6a6360, line: 0, wet: 0.15, surf: SURF.concrete };
const GOLD: Look = { wash: 0xb08a3c, line: 1, accent: true, gloss: true };
const GOLD_DK: Look = { wash: 0xa87a2c, line: 1, accent: true };
const AZURITE: Look = { wash: 0x2a558f, line: 1, accent: true };
const MALACHITE: Look = { wash: 0x2a7a5e, line: 1, accent: true };
const LIGHT_MAL: Look = { wash: 0x5f9c7e, line: 1, accent: true };
// glazed tiles: a dark blue-teal (round 2's jade rolls read #488b72 from above, round 3's #406561; the targets' #33484c)
const TILE = 0x163234;
const ROLL = 0x2c5250;
const RIDGE: Look = { wash: 0x1a3434, line: 1, accent: true };
const RIDGE_HI = 0x1e3238;
const LION: XLook = { wash: 0x6a6460, line: 0, wet: 0.2, surf: SURF.concrete };
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);

/** a closed ring (a torus) round `c` in the plane of (a, b), radius `r`, tube radius `t` */
function ring(x: KitX, c: Vector3, a: Vector3, b: Vector3, r: number, t: number, look: XLook, n = 20): void {
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    pts.push(c.clone().addScaledVector(a, Math.cos(th) * r).addScaledVector(b, Math.sin(th) * r));
  }
  x.sweep(pts, () => t, 5, look);
}

export interface RoofSpec { cx: number; y0: number; cz: number; w: number; d: number; h: number; lift: number; flare: number; tile: number; neon: number | null; ornaments: boolean }

/**
 * A curved hip roof. The four hip lines run from the flying eave corners (lifted by `lift`, pushed out by `flare`) to
 * the ridge ends; each slope is a grid between two hips, sagged in the middle of the eave. Raised tile rolls run down
 * every slope, a painted rafter soffit closes the underside, the ridge carries chiwen (and, with `ornaments`, a
 * flaming pearl), each hip a curl and a row of beasts.
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
  const NU = 12, NV = 7;
  const tl: Look = { wash: r.tile, kind: K.tiles, line: 1, accent: true };
  const eaveT = 0.24 * (r.h / 1.6);
  // one slope: `a` and `b` are the hips it spans (as functions of v), `out` its outward horizontal axis
  const slope = (a: (v: number) => Vector3, b: (v: number) => Vector3, out: Vector3): { P: Vector3[][]; at: (u: number, v: number) => Vector3 } => {
    const at = (u: number, v: number): Vector3 => {
      const p = a(v).lerp(b(v), u);
      p.y -= sagY(u, v);
      p.addScaledVector(out, -sagOut(u, v));
      return p;
    };
    const P: Vector3[][] = [];
    for (let j = 0; j <= NV; j++) {
      const row: Vector3[] = [];
      for (let i = 0; i <= NU; i++) row.push(at(i / NU, j / NV));
      P.push(row);
    }
    let vo = 0;
    for (let j = 0; j < NV; j++) {
      let uo = 0;
      const r0 = P[j] ?? [], r1 = P[j + 1] ?? [];
      const hgt = (r0[NU / 2] ?? new Vector3()).distanceTo(r1[NU / 2] ?? new Vector3());
      for (let i = 0; i < NU; i++) {
        const p00 = r0[i], p10 = r0[i + 1], p11 = r1[i + 1], p01 = r1[i];
        if (p00 === undefined || p10 === undefined || p11 === undefined || p01 === undefined) continue;
        const w = Math.max(p00.distanceTo(p10), 1e-3);
        const edges = (j === 0 ? E.v0 : 0) | (i === 0 ? E.u0 : 0) | (i === NU - 1 ? E.u1 : 0);
        k.quad4(p00, p10, p11, p01, w, Math.max(hgt, 1e-3), tl, uo, vo, edges);
        // the underside: the same grid an eave-thickness lower, facing down, painted rafters (K.bars) on azurite
        const dn = new Vector3(0, -eaveT, 0);
        k.quad4(p10.clone().add(dn), p00.clone().add(dn), p01.clone().add(dn), p11.clone().add(dn), w, Math.max(hgt, 1e-3),
          { wash: j === 0 ? 0x2a4d6e : 0x1f3a52, kind: K.bars, col: 0.21, row: 0, line: 0.8, accent: true }, uo, vo, j === 0 ? E.v0 : E.none);
        uo += w;
      }
      vo += hgt;
    }
    // raised tile rolls (筒瓦) down the slope, every ~0.3 m of eave, each ending in a round tile-end disc (瓦当)
    const eaveLen = (P[0] ?? []).reduce((s, p, i, arr) => (i === 0 ? 0 : s + p.distanceTo(arr[i - 1] ?? p)), 0);
    const nRoll = Math.max(4, Math.round(eaveLen / 0.3));
    for (let i = 0; i <= nRoll; i++) {
      const u = (i + 0.5) / (nRoll + 1);
      const pts: Vector3[] = [];
      for (let j = NV; j >= 0; j--) {
        const v = j / NV;
        const p = at(u, v);
        // lift off the slope along its normal (approximated by up + out)
        const du = at(Math.min(1, u + 0.01), v).sub(at(Math.max(0, u - 0.01), v));
        const dv = at(u, Math.min(1, v + 0.02)).sub(at(u, Math.max(0, v - 0.02)));
        const nrm = new Vector3().crossVectors(du, dv).normalize();
        if (nrm.y < 0) nrm.negate();
        pts.push(p.addScaledVector(nrm, 0.045 * (r.h / 1.6)));
      }
      x.sweep(pts, () => 0.055 * (r.h / 1.6), 5, { wash: ROLL, line: 0, accent: true }, { capEnd: true });
    }
    return { P, at };
  };
  const front = slope((v) => hip(-1, 1, v), (v) => hip(1, 1, v), Z.clone());
  const back = slope((v) => hip(1, -1, v), (v) => hip(-1, -1, v), Z.clone().negate());
  const east = slope((v) => hip(1, 1, v), (v) => hip(1, -1, v), X.clone());
  const west = slope((v) => hip(-1, -1, v), (v) => hip(-1, 1, v), X.clone().negate());
  for (const { P } of [front, back, east, west]) {
    const e = P[0] ?? [];
    for (let i = 0; i < NU; i++) {
      const a = e[i], b = e[i + 1];
      if (a === undefined || b === undefined) continue;
      const a2 = a.clone().add(new Vector3(0, -eaveT, 0)), b2 = b.clone().add(new Vector3(0, -eaveT, 0));
      // the eave's front edge band
      k.quad4(a2, b2, b, a, a.distanceTo(b), eaveT, { ...RIDGE, edges: E.v0 | E.v1 });
      // the painted eave board (彩画) hanging under it, a little in
      const inw = (p: Vector3): Vector3 => new Vector3(r.cx - p.x, 0, r.cz - p.z).normalize().multiplyScalar(0.16 * Math.min(1, r.h / 2.5));
      const a3 = a2.clone().add(inw(a2)), b3 = b2.clone().add(inw(b2));
      const drop = new Vector3(0, -0.3 * (r.h / 1.6), 0);
      k.quad4(a3.clone().add(drop), b3.clone().add(drop), b3, a3, a.distanceTo(b), -drop.y, { wash: i % 2 === 0 ? 0x2a558f : 0x2a7a5e, kind: K.panel, line: 1, accent: true, edges: E.all });
      // a gold rule along the board's foot
      k.quad4(a3.clone().add(drop).add(new Vector3(0, -0.05, 0)), b3.clone().add(drop).add(new Vector3(0, -0.05, 0)), b3.clone().add(drop), a3.clone().add(drop), a.distanceTo(b), 0.05, { ...GOLD, gloss: false, edges: E.v0 });
    }
  }
  // the main ridge: a moulded ridge with a gold band, chiwen curling up and in at the ends
  const top = r.y0 + r.h;
  // the ridge ornaments are sized for the gate's roofs; a small roof (the shrine's) scales them down
  const u = Math.min(1, r.h / 2.5);
  k.box(r.cx, top - 0.12 * u, r.cz, 2 * R + 0.2 * u, 0.42 * u, 0.34 * u, RIDGE);
  k.box(r.cx, top + 0.3 * u, r.cz, 2 * R + 0.1 * u, 0.08 * u, 0.24 * u, { wash: RIDGE_HI, line: 1, accent: true });
  k.box(r.cx, top + 0.1 * u, r.cz, 2 * R, 0.07 * u, 0.36 * u, { ...GOLD, gloss: false });
  for (const sx of [-1, 1]) {
    const bx = r.cx + sx * R;
    x.sweep(curve([new Vector3(bx, top - 0.05 * u, r.cz), new Vector3(bx + sx * 0.14 * u, top + 0.5 * u, r.cz), new Vector3(bx - sx * 0.05 * u, top + 0.95 * u, r.cz), new Vector3(bx - sx * 0.4 * u, top + 0.9 * u, r.cz), new Vector3(bx - sx * 0.45 * u, top + 0.6 * u, r.cz)], 4),
      (t) => 0.22 * u * (1 - t * 0.65), 8, { wash: RIDGE_HI, line: 1, accent: true }, { flat: 0.55, up: Z.clone(), capStart: true, capEnd: true });
    // the chiwen's fin crest and a gold sword hilt
    for (let f = 0; f < 4; f++) {
      const fy = top + (0.35 + f * 0.14) * u;
      x.sweep([new Vector3(bx + sx * 0.1 * u, fy, r.cz), new Vector3(bx + sx * 0.3 * u, fy + 0.1 * u, r.cz)], (t) => 0.05 * u * (1 - t), 4, { wash: RIDGE_HI, line: 0, accent: true }, { flat: 0.4, up: Z.clone() });
    }
    x.sweep([new Vector3(bx - sx * 0.05 * u, top + 0.55 * u, r.cz), new Vector3(bx - sx * 0.05 * u, top + 1.12 * u, r.cz)], (t) => 0.04 * u * (1 - t * 0.8), 5, { wash: 0xd2a347, line: 1, accent: true });
  }
  if (r.ornaments) {
    // the flaming pearl (火焰宝珠) on a lotus seat at the ridge's centre, two small gold dragons chasing it
    const pc = new Vector3(r.cx, top + 0.62, r.cz);
    k.lathe(r.cx, top + 0.3, r.cz, [[0.22, 0], [0.26, 0.06], [0.18, 0.14], [0.12, 0.2]], 10, GOLD_DK, true, 1);
    x.ellipsoid(pc, X, Y, Z, 0.17, 0.2, 0.17, { wash: 0xe0b24e, line: 0, accent: true, gloss: true });
    for (let f = 0; f < 5; f++) {
      const a = -0.9 + f * 0.45;
      x.sweep(curve([pc.clone().add(new Vector3(Math.sin(a) * 0.12, 0.12, 0)), pc.clone().add(new Vector3(Math.sin(a) * 0.22, 0.32, 0)), pc.clone().add(new Vector3(Math.sin(a) * 0.12, 0.48 - Math.abs(a) * 0.12, 0))], 3),
        (t) => 0.05 * (1 - t), 4, { wash: 0xd2a347, line: 0, accent: true }, { flat: 0.5, up: Z.clone() });
    }
    for (const sx of [-1, 1]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new Vector3(r.cx + sx * (0.35 + t * 1.3), top + 0.36 + 0.16 * Math.sin(t * Math.PI * 2.2) + t * 0.05, r.cz));
      }
      x.sweep(pts, (t) => 0.075 * (1 - t * 0.7), 6, { wash: 0xc99a3e, line: 0, accent: true, gloss: true }, { capStart: true, capEnd: true });
      x.ellipsoid(new Vector3(r.cx + sx * 0.36, top + 0.4, r.cz), X, Y, Z, 0.12, 0.09, 0.08, { wash: 0xc99a3e, line: 0, accent: true, gloss: true });
    }
  }
  // hip ridges: a rounded beam down each hip, the end curling up past the corner, a row of little beasts, a gold tip
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const pts: Vector3[] = [];
    for (let j = 0; j <= 8; j++) pts.push(hip(sx, sz, 1 - j / 8).add(new Vector3(0, 0.14 * u, 0)));
    const end = hip(sx, sz, 0);
    const outDir = new Vector3(sx, 0, sz).normalize();
    pts.push(end.clone().addScaledVector(outDir, 0.38 * u).add(new Vector3(0, 0.34 * u, 0)));
    pts.push(end.clone().addScaledVector(outDir, 0.44 * u).add(new Vector3(0, 0.7 * u, 0)));
    x.sweep(pts, (t) => 0.15 * u * (1 - t * 0.55), 7, { wash: RIDGE_HI, line: 1, accent: true }, { capEnd: true });
    x.ellipsoid(end.clone().addScaledVector(outDir, 0.44 * u).add(new Vector3(0, 0.76 * u, 0)), X, Y, Z, 0.06 * u, 0.09 * u, 0.06 * u, { wash: 0xd2a347, line: 0, accent: true, gloss: true });
    for (let b = 0; b < (u > 0.5 ? 4 : 1); b++) {
      const bp = hip(sx, sz, 0.12 + b * 0.09).add(new Vector3(0, 0.3 * u, 0));
      x.ellipsoid(bp, X, Y, Z, 0.07 * u, 0.11 * u, 0.07 * u, { wash: b === 0 ? 0xd2a347 : 0x2a4a4a, line: 0, accent: true }, (d) => 1 + (d.y > 0.5 ? 0.25 : 0) - (d.y < -0.5 ? 0.2 : 0), 4, 6);
    }
    if (r.neon !== null && signs !== null && sz > 0) {
      const c0 = hip(sx, sz, 0).add(new Vector3(0, 0.05, 0.05));
      const c1 = hip(sx, sz, 0.55).add(new Vector3(0, 0.05, 0.05));
      signs.tube(c0, c1, new Vector3(sx, 0.4, sz).normalize(), 0.06, r.neon, 4.5);
    }
  }
  if (r.neon !== null && signs !== null) {
    const e = front.P[0] ?? [];
    for (let i = 0; i < NU; i++) {
      const a = e[i], b = e[i + 1];
      if (a === undefined || b === undefined) continue;
      signs.tube(a.clone().add(new Vector3(0, 0.02, 0.07)), b.clone().add(new Vector3(0, 0.02, 0.07)), new Vector3(0, 0.3, 1).normalize(), 0.07, r.neon, 4.5);
    }
  }
}

/** a row of three-tier dougong sets on a lintel top, x0 → x1 at height y, the gate's plane at z; 栱眼 panels between */
function dougong(k: Kit, x0: number, x1: number, y: number, z: number, s: number): void {
  const n = Math.max(3, Math.round((x1 - x0) / (0.5 * s)));
  const q = s;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const A = i % 2 === 0 ? AZURITE : MALACHITE, B = i % 2 === 0 ? MALACHITE : AZURITE;
    k.box(x, y, z, 0.26 * q, 0.13 * q, 0.26 * q, GOLD_DK);
    // tier 1: the cross arm along the lintel, the first projecting arm through the gate
    k.box(x, y + 0.13 * q, z, 0.6 * q, 0.1 * q, 0.13 * q, A);
    k.box(x, y + 0.13 * q, z, 0.13 * q, 0.1 * q, 0.6 * q, B);
    for (const d of [-0.25, 0.25]) {
      k.box(x + d * q, y + 0.23 * q, z, 0.13 * q, 0.07 * q, 0.15 * q, GOLD_DK);
      k.box(x, y + 0.23 * q, z + d * q, 0.15 * q, 0.07 * q, 0.13 * q, GOLD_DK);
    }
    // tier 2: longer arms
    k.box(x, y + 0.3 * q, z, 0.9 * q, 0.1 * q, 0.13 * q, B);
    k.box(x, y + 0.3 * q, z, 0.13 * q, 0.1 * q, 0.96 * q, A);
    for (const d of [-0.4, 0, 0.4]) k.box(x + d * q, y + 0.4 * q, z, 0.13 * q, 0.07 * q, 0.15 * q, GOLD_DK);
    for (const d of [-0.42, 0.42]) k.box(x, y + 0.4 * q, z + d * q, 0.15 * q, 0.07 * q, 0.13 * q, GOLD_DK);
    // tier 3: the slanted 昂 beams fore and aft, the top arm
    for (const sz of [-1, 1]) k.beam(new Vector3(x, y + 0.52 * q, z + sz * 0.12 * q), new Vector3(x, y + 0.34 * q, z + sz * 0.74 * q), 0.11 * q, 0.09 * q, A);
    k.box(x, y + 0.47 * q, z, 1.08 * q, 0.09 * q, 0.12 * q, A);
  }
  // the beams the sets carry, and the red 栱眼 panels between the sets on both faces
  k.box((x0 + x1) / 2, y + 0.56 * q, z, x1 - x0 + q, 0.1 * q, 1.3 * q, { wash: 0x1f3a52, line: 1, accent: true });
  for (const sz of [-1, 1]) k.box((x0 + x1) / 2, y + 0.02 * q, z + sz * 0.06 * q, x1 - x0, 0.26 * q, 0.04 * q, { wash: 0x7e1e1a, kind: K.panel, line: 1, accent: true });
}

/** a painted beam (旋子彩画) centred at (cx, y .. y+h, z), `len` long, `d` deep: end bands, rosettes, a cartouche */
function paintedBeam(k: Kit, x: KitX, cx: number, y: number, z: number, len: number, h: number, d: number, field: Look, cart: Look): void {
  k.box(cx, y, z, len, h, d, LACQUER_DK);
  for (const sz of [-1, 1]) {
    const fz = z + sz * (d / 2 + 0.015);
    // the painted field, the centre cartouche (枋心), the gold-ruled end bands (箍头)
    k.box(cx, y + h * 0.1, fz, len - 0.12, h * 0.8, 0.03, { ...field, kind: K.panel });
    k.box(cx, y + h * 0.18, fz + sz * 0.02, len * 0.38, h * 0.64, 0.03, { ...cart, kind: K.panel });
    // the cartouche carries a carved gold dragon among clouds (target-1: the lintels read as gilded relief)
    if (len > 3) relief(x, new Vector3(cx, y + h * 0.5, fz + sz * 0.05), new Vector3(sz, 0, 0), Y.clone(), new Vector3(0, 0, sz), len * 0.34, h * 0.56, Math.round(cx * 10 + y), { wash: 0xb08a3c, line: 0, accent: true, gloss: true });
    for (const ex of [-1, 1]) {
      const bx = cx + ex * (len / 2 - 0.2);
      k.box(bx, y + h * 0.06, fz + sz * 0.02, 0.22, h * 0.88, 0.03, { ...GOLD, gloss: false });
      k.box(bx - ex * 0.2, y + h * 0.06, fz + sz * 0.025, 0.07, h * 0.88, 0.03, { ...LIGHT_MAL });
      // the rosettes (旋花) in the 找头 between band and cartouche
      const rx = cx + ex * (len * 0.19 + (len / 2 - 0.45 - len * 0.19) / 2);
      const rr = Math.min(h * 0.34, (len / 2 - 0.45 - len * 0.19) * 0.42);
      if (rr > 0.06) {
        x.ellipsoid(new Vector3(rx, y + h / 2, fz + sz * 0.035), X, Y, Z, rr, rr, 0.025, { wash: 0xd8c9a0, line: 0, accent: true }, () => 1, 3, 12);
        x.ellipsoid(new Vector3(rx, y + h / 2, fz + sz * 0.05), X, Y, Z, rr * 0.55, rr * 0.55, 0.025, { wash: 0xc99a3e, line: 0, accent: true, gloss: true }, () => 1, 3, 10);
        x.ellipsoid(new Vector3(rx, y + h / 2, fz + sz * 0.062), X, Y, Z, rr * 0.2, rr * 0.2, 0.02, { wash: 0x7e1e1a, line: 0, accent: true }, () => 1, 3, 8);
      }
    }
  }
}

/** a sparrow brace: a carved gold bracket in the corner where a post meets a lintel (sx = which way it reaches) */
function sparrowBrace(x: KitX, px: number, y: number, z: number, sx: number, len0: number, s: number): void {
  const len = len0 * 0.6;
  for (const dz of [-0.12 * s, 0.12 * s]) {
    const pts = curve([new Vector3(px, y - len * 0.55, z + dz), new Vector3(px + sx * len * 0.25, y - len * 0.2, z + dz), new Vector3(px + sx * len, y - 0.04 * s, z + dz)], 4);
    x.sweep(pts, (t) => (0.09 - t * 0.05) * s, 6, { wash: 0xc99a3e, line: 1, accent: true, gloss: true }, { flat: 0.45, up: Z.clone(), capStart: true, capEnd: true });
    x.sweep(curve([new Vector3(px + sx * 0.1 * s, y - len * 0.35, z + dz), new Vector3(px + sx * len * 0.45, y - len * 0.32, z + dz), new Vector3(px + sx * len * 0.55, y - len * 0.12, z + dz)], 3), (t) => 0.05 * s * (1 - t * 0.5), 5, { wash: 0x9c2a1c, line: 1, accent: true }, { flat: 0.6, up: Z.clone() });
  }
}

/**
 * Carved relief on a stone face (the targets' plinths and planter carry dragons among clouds, raised off the stone):
 * a coiling dragon (a tapering, flattened sinuous body with a head) and cloud scrolls, centred at `c` on the face,
 * `w` × `h` in the plane (right, up), raised along `n`.
 */
export function relief(x: KitX, c: Vector3, right: Vector3, up: Vector3, n: Vector3, w: number, h: number, seed: number, look: XLook = RELIEF): void {
  const rng = new Rng(seed);
  const m = Math.min(w, h);
  const P = (u: number, v: number): Vector3 => c.clone().addScaledVector(right, (u * w) / 2).addScaledVector(up, (v * h) / 2);
  const ph = rng.range(0, Math.PI * 2), dir = rng.chance(0.5) ? 1 : -1;
  const body: Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    body.push(P(dir * (-0.82 + 1.64 * t), 0.5 * Math.sin(ph + t * Math.PI * 3) * (0.6 + 0.4 * t)));
  }
  x.sweep(body, (t) => m * 0.085 * (1 - 0.75 * t), 6, look, { flat: 0.45, up: n.clone(), capStart: true, capEnd: true });
  const head = body[0] ?? c;
  x.ellipsoid(head, right, up, n, m * 0.13, m * 0.1, m * 0.06, look, (d) => 1 + 0.2 * Math.abs(Math.sin(d.x * 7 + d.y * 5)), 4, 8);
  // a spine of knobs along the back and two legs
  for (let i = 3; i < 16; i += 3) {
    const p = body[i];
    if (p !== undefined) x.ellipsoid(p.clone().addScaledVector(up, m * 0.07), right, up, n, m * 0.03, m * 0.045, m * 0.035, look, () => 1, 3, 5);
  }
  // cloud scrolls in the gaps
  for (let sIdx = 0; sIdx < 4; sIdx++) {
    const cu = rng.range(-0.75, 0.75), cv = (sIdx % 2 === 0 ? 1 : -1) * rng.range(0.45, 0.8);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 1.7;
      const rr = m * 0.11 * (1 - i / 17);
      pts.push(P(cu, cv).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr));
    }
    x.sweep(pts, () => m * 0.022, 4, look, { flat: 0.5, up: n.clone() });
  }
}

/** a Sumeru base (須彌座) under a post: stepped slabs, a die carved with dragons on every face, a lotus cushion */
function sumeru(k: Kit, x: KitX, px: number, y: number, z: number, s: number, r: number): number {
  k.box(px, y, z, 1.4 * s, 0.14 * s, 1.4 * s, { ...STONE, line: 2 });
  k.box(px, y + 0.14 * s, z, 1.26 * s, 0.1 * s, 1.26 * s, STONE);
  k.box(px, y + 0.24 * s, z, 1.08 * s, 0.6 * s, 1.08 * s, STONE_PANEL);
  const dc = y + 0.54 * s;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nrm = new Vector3(nx, 0, nz);
    const rt = new Vector3(-nz, 0, nx);
    relief(x, new Vector3(px + nx * 0.54 * s, dc, z + nz * 0.54 * s), rt, Y.clone(), nrm, 0.8 * s, 0.4 * s, Math.round(px * 100) + nx * 7 + nz * 13);
  }
  k.box(px, y + 0.84 * s, z, 1.26 * s, 0.1 * s, 1.26 * s, STONE);
  k.lathe(px, y + 0.94 * s, z, [[0.6 * s, 0], [0.64 * s, 0.07 * s], [0.56 * s, 0.17 * s], [r * 1.3, 0.25 * s], [r * 1.18, 0.3 * s]], 16, { ...STONE, wet: 0.2 }, true, 1);
  return y + 1.24 * s;
}

/** a drum stone (抱鼓石) braced against a post along ±z: a carved block, a drum with ringed faces and a boss, a beast */
function drumStone(k: Kit, x: KitX, px: number, y: number, pz: number, s: number): void {
  k.box(px, y, pz, 0.46 * s, 0.5 * s, 0.8 * s, STONE_PANEL);
  for (const sx of [-1, 1]) relief(x, new Vector3(px + sx * 0.23 * s, y + 0.25 * s, pz), Z.clone().multiplyScalar(sx), Y.clone(), X.clone().multiplyScalar(sx), 0.66 * s, 0.34 * s, Math.round(pz * 50 + px * 30) + sx);
  k.box(px, y + 0.5 * s, pz, 0.52 * s, 0.08 * s, 0.86 * s, STONE);
  // the wave seat the drum rests on
  x.ellipsoid(new Vector3(px, y + 0.64 * s, pz), X, Y, Z, 0.24 * s, 0.08 * s, 0.36 * s, { wash: 0x5e5856, line: 0, wet: 0.2, surf: SURF.concrete }, (d) => 1 + 0.12 * Math.sin(d.z * 14), 4, 12);
  const R = 0.3 * s;
  const c = new Vector3(px, y + 0.66 * s + R, pz);
  x.sweep([c.clone().add(new Vector3(-0.17 * s, 0, 0)), c.clone().add(new Vector3(0.17 * s, 0, 0))], (t) => R * (1 - 0.1 * (2 * t - 1) ** 2), 18, { wash: 0x615a58, line: 0, wet: 0.15, surf: SURF.concrete }, { capStart: true, capEnd: true, up: Y.clone() });
  for (const sx of [-1, 1]) {
    const f = c.clone().add(new Vector3(sx * 0.17 * s, 0, 0));
    ring(x, f, Z, Y, R * 0.86, 0.025 * s, { wash: 0x5a5452, line: 0, surf: SURF.concrete });
    ring(x, f, Z, Y, R * 0.52, 0.02 * s, { wash: 0x5a5452, line: 0, surf: SURF.concrete });
    x.ellipsoid(f.clone().add(new Vector3(sx * 0.02 * s, 0, 0)), X, Y, Z, 0.05 * s, R * 0.3, R * 0.3, { wash: 0x6a6360, line: 0, surf: SURF.concrete }, (d) => 1 + 0.15 * Math.sin(Math.atan2(d.y, d.z) * 6), 4, 12);
  }
  // studs round the drum's rim
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    for (const sx of [-1, 1]) x.ellipsoid(c.clone().add(new Vector3(sx * 0.16 * s, Math.sin(a) * R * 0.97, Math.cos(a) * R * 0.97)), X, Y, Z, 0.025 * s, 0.025 * s, 0.025 * s, { wash: 0x4e4947, line: 0 }, () => 1, 3, 5);
  }
  // a lotus-bud knob on top (a procedural crouching beast read as a lump from 3 m in the walk-around)
  k.lathe(c.x, c.y + R - 0.03 * s, c.z, [[0.1 * s, 0], [0.12 * s, 0.03 * s], [0.08 * s, 0.06 * s], [0.09 * s, 0.1 * s], [0.05 * s, 0.16 * s], [0, 0.2 * s]], 10, { wash: 0x5e5856, line: 1, wet: 0.2, surf: SURF.concrete }, true, 0);
}

/**
 * A seated stone lion (石獅) on its pedestal, facing `face` (+1 = +z). The male rests a paw on the embroidered ball, the
 * female on a cub. Brushed (no ruled edges): its outline is the post silhouette.
 */
/** a lion's pedestal: a Sumeru block with carved panels, its top at y + 0.96 s (props3d.ts GATE_LIONS.top) */
export function lionPedestal(k: Kit, x: KitX, cx: number, y: number, cz: number, s: number): void {
  k.box(cx, y, cz, 1.25 * s, 0.14 * s, 1.55 * s, { ...STONE, line: 2 });
  k.box(cx, y + 0.14 * s, cz, 1.05 * s, 0.7 * s, 1.35 * s, STONE_PANEL);
  k.box(cx, y + 0.84 * s, cz, 1.2 * s, 0.12 * s, 1.5 * s, STONE);
  for (const nx of [-1, 1]) relief(x, new Vector3(cx + nx * 0.525 * s, y + 0.49 * s, cz), new Vector3(0, 0, -nx), Y.clone(), new Vector3(nx, 0, 0), 1.1 * s, 0.5 * s, 700 + nx);
}

export function stoneLion(k: Kit, x: KitX, cx: number, y: number, cz: number, face: number, male: boolean, s: number): void {
  lionPedestal(k, x, cx, y, cz, s);
  const b = y + 0.96 * s;
  const F = (lx: number, ly: number, lz: number): Vector3 => new Vector3(cx + lx * s * face, b + ly * s, cz + lz * s * face);
  const RX = X.clone().multiplyScalar(face), FZ = Z.clone().multiplyScalar(face);
  const el = (c: Vector3, rx: number, ry: number, rz: number, bump: (d: Vector3) => number = () => 1, lat = 6, lon = 10): void => {
    x.ellipsoid(c, RX, Y, FZ, rx * s, ry * s, rz * s, LION, bump, lat, lon);
  };
  // the base slab the lion sits on
  k.box(cx, b, cz, 0.9 * s, 0.08 * s, 1.2 * s, { wash: 0x6e6d70, line: 1 });
  const b2 = 0.08;
  // haunches, belly, chest
  el(F(0, b2 + 0.36, -0.2), 0.36, 0.34, 0.42);
  for (const sx of [-1, 1]) el(F(sx * 0.24, b2 + 0.24, -0.22), 0.16, 0.24, 0.3);
  el(F(0, b2 + 0.72, 0.08), 0.3, 0.36, 0.28);
  // forelegs, straight and braced, with big paws
  for (const sx of [-1, 1]) {
    x.sweep(curve([F(sx * 0.17, b2 + 0.72, 0.2), F(sx * 0.19, b2 + 0.4, 0.3), F(sx * 0.2, b2 + 0.06, 0.34)], 3), (t) => (0.1 - t * 0.02) * s, 7, LION, { capStart: true });
    el(F(sx * 0.2, b2 + 0.07, 0.4), 0.1, 0.07, 0.13, (d) => 1 + 0.12 * Math.abs(Math.sin(d.x * 9)), 4, 8);
  }
  // the head: a big skull, a curled mane of knots, a broad snout, bulging eyes, an open mouth
  const hc = F(0, b2 + 1.18, 0.22);
  el(F(0, b2 + 1.1, 0.06), 0.4, 0.42, 0.28, (d) => 1 + 0.16 * Math.abs(Math.sin(d.x * 7) * Math.sin(d.y * 7)) + 0.06 * Math.sin(d.z * 11), 8, 14);
  x.ellipsoid(hc, RX, Y, FZ, 0.28 * s, 0.27 * s, 0.25 * s, LION, (d) => 1 + (d.z > 0.4 ? 0.08 : 0), 6, 10);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI - Math.PI / 2 + Math.PI / 2;
    const cr = F(Math.cos(a) * 0.3, b2 + 1.1 + Math.sin(a) * 0.3, 0.14);
    x.ellipsoid(cr, RX, Y, FZ, 0.08 * s, 0.08 * s, 0.06 * s, LION, (d) => 1 + 0.2 * Math.sin(Math.atan2(d.y, d.x) * 3), 4, 8);
  }
  el(F(0, b2 + 1.1, 0.42), 0.17, 0.12, 0.12);
  for (const sx of [-1, 1]) {
    x.ellipsoid(F(sx * 0.1, b2 + 1.26, 0.43), RX, Y, FZ, 0.055 * s, 0.05 * s, 0.04 * s, { wash: 0x87857f, line: 0 }, () => 1, 4, 6);
    x.ellipsoid(F(sx * 0.1, b2 + 1.26, 0.465), RX, Y, FZ, 0.022 * s, 0.022 * s, 0.01 * s, { wash: 0x2a2a2c, line: 0 }, () => 1, 3, 5);
    el(F(sx * 0.2, b2 + 1.38, 0.2), 0.07, 0.05, 0.06);
  }
  x.ellipsoid(F(0, b2 + 1.0, 0.44), RX, Y, FZ, 0.11 * s, 0.035 * s, 0.05 * s, { wash: 0x3a3032, line: 0 }, () => 1, 3, 8);
  // a tail curling up the back
  x.sweep(curve([F(0, b2 + 0.3, -0.58), F(0, b2 + 0.62, -0.62), F(0, b2 + 0.86, -0.5), F(0, b2 + 0.92, -0.36)], 3), (t) => (0.07 + 0.05 * t) * s, 6, LION, { capEnd: true });
  // the ball (male) or the cub (female) under the outer paw
  const sx = male ? 1 : -1;
  if (male) {
    const bc = F(sx * 0.36, b2 + 0.17, 0.36);
    el(bc, 0.17, 0.17, 0.17, (d) => 1 + 0.06 * Math.sin(d.x * 12) * Math.sin(d.y * 12) * Math.sin(d.z * 12));
    x.sweep(curve([F(sx * 0.2, b2 + 0.4, 0.3), F(sx * 0.3, b2 + 0.36, 0.34), F(sx * 0.36, b2 + 0.33, 0.36)], 3), () => 0.07 * s, 6, LION, { capEnd: true });
  } else {
    el(F(sx * 0.36, b2 + 0.14, 0.32), 0.13, 0.12, 0.16);
    el(F(sx * 0.36, b2 + 0.28, 0.42), 0.09, 0.09, 0.09);
  }
}

/** the gate itself; lantern(x, y, z, scale) hangs one lantern from its top */
export function buildGate(k: Kit, x: KitX, signs: SignBuilder, lantern: (x: number, y: number, z: number, s: number) => void, P: GateSpec): void {
  const { y, z, s } = P;
  const [p0, p1, p2, p3] = P.posts;
  const cx = (p1 + p2) / 2;
  // the posts stop under the dougong (they used to poke up through the eaves as orange knobs)
  const tall = 7.05 * s, short = 5.43 * s;
  // slimmer than the hero lab's (style-A's posts are tall and slender; 1.4 m columns made the gate squat)
  const posts: [number, number, number][] = [[p0, 0.26 * s, short], [p1, 0.32 * s, tall], [p2, 0.32 * s, tall], [p3, 0.26 * s, short]];
  for (const [px, r, h] of posts) {
    const y1 = sumeru(k, x, px, y, z, s, r);
    k.cyl(px, y1, z, r * 1.14, r * 1.14, 0.16 * s, 16, GOLD);
    k.cyl(px, y1 + 0.16 * s, z, r, r * 0.95, y + h - y1 - 0.16 * s, 16, LACQUER, { caps: false });
    for (const hy of [h - 0.45 * s, h - 0.7 * s]) k.cyl(px, y + hy, z, r * 0.99, r * 0.99, 0.08 * s, 16, GOLD_DK);
    drumStone(k, x, px, y + 0.24 * s, z - s, s);
    drumStone(k, x, px, y + 0.24 * s, z + s, s);
  }
  // centre bay: two painted beams, the plaque between, flanking painted panels with gold medallions
  const bw = p2 - p1;
  paintedBeam(k, x, cx, y + 5.0 * s, z, bw + 0.9 * s, 0.5 * s, 0.56 * s, AZURITE, MALACHITE);
  paintedBeam(k, x, cx, y + 6.75 * s, z, bw + 1.4 * s, 0.6 * s, 0.62 * s, MALACHITE, AZURITE);
  k.box(cx, y + 5.5 * s, z, bw, 1.25 * s, 0.34 * s, LACQUER_DK);
  for (const sx of [-1, 1]) {
    const mx = cx + sx * (1.65 * s + (bw / 2 - 1.65 * s) / 2);
    const mw = Math.max(0.2, bw / 2 - 1.8 * s);
    k.box(mx, y + 5.62 * s, z, mw, 0.9 * s, 0.42 * s, { ...LIGHT_MAL, kind: K.panel });
    for (const nz of [1, -1]) {
      x.ellipsoid(new Vector3(mx, y + 6.07 * s, z + nz * 0.22 * s), X, Y, Z, 0.13 * s, 0.13 * s, 0.04 * s, { wash: 0xb08434, line: 1, accent: true, gloss: true });
      ring(x, new Vector3(mx, y + 6.07 * s, z + nz * 0.24 * s), X, Y, 0.2 * s, 0.02 * s, { wash: 0xa87a2c, line: 0, accent: true });
    }
  }
  // the plaque: a recessed black board in a raised gold frame with cloud-scroll bosses and a crown
  const pw = 3.1 * s, ph = 1.45 * s, pyc = y + 6.1 * s, pd = 0.34 * s;
  k.box(cx, pyc - ph / 2, z, pw, ph, pd, { wash: 0x15120f, line: 1.2, accent: true });
  const fr = 0.16 * s, fd = pd + 0.1 * s;
  k.box(cx, pyc + ph / 2 - fr, z, pw + fr, fr, fd, GOLD);
  k.box(cx, pyc - ph / 2, z, pw + fr, fr, fd, GOLD);
  for (const sx of [-1, 1]) k.box(cx + sx * pw / 2, pyc - ph / 2, z, fr, ph, fd, GOLD);
  for (const nz of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const bx = cx - pw / 2 + t * pw;
      x.ellipsoid(new Vector3(bx, pyc + ph / 2 - fr / 2, z + nz * fd / 2), X, Y, Z, 0.1 * s, 0.07 * s, 0.03 * s, { wash: 0xe0b24e, line: 0, accent: true, gloss: true }, () => 1, 3, 8);
      x.ellipsoid(new Vector3(bx, pyc - ph / 2 + fr / 2, z + nz * fd / 2), X, Y, Z, 0.1 * s, 0.07 * s, 0.03 * s, { wash: 0xe0b24e, line: 0, accent: true, gloss: true }, () => 1, 3, 8);
    }
    // the characters, just proud of the recessed board (the old sign sat inside its own board)
    signs.place({ at: new Vector3(cx, pyc, z + nz * (pd / 2 + 0.005 - 0.065)), normal: new Vector3(0, 0, nz), size: 0.8 * s, spec: { text: P.plaque, color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.7 }, null);
  }
  // the crown: a gold cloud crest over the plaque, flanked by curled scrolls
  x.ellipsoid(new Vector3(cx, pyc + ph / 2 + 0.1 * s, z), X, Y, Z, 0.7 * s, 0.2 * s, fd / 2, { wash: 0xc99a3e, line: 0, accent: true, gloss: true }, (d) => 1 + 0.18 * Math.sin(Math.atan2(d.y, d.x) * 5), 4, 14);
  for (const sx of [-1, 1]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 1.6;
      const rr = 0.22 * s * (1 - i / 16);
      pts.push(new Vector3(cx + sx * (0.95 * s + Math.cos(a) * rr), pyc + ph / 2 + 0.05 * s + Math.sin(a) * rr, z));
    }
    x.sweep(pts, () => 0.045 * s, 5, { wash: 0xc99a3e, line: 0, accent: true }, { flat: 0.8, up: Z.clone(), capStart: true, capEnd: true });
  }
  dougong(k, p1 - 0.5 * s, p2 + 0.5 * s, y + 7.05 * s, z, s);
  // the roofs sit light on the gate (style-A: roofs a quarter of the height, the tall bays open below them)
  curvedRoof(k, x, signs, { cx, y0: y + 7.72 * s, cz: z, w: bw + 2.4 * s, d: 2.6 * s, h: 1.55 * s, lift: 0.68 * s, flare: 0.32 * s, tile: TILE, neon: P.neonEaves, ornaments: true });
  sparrowBrace(x, p1 + 0.38 * s, y + 4.75 * s, z, 1, 1.3 * s, s);
  sparrowBrace(x, p2 - 0.38 * s, y + 4.75 * s, z, -1, 1.3 * s, s);
  // side bays
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) {
    const m = (a + b) / 2;
    const w = b - a;
    paintedBeam(k, x, m, y + 3.95 * s, z, w, 0.4 * s, 0.46 * s, AZURITE, MALACHITE);
    k.box(m, y + 4.35 * s, z, w - 0.3 * s, 0.6 * s, 0.26 * s, { ...LIGHT_MAL, kind: K.panel });
    for (const nz of [1, -1]) {
      x.ellipsoid(new Vector3(m, y + 4.65 * s, z + nz * 0.14 * s), X, Y, Z, 0.11 * s, 0.11 * s, 0.035 * s, { wash: 0xb08434, line: 1, accent: true, gloss: true });
      ring(x, new Vector3(m, y + 4.65 * s, z + nz * 0.15 * s), X, Y, 0.17 * s, 0.018 * s, { wash: 0xa87a2c, line: 0, accent: true });
    }
    paintedBeam(k, x, m, y + 4.95 * s, z, w + 0.8 * s, 0.48 * s, 0.52 * s, MALACHITE, AZURITE);
    const out = a < cx ? -1 : 1;
    // the bracket row stops short of the centre post, under the side roof's inner hip
    dougong(k, out < 0 ? a - 0.3 * s : a + 0.15 * s, out < 0 ? b - 0.15 * s : b + 0.3 * s, y + 5.43 * s, z, s * 0.9);
    // the side roof: its outer hip flies out past the outer post, its inner hip tucks in against the centre post (a
    // symmetric roof over the side bay reached over the centre bay and hid the plaque)
    curvedRoof(k, x, signs, { cx: m + out * 0.35 * s, y0: y + 5.95 * s, cz: z, w: w + 0.6 * s, d: 2.2 * s, h: 1.15 * s, lift: 0.52 * s, flare: 0.26 * s, tile: TILE, neon: P.neonEaves, ornaments: false });
    sparrowBrace(x, a + 0.32 * s, y + 3.75 * s, z, 1, 0.9 * s, s);
    sparrowBrace(x, b - 0.32 * s, y + 3.75 * s, z, -1, 0.9 * s, s);
    lantern(m - w * 0.22, y + 3.72 * s, z, 0.95 * s);
    lantern(m + w * 0.22, y + 3.72 * s, z, 0.95 * s);
    lantern(m, y + 3.0 * s, z + 0.45 * s, 0.85 * s);
  }
  // couplets on the inner posts, both faces: white boards, black kai
  for (const nz of [1, -1]) {
    signs.place({ at: new Vector3(p1, y + 3.2 * s, z + nz * 0.4 * s), normal: new Vector3(0, 0, nz), size: 0.44 * s, spec: { text: P.couplets[nz > 0 ? 0 : 1], color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
    signs.place({ at: new Vector3(p2, y + 3.2 * s, z + nz * 0.4 * s), normal: new Vector3(0, 0, nz), size: 0.44 * s, spec: { text: P.couplets[nz > 0 ? 1 : 0], color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  }
  for (let i = 0; i < 3; i++) lantern(p1 + bw * (0.25 + i * 0.25), y + 4.75 * s, z, 1.1 * s);
  // a second, lower row a step into the passage (style-A: five lanterns fill the centre bay)
  for (const t of [0.375, 0.625]) lantern(p1 + bw * t, y + 4.25 * s, z - 0.7 * s, s);
  // a third row on long cords in the passage, both faces (A2 target 5: lanterns at 1.5× head height as you walk through)
  for (const [t, dz] of [[0.2, 0.6], [0.5, -0.5], [0.8, 0.6]] as const) lantern(p1 + bw * t, y + 3.55 * s, z + dz * s, 0.95 * s);
  // the stone lions before the centre posts, facing the square
  // the pedestals of the guardian lions before the centre bay: the TRELLIS lions (props3d.ts) sit on them
  if (P.lions) {
    lionPedestal(k, x, p1 - 0.2 * s, y, z + 2.3 * s, 0.95);
    lionPedestal(k, x, p2 + 0.2 * s, y, z + 2.3 * s, 0.95);
  }
}
