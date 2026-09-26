// What crosses the Yamen Well (dome B2, E169; dome C's first cut): every crossing at hero quality, built along x at a
// given z (the Well's short axis, so each one reads across the canyon from the rim), against the dome-B2 targets
// (art/nine-dragon-stack/round-15-eight-domes/B2-well-edge-look/) and mockups B / D:
// - arched stone bridges (石拱橋): a humped flagged deck on a real elliptical arch that springs from the gallery fronts,
//   a proud voussoir ring with a keystone, a cornice, a carved balustrade with lotus-bud posts, lamp posts at the ends,
//   lanterns hung under the crown, vines down the spandrels, a brass dragon hook at the crown;
// - timber bridges: a planked deck on stringers and knee braces, cinnabar lattice railings with a lantern on every
//   other post, a little roofed pavilion (亭) over mid-span with its plaque, lightbox signs hung under the deck;
// - steel catwalks: a sagging grated deck slung from two cables anchored under the gallery above, hangers, barred
//   railings (alpha-cut), pipe runs and a neon strip along one edge;
// - the covered bridge (廊橋): lacquer walls with a band of lit windows under a glazed hip roof, lanterns, a neon sign;
// - the gate bridge: the stone arch with a flat wide deck, dome B's paifang across its middle, a crowd;
// - the sagging wire nets strung like hammocks between the fronts, tied off, with the rubbish they catch;
// - the gondola's stations (a platform, the machine room's lit windows, the bullwheel) and its cabin.
// Walkable crossings return their collision (deck boxes following the hump or sag, rail walls on both edges).
// Geometry detail steps down with `lod` (0 near the rim and dome B2's anchor, 2 far up the run north).
import { Vector3 } from 'three';
import type { ColliderDesc } from '../../../world/registry';
import type { Ctx } from './ctx';
import { buildGate } from './gate';
import type { KitX } from './hero/kitx';
import { E, K, Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import { dragonHook } from './props';
import { hipRoof } from './square';
import { WORDS } from './towers';
import { stand } from './well-galleries';
import { NEON, Rng, clamp } from '../util';

export type BridgeKind = 'stone' | 'timber' | 'steel' | 'covered' | 'gate';

export interface BridgeSpec {
  kind: BridgeKind;
  /** the crossing's axis (z), its deck height at the ends (y), its ends at the gallery fronts (x0 < x1) and width */
  z: number;
  y: number;
  x0: number;
  x1: number;
  w: number;
  seed: number;
  /** people on it */
  crowd: number;
  /** 0 hero, 1 mid, 2 far (fewer segments, no small parts) */
  lod?: number;
  /** where an arch springs (the gallery fronts a few metres below the deck; default the deck's ends) */
  ax0?: number;
  ax1?: number;
  /** the gallery fronts one floor up: anything taller than a railing stays inside [top0, top1] */
  top0?: number;
  top1?: number;
  /** an x where nobody stands and nothing is built overhead (dome B2's anchor stands there) */
  clear?: number;
}

const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1), NZ = new Vector3(0, 0, -1);
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

const STONE: Look = { wash: 0x66676b, kind: K.stone, line: 1, wet: 0.35, surf: SURF.concrete };
const STONE_FACE: Look = { wash: 0x5f6064, kind: K.stone, line: 1, wet: 0.3, surf: SURF.concrete };
const STONE_TOP: Look = { wash: 0x54565c, kind: K.flag, line: 0, wet: 0.8 };
const STONE_PANEL: Look = { wash: 0x626367, kind: K.panel, line: 1, wet: 0.3 };
const VOUSSOIR: Look = { wash: 0x76767a, kind: K.stone, line: 1.2, wet: 0.25, surf: SURF.concrete };
const SOFFIT: Look = { wash: 0x44464c, kind: K.stone, line: 0.6, wet: 0.2 };
const CORNICE: Look = { wash: 0x707174, line: 1.1, wet: 0.3, surf: SURF.concrete };
const VINE: Look = { wash: 0x2f4a36, kind: K.leaf, line: 0 };
const VINE2: Look = { wash: 0x3d5a34, kind: K.leaf, line: 0 };
const TIMBER: Look = { wash: 0x5a4332, line: 1, surf: SURF.wood };
const TIMBER_TOP: Look = { wash: 0x6f5746, line: 0, wet: 0.45, surf: SURF.wood };
const LACQUER: Look = { wash: 0x8e2a1e, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer };
const LACQUER_POST: Look = { wash: 0x9c3627, line: 1, accent: true, surf: SURF.lacquer };
const GILT: Look = { wash: 0xc9a24a, line: 1, accent: true, gloss: true };
const STEEL: Look = { wash: 0x3a3d44, line: 0.9 };
const STEEL_DK: Look = { wash: 0x26282d, line: 0.7 };
const GRATE: Look = { wash: 0x3e4148, kind: K.bars, row: 0, col: 0.09, line: 0.6, wet: 0.5 };
const BARS: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.13, line: 1 };
const DARK: Look = { wash: 0x2a2320, line: 0.8 };
const ROPE: Look = { wash: 0x2a2c31, line: 0.6 };
const WARM_GLASS: Look = { wash: 0xffd6a0, emit: 1.05, kind: K.facade, row: 1.2, col: 0.62, seed: 11, line: 1, accent: true };
const TILES = [0x2f8a6a, 0x2e5fa3, 0x2f8a6a, 0x1f5a4a] as const;

type Surface = 'stone' | 'wood' | 'metal';

/** the collision of a deck following `yAt` over x0..x1: tilted slabs under the walking surface, rail walls on both edges */
function deckColliders(x0: number, x1: number, z: number, w: number, yAt: (x: number) => number, n: number, surface: Surface, rails = true): ColliderDesc[] {
  const out: ColliderDesc[] = [];
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    const ya = yAt(xa), yb = yAt(xb);
    const a = Math.atan2(yb - ya, xb - xa);
    const len = Math.hypot(xb - xa, yb - ya);
    const rot = { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) };
    const nx = -Math.sin(a), ny = Math.cos(a);
    const cx = (xa + xb) / 2, cy = (ya + yb) / 2;
    out.push({ kind: 'box', x: cx - nx * 0.15, y: cy - ny * 0.15, z, hx: len / 2 + 0.03, hy: 0.15, hz: w / 2, rot, surface });
    if (rails) for (const s of [-1, 1]) out.push({ kind: 'box', x: cx + nx * 0.55, y: cy + ny * 0.55, z: z + s * (w / 2 - 0.08), hx: len / 2, hy: 0.55, hz: 0.08, rot, surface });
  }
  return out;
}

/** a vine (or a hanging creeper) down a face: a leafy strip from `top` down `len` metres, `w` wide, just proud of the face */
function vine(k: Kit, top: Vector3, n: Vector3, len: number, w: number, rng: Rng): void {
  const look = rng.chance(0.5) ? VINE : VINE2;
  const side = new Vector3().crossVectors(UP, n).normalize();
  // two overlapping strips, the lower one narrower (a creeper tapers)
  k.boxAxes(top.clone().addScaledVector(n, 0.08).add(new Vector3(0, -len * 0.3, 0)), side, UP, n, w / 2, len * 0.3, 0.07, look);
  k.boxAxes(top.clone().addScaledVector(n, 0.1).addScaledVector(side, rng.range(-0.15, 0.15)).add(new Vector3(0, -len * 0.75, 0)), side, UP, n, w * 0.3, len * 0.25, 0.06, look);
}

/**
 * A row of paper lanterns hung just outside a crossing's south rail (the side the rim looks at), one every `spacing` m,
 * none within 1.5 m of `clear`: at 60–110 m a crossing reads first as a line of warm lights across the canyon.
 */
function railLanterns(ctx: Ctx, x0: number, x1: number, z: number, yAt: (x: number) => number, h: number, spacing: number, clear?: number): void {
  const n = Math.max(1, Math.round((x1 - x0) / spacing));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    if (clear !== undefined && Math.abs(x - clear) < 1.5) continue;
    ctx.lantern(x, yAt(x) + h, z, 0.6);
  }
}

/** a lamp post: a stone post with a lotus cap and a paper lantern hung from a crook */
function lampPost(ctx: Ctx, k: Kit, x: number, y: number, z: number, out: number): void {
  k.box(x, y, z, 0.3, 2.1, 0.3, STONE);
  k.cyl(x, y + 2.1, z, 0.2, 0.14, 0.12, 8, STONE);
  k.beam(new Vector3(x, y + 2.05, z), new Vector3(x, y + 2.05, z + out * 0.55), 0.06, 0.06, STEEL_DK);
  ctx.lantern(x, y + 1.75, z + out * 0.55, 0.8);
}

/** a carved balustrade along a deck edge (at z) from x0 to x1: lotus-bud posts, carved panels, a top rail, a plinth */
function balustrade(k: Kit, x0: number, x1: number, z: number, yAt: (x: number) => number, lod: number): void {
  const nP = Math.max(2, Math.round((x1 - x0) / 1.9));
  const xp = (i: number): number => x0 + ((x1 - x0) * i) / nP;
  for (let i = 0; i <= nP; i++) {
    const x = xp(i), y = yAt(x);
    k.box(x, y, z, 0.26, 1.02, 0.26, STONE);
    if (lod < 2) {
      k.cyl(x, y + 1.02, z, 0.17, 0.14, 0.1, 8, STONE);
      k.cyl(x, y + 1.12, z, 0.14, 0.02, 0.3, 8, STONE, { caps: false });
    }
    if (i === nP) continue;
    const a = new Vector3(x + 0.13, y, z), b = new Vector3(xp(i + 1) - 0.13, yAt(xp(i + 1)), z);
    const d = b.clone().sub(a).normalize();
    const c = a.clone().add(b).multiplyScalar(0.5);
    // (d, its perpendicular in the xy plane, +z) is right-handed for a chord along +x
    const perp = new Vector3(-d.y, d.x, 0);
    k.boxAxes(c.clone().add(new Vector3(0, 0.5, 0)), d, perp, Z, a.distanceTo(b) / 2, 0.3, 0.06, STONE_PANEL);
    k.beam(a.clone().add(new Vector3(0, 0.88, 0)), b.clone().add(new Vector3(0, 0.88, 0)), 0.2, 0.1, STONE);
    k.beam(a.clone().add(new Vector3(0, 0.09, 0)), b.clone().add(new Vector3(0, 0.09, 0)), 0.22, 0.18, STONE);
  }
}

/**
 * The stone arch under a deck: an elliptical intrados springing at (ax0, ax1) `drop` below the deck, the spandrel walls
 * up to the deck on both faces, the soffit, a proud voussoir ring with a keystone, solid abutments out to the deck's
 * ends, a cornice under the deck edge and the flagged deck on top. Returns the intrados height at the crown.
 */
function archDeck(k: Kit, B: BridgeSpec, yt: (x: number) => number, drop: number, lod: number): number {
  const zf = B.z + B.w / 2, zb = B.z - B.w / 2;
  const ax0 = Math.max(B.x0, B.ax0 ?? B.x0), ax1 = Math.min(B.x1, B.ax1 ?? B.x1);
  const ys = B.y - drop;
  const cx = (ax0 + ax1) / 2, a = (ax1 - ax0) / 2;
  const crown = yt(cx) - 1.05;
  const H = Math.max(1, crown - ys);
  const N = lod >= 2 ? 10 : lod === 1 ? 14 : 20;
  // the arch's points (angle from π at the west springing to 0 at the east), then the abutments
  const xs: number[] = [B.x0];
  const yi: number[] = [ys];
  if (ax0 > B.x0 + 0.05) { xs.push(ax0); yi.push(ys); }
  for (let i = 1; i < N; i++) {
    const th = Math.PI * (1 - i / N);
    xs.push(cx + a * Math.cos(th));
    yi.push(ys + H * Math.sin(th));
  }
  if (ax1 < B.x1 - 0.05) { xs.push(ax1); yi.push(ys); }
  xs.push(B.x1);
  yi.push(ys);
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i] ?? 0, x1 = xs[i + 1] ?? 0, b0 = yi[i] ?? ys, b1 = yi[i + 1] ?? ys;
    const t0 = yt(x0), t1 = yt(x1);
    const len = Math.hypot(x1 - x0, t1 - t0);
    k.quad4(new Vector3(x0, t0, zf), new Vector3(x1, t1, zf), new Vector3(x1, t1, zb), new Vector3(x0, t0, zb), len, B.w, STONE_TOP, x0, 0, E.none);
    // the spandrels (their ruling is the cornice and the ring, drawn below)
    k.quad4(new Vector3(x0, b0, zf), new Vector3(x1, b1, zf), new Vector3(x1, t1, zf), new Vector3(x0, t0, zf), Math.abs(x1 - x0), Math.max(t0 - b0, 0.1), { ...STONE_FACE, edges: E.none }, x0, b0);
    k.quad4(new Vector3(x1, b1, zb), new Vector3(x0, b0, zb), new Vector3(x0, t0, zb), new Vector3(x1, t1, zb), Math.abs(x1 - x0), Math.max(t1 - b1, 0.1), { ...STONE_FACE, edges: E.none }, x1, b1);
    // the soffit (under the arch) or the abutment's foot
    k.quad4(new Vector3(x1, b1, zf), new Vector3(x0, b0, zf), new Vector3(x0, b0, zb), new Vector3(x1, b1, zb), Math.hypot(x1 - x0, b1 - b0), B.w, { ...SOFFIT, edges: E.none }, x1, 0);
    // the cornice under the deck edge, both faces
    for (const zz of [zf + 0.1, zb - 0.1]) k.beam(new Vector3(x0, t0 - 0.16, zz), new Vector3(x1, t1 - 0.16, zz), 0.26, 0.2, CORNICE);
  }
  // the voussoir ring: finer than the spandrel's segments, each block ruled, proud of both faces; a keystone at the crown
  const R = lod >= 2 ? 16 : 30;
  const ringW = clamp(a * 0.06, 0.45, 0.75);
  const pt = (th: number, off: number): Vector3 => {
    const nx = H * Math.cos(th), ny = a * Math.sin(th);
    const l = Math.hypot(nx, ny) || 1;
    return new Vector3(cx + a * Math.cos(th) + (nx / l) * off, ys + H * Math.sin(th) + (ny / l) * off, 0);
  };
  for (let i = 0; i < R; i++) {
    const th0 = Math.PI * (1 - i / R), th1 = Math.PI * (1 - (i + 1) / R);
    const i0 = pt(th0, 0), i1 = pt(th1, 0), o0 = pt(th0, ringW), o1 = pt(th1, ringW);
    const wv = i0.distanceTo(i1);
    for (const [zz, s] of [[zf + 0.05, 1], [zb - 0.05, -1]] as const) {
      const A = i0.clone().setZ(zz), Bv = i1.clone().setZ(zz), C = o1.clone().setZ(zz), D = o0.clone().setZ(zz);
      if (s > 0) k.quad4(A, Bv, C, D, wv, ringW, { ...VOUSSOIR, edges: E.all }, 0, 0);
      else k.quad4(Bv, A, D, C, wv, ringW, { ...VOUSSOIR, edges: E.all }, 0, 0);
    }
  }
  if (lod < 2) {
    const kc = pt(Math.PI / 2, ringW / 2);
    k.box(kc.x, kc.y - ringW / 2 - 0.08, B.z, 0.62, ringW + 0.34, B.w + 0.2, { ...VOUSSOIR, wash: 0x7c7b7c });
    // the springing blocks: a corbel under each end of the ring
    for (const x of [ax0, ax1]) {
      const s = x === ax0 ? 1 : -1;
      k.box(x + s * 0.35, ys - 0.7, B.z, 0.9, 0.7, B.w + 0.3, STONE);
      k.box(x + s * 0.2, ys - 1.6, B.z, 0.55, 0.9, B.w + 0.1, STONE);
    }
  }
  return crown;
}

/** a low arched stone bridge: a humped deck on a real arch, a carved balustrade, lamp posts, lanterns, vines, a hook */
function stoneBridge(ctx: Ctx, k: Kit, B: BridgeSpec, rng: Rng): ColliderDesc[] {
  const lod = B.lod ?? 0;
  const span = B.x1 - B.x0;
  const rise = Math.min(1.1, span * 0.05);
  const yt = (x: number): number => B.y + rise * Math.sin((Math.PI * (x - B.x0)) / span);
  const drop = archDrop('stone', span);
  const crown = archDeck(k, B, yt, drop, lod);
  const zf = B.z + B.w / 2, zb = B.z - B.w / 2;
  for (const zz of [zf - 0.14, zb + 0.14]) balustrade(k, B.x0 + 0.15, B.x1 - 0.15, zz, yt, lod);
  const xm = (B.x0 + B.x1) / 2;
  // what still reads at 100 m (lanterns glow, vines break the arch's line): lanterns under the crown on cords, the
  // end lanterns (on stone lamp posts near, bare far), vines down the spandrels
  for (const dz of [-B.w * 0.3, B.w * 0.3]) {
    const x = xm + rng.range(-1.2, 1.2);
    k.beam(new Vector3(x, crown, B.z + dz), new Vector3(x, crown - 0.9, B.z + dz), 0.02, 0.02, ROPE);
    ctx.lantern(x, crown - 1.2, B.z + dz, 0.85);
  }
  for (const x of [B.x0 + 0.5, B.x1 - 0.5]) {
    for (const [zz, o] of [[zf - 0.14, 1], [zb + 0.14, -1]] as const) {
      if (lod < 2) lampPost(ctx, k, x, yt(x), zz, o);
      else ctx.lantern(x, yt(x) + 1.6, zz + o * 0.3, 0.8);
    }
  }
  for (let i = 0; i < (lod < 2 ? 5 : 3); i++) {
    const x = rng.range(B.x0 + 1, B.x1 - 1);
    const south = rng.chance(0.6);
    vine(k, new Vector3(x, yt(x) - 0.25, south ? zf + 0.05 : zb - 0.05), south ? Z : NZ, rng.range(1.2, Math.min(3.8, drop * 0.7)), rng.range(0.5, 0.95), rng);
  }
  railLanterns(ctx, B.x0 + 1.2, B.x1 - 1.2, zf + 0.2, yt, 1.45, lod === 0 ? 3.4 : 2.6);
  if (lod < 2) {
    // a carved name plaque on the south face at the crown
    ctx.signs.place({ at: new Vector3(xm, yt(xm) - 0.55, zf + 0.16), normal: Z, size: 0.36, spec: { text: rng.pick(['九龍', '萬家', '天下']), color: '#e7c46a', vertical: false, style: 'plaque' }, gain: 1.3 }, k);
    // the brass dragon hook the grapple bites, out from the crown's balustrade over the south face
    dragonHook(k, ctx, new Vector3(xm + 1.6, yt(xm + 1.6) + 0.55, zf + 0.05), Z, 0.7);
  }
  for (let i = 0; i < B.crowd; i++) {
    const x = rng.range(B.x0 + 0.8, B.x1 - 0.8);
    stand(ctx, new Vector3(x, yt(x), B.z + rng.range(-B.w / 3, B.w / 3)), rng.chance(0.5) ? X : X.clone().negate(), rng.range(0.94, 1.04));
  }
  return deckColliders(B.x0, B.x1, B.z, B.w, yt, 6, 'stone');
}

/** the timber deck, its stringers, joists and knee braces (shared by the timber and covered bridges) */
function timberDeck(k: Kit, B: BridgeSpec, yt: (x: number) => number, n: number): void {
  const zf = B.z + B.w / 2, zb = B.z - B.w / 2;
  for (let i = 0; i < n; i++) {
    const x0 = B.x0 + ((B.x1 - B.x0) * i) / n, x1 = B.x0 + ((B.x1 - B.x0) * (i + 1)) / n;
    const t0 = yt(x0), t1 = yt(x1);
    const len = Math.hypot(x1 - x0, t1 - t0);
    k.quad4(new Vector3(x0, t0, zf), new Vector3(x1, t1, zf), new Vector3(x1, t1, zb), new Vector3(x0, t0, zb), len, B.w, { ...TIMBER_TOP, kind: K.panel }, x0, 0, E.none);
    for (const [zz, s] of [[zf, 1], [zb, -1]] as const) {
      const a = new Vector3(x0, t0, zz), b = new Vector3(x1, t1, zz);
      if (s > 0) k.quad4(a.clone().setY(t0 - 0.22), b.clone().setY(t1 - 0.22), b, a, len, 0.22, { ...TIMBER, edges: E.v0 | E.v1 }, x0, 0);
      else k.quad4(b.clone().setY(t1 - 0.22), a.clone().setY(t0 - 0.22), a, b, len, 0.22, { ...TIMBER, edges: E.v0 | E.v1 }, x0, 0);
      // a stringer under each edge
      k.beam(new Vector3(x0, t0 - 0.45, zz - s * 0.25), new Vector3(x1, t1 - 0.45, zz - s * 0.25), 0.22, 0.45, DARK);
    }
    k.quad4(new Vector3(x1, t1 - 0.22, zf), new Vector3(x0, t0 - 0.22, zf), new Vector3(x0, t0 - 0.22, zb), new Vector3(x1, t1 - 0.22, zb), len, B.w, { ...TIMBER, wash: 0x3e3028, edges: E.none }, x1, 0);
  }
  for (let x = B.x0 + 0.6; x < B.x1 - 0.3; x += 1.1) k.box(x, yt(x) - 0.62, B.z, 0.16, 0.2, B.w + 0.24, DARK);
  // knee braces from the fronts below up to the deck, both edges, both ends
  for (const [x, s] of [[B.x0, 1], [B.x1, -1]] as const) {
    for (const zz of [zf - 0.25, zb + 0.25]) k.beam(new Vector3(x + s * 0.1, B.y - 2.3, zz), new Vector3(x + s * 2.2, yt(x + s * 2.2) - 0.55, zz), 0.16, 0.16, DARK);
  }
}

/** a lattice railing (cinnabar panels between posts) along x at z, following the deck */
function latticeRail(ctx: Ctx, k: Kit, x0: number, x1: number, z: number, yt: (x: number) => number, lanterns: boolean, lod: number, clear?: number): void {
  const n = Math.max(2, Math.round((x1 - x0) / 1.6));
  // the posts (none within 0.9 m of `clear`: the panel there runs on to the next post, the view over the rail stays open)
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    if (clear === undefined || Math.abs(x - clear) > 0.9 || i === 0 || i === n) xs.push(x);
  }
  xs.forEach((x, i) => {
    const y = yt(x);
    k.box(x, y, z, 0.15, 1.18, 0.15, LACQUER_POST);
    if (lod < 2) k.box(x, y + 1.18, z, 0.22, 0.08, 0.22, GILT);
    if (lanterns && i % 4 === 2 && i < xs.length - 1 && (clear === undefined || Math.abs(x - clear) > 2)) ctx.lantern(x, y + 1.55, z, 0.62);
    const xb = xs[i + 1];
    if (xb === undefined) return;
    const yb = yt(xb);
    const a = new Vector3(x + 0.08, y, z), b = new Vector3(xb - 0.08, yb, z);
    const d = b.clone().sub(a).normalize();
    k.boxAxes(a.clone().add(b).multiplyScalar(0.5).add(new Vector3(0, 0.55, 0)), d, new Vector3(-d.y, d.x, 0), Z, a.distanceTo(b) / 2, 0.4, 0.035, LACQUER);
    k.beam(a.clone().add(new Vector3(0, 1.0, 0)), b.clone().add(new Vector3(0, 1.0, 0)), 0.14, 0.1, { ...LACQUER_POST, kind: K.plain });
  });
}

/** a lightbox signboard hung under a deck on two chains, facing south (toward the rim) */
function hangingSign(ctx: Ctx, k: Kit, x: number, yTop: number, z: number, rng: Rng): void {
  const word = rng.pick(WORDS);
  const size = rng.range(0.42, 0.6);
  const n = Array.from(word).length;
  const h = size * (n + 0.62);
  const cy = yTop - 0.35 - h / 2;
  for (const dx of [-size * 0.5, size * 0.5]) k.beam(new Vector3(x + dx, yTop, z), new Vector3(x + dx, cy + h / 2, z), 0.025, 0.025, ROPE);
  ctx.signs.place({ at: new Vector3(x, cy, z), normal: Z, size, spec: { text: word, color: hex(rng.pick([NEON.amber, 0xffe6b0, NEON.red, 0xfff1d6])), vertical: true, style: 'box' }, blade: true }, k);
}

/** a flat timber bridge: planked deck, lattice railings with lanterns, a roofed pavilion at mid-span, signs hung under */
function timberBridge(ctx: Ctx, k: Kit, B: BridgeSpec, rng: Rng): ColliderDesc[] {
  const lod = B.lod ?? 0;
  const span = B.x1 - B.x0;
  const camber = Math.min(0.4, span * 0.018);
  const yt = (x: number): number => B.y + camber * Math.sin((Math.PI * (x - B.x0)) / span);
  timberDeck(k, B, yt, lod >= 2 ? 5 : 10);
  const zf = B.z + B.w / 2 - 0.06, zb = B.z - B.w / 2 + 0.06;
  for (const zz of [zf, zb]) latticeRail(ctx, k, B.x0 + 0.08, B.x1 - 0.08, zz, yt, lod === 0, lod, B.clear);
  const xm = (B.x0 + B.x1) / 2;
  const top0 = B.top0 ?? B.x0, top1 = B.top1 ?? B.x1;
  // the pavilion stands off mid-span (a third of the way over, the side picked by the seed), never over `clear`
  let xp = B.x0 + span * (rng.chance(0.5) ? 0.34 : 0.66);
  if (B.clear !== undefined && Math.abs(xp - B.clear) < 3.2) xp = B.x0 + B.x1 - xp;
  if (span > 9 && xp - 2.4 > top0 && xp + 2.4 < top1) {
    // the pavilion: four red posts, a painted lintel each side, a glazed hip roof, a gilt plaque facing the rim
    const y = yt(xp), px = 1.7;
    for (const dx of [-px, px]) for (const zz of [zf, zb]) k.box(xp + dx, yt(xp + dx), zz, 0.2, 2.6, 0.2, LACQUER_POST);
    for (const zz of [zf, zb]) {
      k.box(xp, y + 2.35, zz, 2 * px + 0.3, 0.28, 0.16, { wash: 0x2a558f, line: 1, accent: true });
      k.box(xp, y + 2.18, zz, 2 * px - 0.2, 0.1, 0.12, GILT);
    }
    hipRoof(ctx, k, xp, y + 2.62, B.z, 2 * px + 1.5, B.w + 1.3, 1.05, 0.32, rng.pick(TILES), null);
    ctx.signs.place({ at: new Vector3(xp, y + 2.35, zf + 0.1), normal: Z, size: 0.3, spec: { text: rng.pick(['九龍', '萬家', '茶樓', '天下', '旅館']), color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.4 }, null);
    for (const dx of [-px - 0.5, px + 0.5]) for (const zz of [zf + 0.45, zb - 0.45]) ctx.lantern(xp + dx, y + 2.2, zz, 0.72);
    // lantern strings from the pavilion's eaves out to the bridge's ends (tied under the gallery above), both sides
    if (lod < 2) {
      for (const zz of [zf, zb]) {
        for (const [a, b] of [[xp - px - 0.2, B.x0 + 0.3], [xp + px + 0.2, B.x1 - 0.3]] as const) {
          const pa = new Vector3(a, y + 2.45, zz), pb = new Vector3(b, B.y + 2.35, zz);
          const n = Math.max(2, Math.round(pa.distanceTo(pb) / 1.9));
          const at = (t: number): Vector3 => pa.clone().lerp(pb, t).add(new Vector3(0, -0.35 * 4 * t * (1 - t), 0));
          for (let i = 0; i < n; i++) k.beam(at(i / n), at((i + 1) / n), 0.02, 0.02, ROPE);
          for (let i = 1; i < n; i++) { const p = at(i / n); if (B.clear === undefined || Math.abs(p.x - B.clear) > 1.6) ctx.lantern(p.x, p.y - 0.2, p.z, 0.55); }
        }
      }
    }
    // a brass dragon hook out from the pavilion's roof corner over the south side (a grapple point mid-canyon)
    if (lod === 0) dragonHook(k, ctx, new Vector3(xp + px + 0.3, y + 2.5, zf + 0.35), Z, 0.6);
  }
  if (lod >= 1) railLanterns(ctx, B.x0 + 0.8, B.x1 - 0.8, zf + 0.2, yt, 1.5, 2.6, B.clear);
  // lightbox signs hung under the deck, facing the rim
  const nS = span > 12 ? 2 : 1;
  for (let i = 0; i < nS; i++) hangingSign(ctx, k, B.x0 + span * (nS === 1 ? 0.35 : 0.25 + i * 0.5) + rng.range(-1, 1), yt(xm) - 0.62, B.z + B.w / 2 - 0.3, rng);
  for (let i = 0; i < B.crowd; i++) {
    const x = rng.range(B.x0 + 1, B.x1 - 1);
    if ((Math.abs(x - xp) < 2.1 && Math.abs(x - xp) > 1.4) || (B.clear !== undefined && Math.abs(x - B.clear) < 1.6)) continue;
    stand(ctx, new Vector3(x, yt(x), B.z + rng.range(-B.w / 3, B.w / 3)), rng.chance(0.5) ? X : X.clone().negate(), rng.range(0.94, 1.04));
  }
  return deckColliders(B.x0, B.x1, B.z, B.w, yt, 4, 'wood');
}

/** a steel catwalk: a sagging grated deck slung from two cables under the gallery above, hangers, barred railings */
function steelCatwalk(ctx: Ctx, k: Kit, ka: Kit, B: BridgeSpec, rng: Rng): ColliderDesc[] {
  const lod = B.lod ?? 0;
  const span = B.x1 - B.x0;
  const sag = Math.min(0.9, span * 0.035);
  const yd = (x: number): number => B.y - sag * Math.sin((Math.PI * (x - B.x0)) / span);
  const N = lod >= 2 ? 6 : 12;
  const zf = B.z + B.w / 2, zb = B.z - B.w / 2;
  const xAt = (i: number): number => B.x0 + (span * i) / N;
  for (let i = 0; i < N; i++) {
    const x0 = xAt(i), x1 = xAt(i + 1), t0 = yd(x0), t1 = yd(x1);
    const len = Math.hypot(x1 - x0, t1 - t0);
    k.quad4(new Vector3(x0, t0, zf), new Vector3(x1, t1, zf), new Vector3(x1, t1, zb), new Vector3(x0, t0, zb), len, B.w, { ...GRATE, edges: E.none }, x0, 0);
    k.quad4(new Vector3(x1, t1 - 0.06, zf), new Vector3(x0, t0 - 0.06, zf), new Vector3(x0, t0 - 0.06, zb), new Vector3(x1, t1 - 0.06, zb), len, B.w, { ...STEEL_DK, edges: E.none }, x1, 0);
    for (const [zz, s] of [[zf, 1], [zb, -1]] as const) {
      // the edge channel, the barred railing panel (alpha-cut) and its top rail
      k.beam(new Vector3(x0, t0 - 0.1, zz), new Vector3(x1, t1 - 0.1, zz), 0.08, 0.22, STEEL);
      const a = new Vector3(x0, t0, zz), b = new Vector3(x1, t1, zz);
      if (s > 0) ka.quad4(a, b, b.clone().setY(t1 + 1.05), a.clone().setY(t0 + 1.05), len, 1.05, { ...BARS, edges: E.none }, x0, 0);
      else ka.quad4(b, a, a.clone().setY(t0 + 1.05), b.clone().setY(t1 + 1.05), len, 1.05, { ...BARS, edges: E.none }, x0, 0);
      k.beam(new Vector3(x0, t0 + 1.05, zz), new Vector3(x1, t1 + 1.05, zz), 0.06, 0.06, STEEL);
      if (i % 2 === 0) k.box(x0, t0, zz, 0.07, 1.05, 0.07, STEEL);
    }
    // cross members under the deck
    k.box(x0, t0 - 0.22, B.z, 0.1, 0.14, B.w + 0.1, STEEL);
  }
  // the two main cables, anchored under the gallery above at each end, sagging to the railing's top at mid-span
  const yc = (x: number): number => {
    const u = (x - B.x0) / span;
    return yd(x) + 1.15 + (B.y + 2.55 - (B.y + 1.15)) * (2 * u - 1) ** 2;
  };
  for (const zz of [zf + 0.05, zb - 0.05]) {
    for (let i = 0; i < N; i++) k.beam(new Vector3(xAt(i), yc(xAt(i)), zz), new Vector3(xAt(i + 1), yc(xAt(i + 1)), zz), 0.05, 0.05, ROPE);
    for (let i = 1; i < N; i++) k.beam(new Vector3(xAt(i), yc(xAt(i)), zz), new Vector3(xAt(i), yd(xAt(i)) + 1.05, zz), 0.025, 0.025, ROPE);
    for (const x of [B.x0, B.x1]) k.box(x, B.y + 2.3, zz, 0.3, 0.4, 0.2, STEEL_DK);
  }
  // pipes and a cable bundle along the north side under the deck
  for (let j = 0; j < rng.int(1, 3); j++) {
    const zz = zb - 0.25 - j * 0.3;
    const look: Look = { wash: j === 0 ? 0x7c8187 : 0x8a6650, line: 0.8 };
    for (let i = 0; i < N; i += lod >= 2 ? 2 : 1) {
      const x0 = xAt(i), x1 = xAt(Math.min(N, i + (lod >= 2 ? 2 : 1)));
      k.beam(new Vector3(x0, yd(x0) - 0.35 - j * 0.12, zz), new Vector3(x1, yd(x1) - 0.35 - j * 0.12, zz), 0.2, 0.2, look);
    }
  }
  // a neon strip under the south edge, so it draws a line of light across the canyon (and lanterns off the rail, far)
  const strip = rng.pick([NEON.cyan, NEON.amber, NEON.magenta]);
  for (let i = 0; i < N; i++) ctx.signs.tube(new Vector3(xAt(i), yd(xAt(i)) - 0.14, zf + 0.06), new Vector3(xAt(i + 1), yd(xAt(i + 1)) - 0.14, zf + 0.06), Z, 0.05, strip, 3.2);
  if (lod >= 1) railLanterns(ctx, B.x0 + 1, B.x1 - 1, zf + 0.15, yd, 1.3, 2.8);
  for (let i = 0; i < B.crowd; i++) {
    const x = rng.range(B.x0 + 1, B.x1 - 1);
    stand(ctx, new Vector3(x, yd(x), B.z + rng.range(-0.25, 0.25)), rng.chance(0.5) ? X : X.clone().negate(), rng.range(0.94, 1.04));
  }
  return deckColliders(B.x0, B.x1, B.z, B.w, yd, 6, 'metal');
}

/** a covered bridge (廊橋): a timber deck, lacquer walls with a band of lit windows, a glazed hip roof, lanterns, a sign */
function coveredBridge(ctx: Ctx, k: Kit, B: BridgeSpec, rng: Rng): ColliderDesc[] {
  const lod = B.lod ?? 0;
  const yt = (): number => B.y;
  timberDeck(k, B, yt, lod >= 2 ? 3 : 6);
  const zf = B.z + B.w / 2 - 0.05, zb = B.z - B.w / 2 + 0.05;
  const top0 = Math.max(B.x0, B.top0 ?? B.x0) + 0.3, top1 = Math.min(B.x1, B.top1 ?? B.x1) - 0.3;
  const nB = Math.max(2, Math.round((B.x1 - B.x0) / 2.4));
  const bay = (B.x1 - B.x0) / nB;
  const H = 2.25;
  for (const [zz, s] of [[zf, 1], [zb, -1]] as const) {
    const n = s > 0 ? Z : NZ;
    const side = new Vector3().crossVectors(UP, n);
    for (let i = 0; i < nB; i++) {
      const xa = B.x0 + i * bay, c = xa + bay / 2;
      k.boxAxes(new Vector3(c, B.y + 0.45, zz), side, UP, n, bay / 2, 0.45, 0.05, LACQUER);
      k.boxAxes(new Vector3(c, B.y + 1.45, zz), side, UP, n, bay / 2 - 0.1, 0.55, 0.04, { ...WARM_GLASS, seed: 11 + i * 3 + (s > 0 ? 0 : 50) });
      k.boxAxes(new Vector3(c, B.y + 2.12, zz), side, UP, n, bay / 2, 0.13, 0.06, { wash: 0x2a558f, line: 1, accent: true });
      k.box(xa, B.y, zz, 0.18, H, 0.18, LACQUER_POST);
    }
    k.box(B.x1, B.y, zz, 0.18, H, 0.18, LACQUER_POST);
  }
  k.box((B.x0 + B.x1) / 2, B.y + H, B.z, B.x1 - B.x0 + 0.2, 0.18, B.w + 0.2, { wash: 0x5d4636, line: 1 });
  if (top1 - top0 > 3) {
    const cx = (top0 + top1) / 2;
    hipRoof(ctx, k, cx, B.y + H + 0.18, B.z, top1 - top0 + 0.8, B.w + 1.5, 1.2, 0.3, rng.chance(0.5) ? 0x2f8a6a : 0x2e5fa3, null);
    for (let x = top0 + 0.8; x < top1 - 0.5; x += lod < 2 ? 2.4 : 4.8) ctx.lantern(x, B.y + H - 0.2, zf + 0.5, 0.7);
  }
  if (lod < 2) {
    const word = rng.pick(WORDS);
    ctx.signs.place({ at: new Vector3((B.x0 + B.x1) / 2, B.y - 0.9, zf + 0.12), normal: Z, size: 0.55, spec: { text: word, color: hex(rng.pick([NEON.magenta, NEON.cyan, NEON.jade])), vertical: false, style: 'tube' } }, k);
  }
  for (let i = 0; i < B.crowd; i++) stand(ctx, new Vector3(rng.range(B.x0 + 1, B.x1 - 1), B.y, B.z + rng.range(-B.w / 4, B.w / 4)), rng.chance(0.5) ? X : X.clone().negate(), rng.range(0.94, 1.04));
  return deckColliders(B.x0, B.x1, B.z, B.w, yt, 2, 'wood');
}

/** how far below its deck a crossing's arch springs (well-mid.ts finds the gallery fronts at that depth) */
export function archDrop(kind: BridgeKind, span: number): number {
  return kind === 'gate' ? clamp(span * 0.32, 4, 8) : clamp(span * 0.5, 3.4, 8);
}

/**
 * A paifang for the far gate bridge (lod 2, ~100 m from the rim): dome B's gate (gate.ts buildGate, ~100 k triangles)
 * in outline — the same four lacquer posts, painted beams, the black-and-gold plaque and three glazed hip roofs at the
 * same heights — in ~2 k triangles; at that distance it is 60 px wide on the phone.
 */
function farGate(ctx: Ctx, k: Kit, cx: number, y: number, z: number, posts: readonly [number, number, number, number], s: number): void {
  const [p0, p1, p2, p3] = posts;
  const LAQ: Look = { wash: 0x662117, line: 1, accent: true, surf: SURF.lacquer };
  const AZ: Look = { wash: 0x2a558f, line: 1, accent: true };
  const MAL: Look = { wash: 0x2a7a5e, line: 1, accent: true };
  for (const [px, h] of [[p0, 5.43 * s], [p1, 7.05 * s], [p2, 7.05 * s], [p3, 5.43 * s]] as const) {
    k.box(px, y, z, 0.8 * s, 0.7 * s, 0.9 * s, STONE);
    k.cyl(px, y + 0.7 * s, z, 0.3 * s, 0.28 * s, h - 0.7 * s, 8, LAQ, { caps: false });
  }
  const bw = p2 - p1;
  k.box(cx, y + 5.0 * s, z, bw + 0.9 * s, 0.5 * s, 0.56 * s, AZ);
  k.box(cx, y + 6.75 * s, z, bw + 1.4 * s, 0.6 * s, 0.62 * s, MAL);
  k.box(cx, y + 5.5 * s, z, bw, 1.25 * s, 0.34 * s, { wash: 0x15120f, line: 1.2, accent: true });
  for (const nz of [1, -1]) ctx.signs.place({ at: new Vector3(cx, y + 6.1 * s, z + nz * 0.2 * s), normal: new Vector3(0, 0, nz), size: 0.8 * s, spec: { text: '九龍', color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.7 }, null);
  hipRoof(ctx, k, cx, y + 7.72 * s, z, bw + 2.4 * s, 2.6 * s, 1.55 * s, 0.68 * s, 0x1b2c33, null);
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) {
    const m = (a + b) / 2, w = b - a;
    k.box(m, y + 3.95 * s, z, w, 0.4 * s, 0.46 * s, AZ);
    k.box(m, y + 4.95 * s, z, w + 0.8 * s, 0.48 * s, 0.52 * s, MAL);
    const out = a < cx ? -1 : 1;
    hipRoof(ctx, k, m + out * 0.35 * s, y + 5.95 * s, z, w + 0.6 * s, 2.2 * s, 1.15 * s, 0.52 * s, 0x1b2c33, null);
    ctx.lantern(m, y + 3.72 * s, z, 0.95 * s);
  }
  for (let i = 0; i < 3; i++) ctx.lantern(p1 + bw * (0.25 + i * 0.25), y + 4.75 * s, z, 1.1 * s);
}

/** the gate bridge: the stone arch under a wide flat deck, carved balustrades, dome B's paifang across it, a crowd */
function gateBridge(ctx: Ctx, k: Kit, kx: KitX, B: BridgeSpec, rng: Rng): ColliderDesc[] {
  const lod = B.lod ?? 0;
  const yt = (): number => B.y;
  const span = B.x1 - B.x0;
  archDeck(k, B, yt, archDrop('gate', span), lod);
  const zf = B.z + B.w / 2, zb = B.z - B.w / 2;
  for (const zz of [zf - 0.15, zb + 0.15]) balustrade(k, B.x0 + 0.15, B.x1 - 0.15, zz, yt, lod);
  const cx = (B.x0 + B.x1) / 2;
  const posts = [cx - 5.4, cx - 2.3, cx + 2.3, cx + 5.4] as const;
  if (lod >= 2) farGate(ctx, k, cx, B.y, B.z, posts, 1.05);
  else {
    buildGate(k, kx, ctx.signs, (px, py, pz, ls) => { ctx.lantern(px, py, pz, ls); }, {
      x: cx, y: B.y, z: B.z, posts, s: 1.05, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false,
    });
  }
  for (const x of [B.x0 + 0.5, B.x1 - 0.5]) for (const [zz, o] of [[zf - 0.15, 1], [zb + 0.15, -1]] as const) lampPost(ctx, k, x, B.y, zz, o);
  for (let i = 0; i < B.crowd; i++) {
    const x = rng.range(B.x0 + 0.8, B.x1 - 0.8);
    if (posts.some((p) => Math.abs(x - p) < 0.9)) continue;
    stand(ctx, new Vector3(x, B.y, B.z + rng.range(-B.w / 2 + 0.7, B.w / 2 - 0.7)), rng.chance(0.55) ? Z : rng.chance(0.5) ? X : X.clone().negate(), rng.range(0.94, 1.04));
  }
  const out = deckColliders(B.x0, B.x1, B.z, B.w, yt, 1, 'stone');
  for (const p of posts) out.push({ kind: 'box', x: p, y: B.y + 3.5, z: B.z, hx: 0.45, hy: 3.5, hz: 0.45, surface: 'wood' });
  return out;
}

/** build one crossing; returns its collision */
export function bridge(ctx: Ctx, k: Kit, ka: Kit, kx: KitX, B: BridgeSpec): ColliderDesc[] {
  const rng = new Rng(B.seed);
  if (B.kind === 'stone') return stoneBridge(ctx, k, B, rng);
  if (B.kind === 'timber') return timberBridge(ctx, k, B, rng);
  if (B.kind === 'steel') return steelCatwalk(ctx, k, ka, B, rng);
  if (B.kind === 'covered') return coveredBridge(ctx, k, B, rng);
  return gateBridge(ctx, k, kx, B, rng);
}

const DEBRIS: readonly Look[] = [
  { wash: 0xe8dfc9, line: 0.6 }, { wash: 0xd9d4c4, line: 0.6 }, { wash: 0xc23b22, line: 0.6, accent: true },
  { wash: 0x6f9ccf, line: 0.6 }, { wash: 0x8a6a3a, line: 0.6 }, { wash: 0x3d5a34, kind: K.leaf, line: 0 },
];

/**
 * A sagging wire safety net strung like a hammock across the gap between the gallery fronts x0..x1, z0..z1, its rim at
 * height y, sagging `sag` m at the middle; ropes along its rim, tie-offs up to the fronts, and what it caught (paper,
 * a crate, a shoe, leaves). The mesh is in the alpha-cut kit, the ropes and the rubbish solid.
 */
export function net(k: Kit, ka: Kit, x0: number, x1: number, z0: number, z1: number, y: number, sag: number, seed = 1): void {
  const rng = new Rng(seed);
  const nx = 12, nz = Math.max(3, Math.round((z1 - z0) / 1.2));
  const drop = (u: number, v: number): number => sag * Math.sin(u * Math.PI) * (0.62 + 0.38 * Math.sin(v * Math.PI));
  const at = (i: number, j: number): Vector3 => {
    const u = i / nx, v = j / nz;
    return new Vector3(x0 + (x1 - x0) * u, y - drop(u, v), z0 + (z1 - z0) * v);
  };
  const look: Look = { wash: 0x2e3036, kind: K.net, col: 0.3, line: 1.0 };
  const cw = (x1 - x0) / nx, cz = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    ka.quad4(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), cw, cz, { ...look, edges: E.none }, x0 + i * cw, z0 + j * cz);
  }
  const rope: Look = { wash: 0x2a2c31, line: 0.6 };
  for (const j of [0, nz]) for (let i = 0; i < nx; i++) k.beam(at(i, j), at(i + 1, j), 0.06, 0.06, rope);
  for (const i of [0, nx]) for (let j = 0; j < nz; j++) k.beam(at(i, j), at(i, j + 1), 0.06, 0.06, rope);
  // a spine rope down the middle (the net's belly) and the tie-offs from each corner up to the fronts
  const jm = Math.round(nz / 2);
  for (let i = 0; i < nx; i++) k.beam(at(i, jm), at(i + 1, jm), 0.04, 0.04, rope);
  for (const i of [0, nx]) for (const j of [0, nz]) {
    const p = at(i, j);
    k.beam(p, p.clone().add(new Vector3(i === 0 ? -0.35 : 0.35, 1.6, 0)), 0.04, 0.04, rope);
  }
  // what it caught: settles into the belly
  const nD = rng.int(5, 10);
  for (let d = 0; d < nD; d++) {
    const u = clamp(0.5 + rng.range(-0.3, 0.3), 0.1, 0.9), v = rng.range(0.2, 0.8);
    const p = new Vector3(x0 + (x1 - x0) * u, y - drop(u, v) + 0.04, z0 + (z1 - z0) * v);
    const lk = rng.pick(DEBRIS);
    const big = rng.chance(0.2);
    k.box(p.x, p.y, p.z, big ? 0.5 : rng.range(0.18, 0.4), big ? 0.3 : 0.03, big ? 0.4 : rng.range(0.14, 0.3), lk, { rotY: rng.range(0, Math.PI) });
  }
}

/**
 * The gondola's station: a platform cantilevered off a wall at the cable's end on steel struts, a railing on its void
 * side, the machine room above with a band of lit windows, the bullwheel at the cable's height, a glazed hip roof, its
 * sign and lanterns. x0..x1 its extent (the wall at the end away from `face`, the void side toward it).
 */
export function station(ctx: Ctx, k: Kit, x0: number, x1: number, z: number, y: number, face: number, cableY: number): void {
  const cx = (x0 + x1) / 2, w = x1 - x0, D = 5.6;
  const edge = face > 0 ? x1 : x0;
  const floor = cableY - 4.2;
  // the platform (a deck, its fascia and struts back to the wall)
  k.box(cx, floor - 0.35, z, w + 0.4, 0.35, D + 0.4, { wash: 0x5a5d64, line: 1.4 }, { top: { wash: 0x4c4f56, kind: K.flag, line: 0, wet: 0.6 } });
  for (const dz of [-D / 2 + 0.3, D / 2 - 0.3]) k.beam(new Vector3(edge - face * w, floor - 3.2, z + dz), new Vector3(edge - face * 0.3, floor - 0.4, z + dz), 0.22, 0.22, STEEL);
  // the platform's railing on its void side and its two ends
  for (const dz of [-D / 2, D / 2]) k.box(cx, floor, z + dz, w, 1.05, 0.06, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.13, line: 1 });
  k.box(edge, floor + 1.0, z, 0.08, 0.08, D, STEEL);
  // the machine room over the platform's back half: lower wall, a band of lit windows, a frieze
  const mx = edge - face * (w * 0.62);
  const mw = w * 0.7;
  k.box(mx, floor, z, mw, 1.0, D, { wash: 0x8e939b, line: 1.2, surf: SURF.concrete });
  k.box(mx, floor + 1.0, z, mw - 0.04, 1.3, D - 0.04, { ...WARM_GLASS, row: 1.3, col: 0.8, seed: 23 });
  k.box(mx, floor + 2.3, z, mw, y - floor - 2.3, D, { wash: 0x7d828a, line: 1.2, surf: SURF.concrete });
  // the bullwheel at the cable's height, its hub and the housing's posts
  const bx = edge - face * 1.6;
  k.cyl(bx, cableY - 0.12, z, 2.0, 2.0, 0.24, 18, { wash: 0x2a2c31, line: 1 });
  k.cyl(bx, cableY - 0.3, z, 0.35, 0.35, 0.6, 8, { wash: 0x8a6650, line: 1 });
  k.box(bx, floor, z, 0.3, cableY - floor - 0.3, 0.3, STEEL);
  // the roof, its sign facing the canyon (both faces) and lanterns at the eave
  hipRoof(ctx, k, cx, y + 0.1, z, w + 1.2, D + 1.2, 1.3, 0.35, 0x2e5fa3, NEON.cyan);
  for (const dz of [1, -1]) ctx.signs.place({ at: new Vector3(mx, floor + 2.75, z + dz * (D / 2 + 0.07)), normal: new Vector3(0, 0, dz), size: 0.62, spec: { text: '纜車站', color: '#3fe6ff', vertical: false, style: 'tube' } }, k);
  for (const dz of [-D / 2 - 0.3, D / 2 + 0.3]) ctx.lantern(edge + face * 0.2, y - 0.5, z + dz, 0.8);
}

/**
 * The gondola's cabin (its origin on the cable; the mover slides it along x): a red lacquer body with a band of lit
 * windows and gilt trim, a hip roof, the hanger and the grip riding the cable on two wheels, a lamp at each end.
 */
export function gondolaCabin(): Kit {
  const k = new Kit();
  const RED: Look = { wash: 0xb32a1b, line: 1.1, accent: true, gloss: true, surf: SURF.lacquer };
  const RED_P: Look = { wash: 0xa82619, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer };
  const RED_DK: Look = { wash: 0x6e1a10, line: 1, accent: true };
  const GOLD: Look = { wash: 0xd9b25a, line: 1, accent: true, gloss: true };
  const GLASS: Look = { wash: 0xffdca6, emit: 1.2, kind: K.facade, row: 1.0, col: 0.6, seed: 5, line: 1, accent: true };
  const W = 2.9, D = 2.1, y0 = -4.35;
  k.box(0, y0, 0, W - 0.1, 0.14, D - 0.1, RED_DK);
  k.box(0, y0 + 0.14, 0, W, 0.92, D, RED_P);
  k.box(0, y0 + 1.06, 0, W - 0.06, 1.0, D - 0.06, GLASS);
  // mullions round the window band, a sill and a head trim in gilt
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) k.box(-W / 2 + (W * i) / 4, y0 + 1.06, s * (D / 2 - 0.02), 0.09, 1.0, 0.06, RED);
  for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) k.box(s * (W / 2 - 0.02), y0 + 1.06, -D / 2 + (D * i) / 3, 0.06, 1.0, 0.09, RED);
  k.box(0, y0 + 1.02, 0, W + 0.06, 0.06, D + 0.06, GOLD);
  k.box(0, y0 + 2.06, 0, W, 0.3, D, RED);
  k.box(0, y0 + 2.08, 0, W + 0.06, 0.05, D + 0.06, GOLD);
  // the hip roof (four slopes to a short ridge), a ridge cap
  const e = y0 + 2.36, r = e + 0.5;
  const A = new Vector3(-W / 2 - 0.14, e, D / 2 + 0.14), B = new Vector3(W / 2 + 0.14, e, D / 2 + 0.14), C = new Vector3(W / 2 + 0.14, e, -D / 2 - 0.14), Dd = new Vector3(-W / 2 - 0.14, e, -D / 2 - 0.14);
  const R0 = new Vector3(-0.5, r, 0), R1 = new Vector3(0.5, r, 0);
  const roof: Look = { wash: 0x7e1f14, kind: K.tiles, line: 1, accent: true };
  k.quad4(A, B, R1, R0, W, 1.2, roof, 0, 0, E.v0);
  k.quad4(C, Dd, R0, R1, W, 1.2, roof, 0, 0, E.v0);
  k.tri(Dd, A, R0, roof);
  k.tri(B, C, R1, roof);
  k.quad4(Dd, C, B, A, W, D, RED_DK);
  k.box(0, r - 0.05, 0, 1.2, 0.12, 0.16, GOLD);
  // the hanger (a yoke over the roof), the grip on the cable, its two wheels
  k.box(0, r, 0, 0.14, -0.5 - r, 0.14, { wash: 0x2a2c31, line: 1 });
  k.beam(new Vector3(-0.9, e + 0.02, 0), new Vector3(0, r + 0.5, 0), 0.08, 0.08, { wash: 0x2a2c31, line: 1 });
  k.beam(new Vector3(0.9, e + 0.02, 0), new Vector3(0, r + 0.5, 0), 0.08, 0.08, { wash: 0x2a2c31, line: 1 });
  k.box(0, -0.5, 0, 1.4, 0.34, 0.34, { wash: 0x3a3d44, line: 1 });
  for (const x of [-0.45, 0.45]) k.cyl(x, -0.15, 0, 0.2, 0.2, 0.12, 10, { wash: 0x55595f, line: 1 });
  // lamps at both ends and a destination plate on each side
  for (const s of [-1, 1]) {
    k.box(s * (W / 2 + 0.04), y0 + 0.55, 0, 0.08, 0.18, 0.34, { wash: 0xffe6b0, emit: 2.2, line: 0.5, accent: true });
    k.box(0, y0 + 0.4, s * (D / 2 + 0.03), 1.1, 0.26, 0.04, GOLD);
  }
  return k;
}
