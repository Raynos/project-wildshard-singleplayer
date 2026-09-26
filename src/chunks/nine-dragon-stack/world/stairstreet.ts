// Dome D (E169): the stair-street — mockup C (art/nine-dragon-stack/round-6-baseline-hud/comp-C-stair-street.jpg). From
// the south-east corner of Lantern Square a Chongqing stair-street climbs east between sign-covered towers: three
// flights of worn wet granite steps and two landings, the paifang on the second landing with the last flight rising on
// through it; on both sides stepped stone terraces (plinths, railings, potted plants, tea tables) in front of lit
// shopfronts, a tea house and a hotpot shop tucked under the square's towers at the foot; big hanging neon (麵 牙科 火鍋
// 旅館), a brass dragon-head hook on a sign bracket, strings of red lanterns across, a skybridge and a monorail over it,
// people with umbrellas on the steps.
//
// The stair is walkable: `stairColliders()` is its physics (rise 0.35 ≤ 0.35, tread 0.667 ≥ 0.36, PHYSICS.md) and
// `stairFloor(x)` its floor; world/colliders.ts (the port lead's) takes both. Everything else here is scenery behind
// the stair's side walls (colliders.ts: the walls at z = STAIR.z0 and STAIR.z1).
import { type BufferGeometry, Color, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import type { ColliderDesc } from '../../../world/registry';
import type { Ctx } from './ctx';
import { buildGate } from './gate';
import { dressWall, spanStreet } from './facade/grammar';
import type { PieceId } from './facade/pieces';
import { mahjong, mahjongSeats } from './hero/figures';
import { KitX } from './hero/kitx';
import { K, Kit, type Look } from './kit';
import { dragonHook } from './props';
import { SURF } from '../look/paint';
import { SignBuilder, type SignPlace } from '../look/signs';
import { PLAZA, STAIR, Y0 } from '../layout';
import { MIN, NEON, Rng } from '../util';

// ── the plan: three flights of 20 steps, two 4 m landings, the top landing ──

export const RISE = STAIR.rise / 60;
const LANDING = 4;
export const RUN = (STAIR.x1 - STAIR.x0 - 2 * LANDING) / 60;
export interface Flight { x0: number; x1: number; y0: number; steps: number }
export const FLIGHTS: readonly Flight[] = [0, 1, 2].map((i) => {
  const x0 = STAIR.x0 + i * (20 * RUN + LANDING);
  return { x0, x1: x0 + 20 * RUN, y0: Y0 + i * 20 * RISE, steps: 20 };
});
export const LANDINGS: readonly { x0: number; x1: number; y: number }[] = [0, 1].map((i) => {
  const f = FLIGHTS[i];
  const x0 = f === undefined ? 0 : f.x1;
  return { x0, x1: x0 + LANDING, y: Y0 + (i + 1) * 20 * RISE };
});
/** the top landing (its far end is the fragment's wall, colliders.ts STAIR_TOP) and the scenery street beyond it */
export const TOP_Y = Y0 + STAIR.rise;
/** the paifang on the second landing, spanning the stair (its front faces down the stair, west) */
const L2 = LANDINGS[1] ?? { x0: 0, x1: 0, y: 0 };
export const STAIR_GATE = { x: (L2.x0 + L2.x1) / 2, y: L2.y, z: (STAIR.z0 + STAIR.z1) / 2, s: 1.3, posts: [-3.83, -1.51, 1.51, 3.83] } as const;
/** the street between the tower faces past the square's towers (the stair is the middle 8 m; terraces either side) */
export const FACE_N = STAIR.z0 - 3, FACE_S = STAIR.z1 + 3;
/** the square's east towers flank the stair's first 12 m (their end faces on the stair's edges, base at Y0 + 5) */
export const SQ_BACK = PLAZA.x1 + 12.6;
const SQ_BASE = Y0 + 5;
/** the scenery street past the top landing ends here */
export const FAR_X = 102;

/** the floor under x along the stair-street (the tread tops; Y0 before the foot, the top landing after) */
export function stairFloor(x: number): number {
  if (x < STAIR.x0) return Y0;
  if (x >= STAIR.x1) return TOP_Y;
  for (const f of FLIGHTS) {
    if (x >= f.x0 && x < f.x1) return f.y0 + (Math.min(f.steps - 1, Math.floor((x - f.x0) / RUN)) + 1) * RISE;
  }
  for (const l of LANDINGS) if (x >= l.x0 && x < l.x1) return l.y;
  return TOP_Y;
}

/** the stair's physics: three `treads` flights, the two landing slabs, the paifang's four post bases with drum stones */
export function stairColliders(): ColliderDesc[] {
  const zc = (STAIR.z0 + STAIR.z1) / 2, w = STAIR.z1 - STAIR.z0;
  const out: ColliderDesc[] = FLIGHTS.map((f) => ({
    kind: 'treads', from: { x: f.x0, y: f.y0, z: zc }, to: { x: f.x1, y: f.y0 + f.steps * RISE, z: zc }, width: w, count: f.steps, surface: 'stone',
  }));
  for (const l of LANDINGS) out.push({ kind: 'box', x: (l.x0 + l.x1) / 2, y: l.y - 0.6, z: zc, hx: (l.x1 - l.x0) / 2, hy: 0.6, hz: w / 2, surface: 'stone' });
  const G = STAIR_GATE;
  for (const p of G.posts) out.push({ kind: 'box', x: G.x, y: G.y + 4.5, z: G.z + p, hx: 1.4 * G.s, hy: 4.5, hz: 0.7 * G.s, surface: 'stone' });
  return out;
}

// ── looks ──
const STEP_TOP: Look = { wash: 0x4a4c52, kind: K.flag, wet: 1, line: 1.8 };
const STEP_RISER: Look = { wash: 0x58575c, kind: K.stone, line: 1.8, wet: 0.7 };
const PLINTH: Look = { wash: 0x6a6866, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const COPING: Look = { wash: 0x77756f, kind: K.stone, line: 1.8, wet: 0.5 };
const TERRACE: Look = { wash: 0x55565a, kind: K.flag, wet: 0.8, line: 0 };
const TIMBER_DK: Look = { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood };
const LACQUER: Look = { wash: 0x7e2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const IRON: Look = { wash: 0x2a2c31, line: 0.8 };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const UP = new Vector3(0, 1, 0);
const XP = new Vector3(1, 0, 0), XN = new Vector3(-1, 0, 0), ZP = new Vector3(0, 0, 1), ZN = new Vector3(0, 0, -1);

// ── a rotated build: dome B's gate is built along x; the stair's paifang spans z ──

/** a Kit whose geometry is transformed once built */
class XfKit extends Kit {
  constructor(private readonly xf: Matrix4) { super(); }
  override build(): BufferGeometry { const g = super.build(); g.applyMatrix4(this.xf); return g; }
}
class XfKitX extends KitX {
  constructor(private readonly xf: Matrix4) { super(); }
  override build(): BufferGeometry { const g = super.build(); g.applyMatrix4(this.xf); return g; }
}
/** forwards signs to the real builder in world space; a sign's board goes into the (local, transformed) kit */
class XfSigns extends SignBuilder {
  constructor(private readonly inner: SignBuilder, private readonly xf: Matrix4) { super(inner.atlas); }
  override place(p: SignPlace, kit: Kit | null): { w: number; h: number } {
    const r = this.inner.place({ ...p, at: p.at.clone().applyMatrix4(this.xf), normal: p.normal.clone().transformDirection(this.xf) }, null);
    if (kit !== null) {
      const depth = p.blade === true ? 0.12 : 0.1;
      const c = p.at.clone();
      if (p.blade !== true) c.addScaledVector(p.normal, -depth / 2 + 0.01);
      const right = new Vector3().crossVectors(UP, p.normal).normalize();
      kit.boxAxes(c, right, UP, p.normal.clone(), r.w / 2 + 0.05, r.h / 2 + 0.05, depth / 2, { wash: 0x24262c, line: 1 });
    }
    return r;
  }
  override tube(a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker = 0): void {
    this.inner.tube(a.clone().applyMatrix4(this.xf), b.clone().applyMatrix4(this.xf), facing.clone().transformDirection(this.xf), width, color, gain, flicker);
  }
  override light(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode: 1 | 2 = 1, seed = 0): void {
    this.inner.light(c.clone().applyMatrix4(this.xf), right.clone().transformDirection(this.xf), up.clone().transformDirection(this.xf), w, h, color, gain, mode, seed);
  }
}

/** a facade-grammar piece (instanced with the towers' dressing): local +z along `n`, x along `u` */
function piece(ctx: Ctx, id: PieceId, at: Vector3, u: Vector3, n: Vector3, sx: number, sy: number, sz: number, c = 0xffffff): void {
  ctx.fd.pieces.push({ piece: id, m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(sx, sy, sz)).setPosition(at), c: new Color(c) });
}

/** an interior-mapped shop window / door (the facade's window program): bottom-centre `at`, facing `n` */
function shopGlass(ctx: Ctx, rng: Rng, at: Vector3, u: Vector3, n: Vector3, w: number, h: number, light: number, lit = 1): void {
  ctx.fd.windows.push({
    m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w, h, 1)).setPosition(at.clone().addScaledVector(n, 0.012)),
    win: new Vector4(rng.range(0, 97), lit, rng.chance(0.3) ? rng.range(0.1, 0.3) : 0, 16 + rng.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(light),
  });
}

function mat4(x: number, y: number, z: number, yaw: number, s = 1): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(s, s, s));
}

// ── the steps ──

function steps(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-steps', true);
  const zc = (STAIR.z0 + STAIR.z1) / 2, w = STAIR.z1 - STAIR.z0;
  for (const f of FLIGHTS) {
    for (let i = 0; i < f.steps; i++) {
      const x = f.x0 + i * RUN, top = f.y0 + (i + 1) * RISE;
      // each step is 3–4 long granite slabs laid across the stair, a shade apart, a few worn a little lower
      let z = STAIR.z0;
      while (z < STAIR.z1 - 0.05) {
        const len = Math.min(STAIR.z1 - z, rng.range(1.7, 3.1));
        const sag = rng.chance(0.2) ? rng.range(0.01, 0.03) : 0;
        const tone = rng.range(0.9, 1.08);
        const tint = (c: number): number => new Color(c).multiplyScalar(tone).getHex();
        k.box(x + RUN / 2, top - RISE - 0.3, z + len / 2, RUN + 0.02, RISE + 0.3 - sag, len - 0.02,
          { ...STEP_RISER, wash: tint(STEP_RISER.wash) }, { top: { ...STEP_TOP, wash: tint(STEP_TOP.wash) } });
        z += len;
      }
    }
  }
  for (const l of LANDINGS) k.box((l.x0 + l.x1) / 2, l.y - 0.6, zc, l.x1 - l.x0, 0.6, w, STEP_RISER, { top: { ...STEP_TOP, wet: 1 } });
  // the top landing and the scenery street past it, one slab across the whole street
  k.box((STAIR.x1 + FAR_X) / 2, TOP_Y - 0.6, (FACE_N + FACE_S) / 2, FAR_X - STAIR.x1, 0.6, FACE_S - FACE_N, STEP_RISER, { top: STEP_TOP });
}

// ── the foot: a tea house and a hotpot shop under the square's towers, a retaining wall up to the towers' base ──

function teaHouse(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const x0 = PLAZA.x1 + 0.6, x1 = x0 + 4.2, zf = STAIR.z0, zb = zf - 3.4;
  const floor = Y0 + 1.9, ceil = SQ_BASE;
  const cx = (x0 + x1) / 2;
  // the plinth (a stone retaining wall with a coping) and the veranda floor
  k.box(cx, Y0 - 0.4, (zf + zb) / 2, x1 - x0, floor - Y0 + 0.4, zf - zb, PLINTH, { top: { ...TERRACE, kind: K.plain, wash: 0x5a4632, surf: SURF.wood } });
  k.box(cx, floor - 0.12, zf - 0.15, x1 - x0 + 0.1, 0.16, 0.34, COPING);
  // the ceiling under the tower, the back wall (the lit room), the side walls
  k.box(cx, ceil - 0.25, (zf + zb) / 2, x1 - x0, 0.25, zf - zb, TIMBER_DK);
  shopGlass(ctx, rng, new Vector3(cx, floor, zb + 0.02), XP, ZP, x1 - x0 - 0.4, ceil - floor - 0.35, 0xffc47e, 1.1);
  k.box(x1 - 0.1, floor, (zf + zb) / 2, 0.2, ceil - floor, zf - zb, { ...TIMBER_DK, kind: K.panel });
  // red posts at the front, lattice screens between the outer ones and the wall, a lattice rail along the veranda
  for (const px of [x0 + 0.15, cx, x1 - 0.15]) k.box(px, floor, zf - 0.2, 0.2, ceil - floor, 0.2, LACQUER);
  const ka = ctx.alpha('stair-a');
  ka.quad(new Vector3(x0 + 0.25, floor + 0.05, zf - 0.22), XP, UP, x1 - x0 - 0.5, 0.95, { wash: 0x5a2a1c, kind: K.bars, row: 1, col: 0.12, line: 1, accent: true });
  k.box(cx, floor + 0.95, zf - 0.22, x1 - x0 - 0.3, 0.07, 0.1, LACQUER);
  // a lattice transom under the ceiling (格子)
  ka.quad(new Vector3(x0 + 0.25, ceil - 0.85, zf - 0.21), XP, UP, x1 - x0 - 0.5, 0.55, { wash: 0x5a2a1c, kind: K.net, col: 0.18, line: 1, accent: true });
  // the pent eave out over the stair (glazed tiles, a lacquer fascia) with lanterns under it
  const ey = ceil - 0.2, ez = zf + 1.35;
  k.quad4(new Vector3(x0 - 0.2, ey - 0.55, ez), new Vector3(x1 + 0.2, ey - 0.55, ez), new Vector3(x1 + 0.2, ey + 0.1, zf), new Vector3(x0 - 0.2, ey + 0.1, zf),
    x1 - x0 + 0.4, 1.5, { wash: MIN.malachite, kind: K.tiles, line: 1, accent: true });
  k.box(cx, ey - 0.68, ez, x1 - x0 + 0.4, 0.14, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  for (const t of [0.2, 0.5, 0.8]) ctx.lantern(x0 + (x1 - x0) * t, ey - 0.72, ez - 0.25, 0.85);
  // two tea tables on the veranda with their drinkers (TRELLIS sitters come with stools), a pot of plants at the end
  const kx = ctx.kitx('stair-foot');
  for (const [tx, tz, tr, n] of [[x0 + 1.1, zf - 1.4, 0.3, 3], [x0 + 3.0, zf - 1.5, -0.2, 2]] as const) {
    mahjong(k, kx, rng, tx, floor, tz, tr, 0, 0xb8352a, false);
    for (const st of mahjongSeats(tx, tz, tr).slice(0, n)) ctx.sitters.push(mat4(st.x, floor, st.z, st.yaw));
  }
  piece(ctx, 'plant', new Vector3(x0 + 0.4, floor, zf - 0.55), XP, ZP, 1.3, 1.5, 1.3);
  // the 茶 cloth banner hung off the eave's end, the 茶樓 board over the eave
  ctx.signs.place({ at: new Vector3(x0 + 0.55, ey - 1.55, ez - 0.1), normal: XN, size: 0.62, spec: { text: '茶', color: '#1a1614', vertical: true, style: 'banner', ink: '#e8e0cc' }, blade: true }, k);
  k.beam(new Vector3(x0 + 0.55, ey - 0.62, ez - 0.1), new Vector3(x0 + 0.55, ey - 0.62, zf), 0.05, 0.05, IRON);
  ctx.signs.place({ at: new Vector3(cx + 0.3, ceil + 0.55, zf + 0.12), normal: ZP, size: 0.62, spec: { text: '茶樓', color: hex(NEON.cyan), vertical: false, style: 'tube' } }, k);
  ctx.emitters.push({ at: new Vector3(cx, floor + 1.6, zf - 0.6), color: new Color(0xffc48a), w: x1 - x0 - 0.5, h: 2.6, power: 0.26, spill: 0.35 });
}

function hotpotShop(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const x0 = PLAZA.x1 + 0.6, x1 = x0 + 4.4, zf = STAIR.z1, zb = zf + 3.2;
  const floor = Y0 + 1.25, ceil = SQ_BASE;
  const cx = (x0 + x1) / 2;
  k.box(cx, Y0 - 0.4, (zf + zb) / 2, x1 - x0, floor - Y0 + 0.4, zb - zf, PLINTH, { top: { ...TERRACE } });
  k.box(cx, floor - 0.12, zf + 0.15, x1 - x0 + 0.1, 0.16, 0.34, COPING);
  k.box(cx, ceil - 0.25, (zf + zb) / 2, x1 - x0, 0.25, zb - zf, { wash: 0x3b3833, line: 1 });
  // a bright red-lit room: the hotpot's steam and the glow of its lamps
  shopGlass(ctx, rng, new Vector3(cx, floor, zb - 0.02), XN, ZN, x1 - x0 - 0.4, ceil - floor - 0.4, 0xff9a62, 1.15);
  k.box(x1 - 0.1, floor, (zf + zb) / 2, 0.2, ceil - floor, zb - zf, { wash: 0x6d6a66, kind: K.panel, line: 1 });
  for (const px of [x0 + 0.15, x1 - 0.15]) k.box(px, floor, zf + 0.2, 0.22, ceil - floor, 0.22, { wash: 0x8f949b, line: 1 });
  // a steel railing on the stone wall, a striped awning, a hotpot table with three diners, a cook at the pass
  const ka = ctx.alpha('stair-a');
  ka.quad(new Vector3(x1 - 0.25, floor + 0.05, zf + 0.18), XN, UP, x1 - x0 - 0.5, 0.95, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.14, line: 1 });
  k.box(cx, floor + 0.95, zf + 0.18, x1 - x0 - 0.3, 0.05, 0.06, IRON);
  piece(ctx, 'awning', new Vector3(cx, ceil - 0.55, zf), XN, ZN, x1 - x0 - 0.3, 1, 1.35, MIN.cinnabar);
  const kx = ctx.kitx('stair-foot');
  mahjong(k, kx, rng, cx - 0.5, floor, zf + 1.5, 0.1, 0, 0x2f5f9a, false);
  for (const st of mahjongSeats(cx - 0.5, zf + 1.5, 0.1).slice(0, 3)) ctx.sitters.push(mat4(st.x, floor, st.z, st.yaw));
  ctx.steam.push(new Vector3(cx - 0.5, floor + 1.0, zf + 1.5));
  for (const t of [0.25, 0.75]) ctx.lantern(x0 + (x1 - x0) * t, ceil - 0.7, zf + 0.9, 0.8);
  piece(ctx, 'plant', new Vector3(x1 - 0.45, floor, zf + 0.5), XN, ZN, 1.2, 1.4, 1.2);
  piece(ctx, 'plant', new Vector3(x0 + 0.5, floor, zf + 0.5), XN, ZN, 1.0, 1.2, 1.0);
  ctx.signs.place({ at: new Vector3(cx, ceil + 0.5, zf - 0.12), normal: ZN, size: 0.6, spec: { text: '火鍋', color: hex(NEON.red), vertical: false, style: 'tube' } }, k);
  ctx.emitters.push({ at: new Vector3(cx, floor + 1.5, zf + 0.6), color: new Color(0xff9a62), w: x1 - x0 - 0.5, h: 2.4, power: 0.26, spill: 0.35 });
}

/** the stone wall from the stair up to the square towers' base, between the foot shops and the first landing */
function footWalls(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  for (const [z0, z1, zFace, n] of [[STAIR.z0 - 3.4, STAIR.z0, STAIR.z0, ZP], [STAIR.z1, STAIR.z1 + 3.4, STAIR.z1, ZN]] as const) {
    const xa = PLAZA.x1 + 0.6 + (n === ZP ? 4.2 : 4.4), xb = SQ_BACK;
    k.box((xa + xb) / 2, Y0 - 0.4, (z0 + z1) / 2, xb - xa, SQ_BASE - Y0 + 0.4, z1 - z0, { ...PLINTH, kind: K.stone });
    // a moss-dark band and a ledge where it meets the tower, drain pipes down it, a small earth-god niche
    k.box((xa + xb) / 2, SQ_BASE - 0.35, zFace + n.z * 0.12, xb - xa, 0.3, 0.26, COPING);
    for (const px of [xa + 1.2, xa + 5.1]) piece(ctx, 'pipe', new Vector3(px, Y0, zFace), n.z > 0 ? XP : XN, n, 1.4, SQ_BASE - Y0 + 6, 1.4, 0x55595f);
    if (n === ZP) {
      const sx = xa + 2.6, sy = stairFloor(sx) + 0.6;
      k.box(sx, sy, zFace + 0.18, 0.7, 0.8, 0.36, { wash: 0x8a2a1c, line: 1, accent: true });
      k.box(sx, sy + 0.8, zFace + 0.24, 0.9, 0.1, 0.5, { wash: 0x2f7d5e, line: 1, accent: true });
      ctx.signs.light(new Vector3(sx, sy + 0.3, zFace + 0.37), XP, UP, 0.3, 0.3, 0xffb347, 2.2);
      ctx.signs.place({ at: new Vector3(sx, sy + 1.25, zFace + 0.03), normal: ZP, size: 0.2, spec: { text: '福德正神', color: '#f0c86a', vertical: false, style: 'plaque' } }, k);
    }
    for (let i = 0; i < 3; i++) {
      const px = xa + 0.8 + i * 2.6 + rng.range(-0.3, 0.3);
      piece(ctx, 'plant', new Vector3(px, SQ_BASE - 0.2, zFace + n.z * 0.14), n.z > 0 ? XP : XN, n, 0.9, 1.0, 0.9);
    }
  }
}

// ── the terraces and the towers standing on them (past the square's towers) ──

interface Seg { xa: number; xb: number; floor: number; top: number }

function segments(rng: Rng, side: number): Seg[] {
  const out: Seg[] = [];
  const cuts = [SQ_BACK, LANDINGS[0]?.x1 ?? 40, LANDINGS[1]?.x0 ?? 52, LANDINGS[1]?.x1 ?? 57, STAIR.x1, FAR_X];
  let x = SQ_BACK;
  for (let c = 1; c < cuts.length; c++) {
    const end = (cuts[c] ?? FAR_X) + (side > 0 ? 0.25 : -0.25);
    while (x < end - 0.5) {
      const left = end - x;
      const len = left < 6.5 ? left : Math.min(left - 2.8, rng.range(3.6, 5.4));
      out.push({ xa: x, xb: x + len, floor: 0, top: 0 });
      x += len;
    }
  }
  for (const s of out) {
    s.floor = stairFloor(Math.min(s.xb, FAR_X) - 0.01) + 0.15;
    const under = s.xa > 42 && s.xa < 114;
    s.top = under ? Math.min(Y0 + 50, s.floor + rng.range(22, 36)) : s.floor + rng.range(30, 50);
  }
  return out;
}

/**
 * A tea terrace's timber veranda (the mockup's tea house): red lacquer posts along the rail, a glazed pent roof from
 * the tower's face out over the rail, a lattice frieze under its eave, lanterns, now and then a 茶 cloth banner.
 */
function veranda(ctx: Ctx, k: Kit, s: Seg, face: number, edge: number, side: number, rng: Rng): void {
  const len = s.xb - s.xa, cx = (s.xa + s.xb) / 2;
  const yIn = s.floor + 3.95, yOut = s.floor + 3.0;
  const zIn = face + side * 0.05, zOut = edge + side * 0.35;
  const xa = s.xa + 0.05, xb = s.xb - 0.05;
  const tile = rng.chance(0.7) ? MIN.malachite : MIN.azurite;
  const a = new Vector3(xa, yOut, zOut), b = new Vector3(xb, yOut, zOut), c = new Vector3(xb, yIn, zIn), d = new Vector3(xa, yIn, zIn);
  if (side > 0) k.quad4(a, b, c, d, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  else k.quad4(b, a, d, c, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  // the fascia board along the eave and the soffit's painted underside
  k.box(cx, yOut - 0.2, zOut, len - 0.05, 0.2, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  const rz = edge - side * 0.28;
  const nPost = Math.max(2, Math.round(len / 2.2) + 1);
  for (let j = 0; j < nPost; j++) {
    const px = xa + 0.1 + ((xb - xa - 0.2) * j) / (nPost - 1);
    k.box(px, s.floor, rz, 0.16, yOut - s.floor + 0.15, 0.16, LACQUER);
  }
  const ka = ctx.alpha('stair-a');
  const u = side > 0 ? XP : XN;
  ka.quad(new Vector3(side > 0 ? xa : xb, yOut - 0.62, rz), u, UP, len - 0.1, 0.42, { wash: 0x5a2a1c, kind: K.net, col: 0.16, line: 1, accent: true });
  for (let j = 0; j < Math.max(1, Math.round(len / 1.8)); j++) ctx.lantern(xa + (j + 0.5) * (len - 0.1) / Math.max(1, Math.round(len / 1.8)), yOut - 0.3, rz - side * 0.1, 0.75);
  if (rng.chance(0.5)) {
    const bx = side > 0 ? xa + 0.25 : xb - 0.25;
    ctx.signs.place({ at: new Vector3(bx, yOut - 1.25, rz + side * 0.2), normal: XN, size: 0.5, spec: { text: '茶', color: '#1a1614', vertical: true, style: 'banner', ink: '#e8e0cc' }, blade: true }, k);
  }
  // warm light from the tea room onto the terrace
  ctx.emitters.push({ at: new Vector3(cx, s.floor + 1.5, face + side * 0.4), color: new Color(0xffc48a), w: len - 0.4, h: 2.4, power: 0.2, spill: 0.3 });
}

const WORDS_HERE = ['麵', '茶', '牙科', '火鍋', '旅館', '藥房', '涼茶', '小面', '抄手', '豆花', '麻辣烫', '串串香', '酸辣粉', '賓館', '按摩', '中醫', '跌打', '五金'] as const;
const NEONS = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber, 0xff7a2a] as const;

function terraces(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-terraces', true);
  const ka = ctx.alpha('stair-a');
  const kx = ctx.kitx('stair-terraces');
  for (const side of [1, -1] as const) {
    // north (side 1): the face at FACE_N facing +z, the terrace from it to the stair's edge; south mirrored
    const face = side > 0 ? FACE_N : FACE_S, edge = side > 0 ? STAIR.z0 : STAIR.z1;
    const n = side > 0 ? ZP : ZN, u = side > 0 ? XP : XN;
    const segs = segments(rng, side);
    segs.forEach((s, i) => {
      const cx = (s.xa + s.xb) / 2, len = s.xb - s.xa;
      const below = Math.min(stairFloor(s.xa + 0.01), s.floor) - 1.5;
      // the plinth: its front on the stair's edge, its top the terrace
      k.box(cx, below, (face + edge) / 2, len, s.floor - below, Math.abs(edge - face), PLINTH, { top: TERRACE });
      k.box(cx, s.floor - 0.1, edge - side * 0.15, len + 0.02, 0.14, 0.32, COPING);
      // the tower on it, its ground floor a shopfront at the terrace's level
      const next = segs[i - 1];
      const faces = 1 + (next !== undefined && next.top < s.top - 3 ? (side > 0 ? 8 : 4) : 0);
      dressWall(ctx.fd, new Vector3(side > 0 ? s.xa : s.xb, 0, face), n, len, s.floor, s.top, Math.floor(rng.next() * 1e6), {
        shops: true, street: s.floor, detailY: [Y0 - 5, Y0 + 70], timber: 0.4, lit: 0.75, lod: 0, roof: true, setbacks: s.top - s.floor > 30,
      }, 12, faces);
      // what stands on the terrace: a railing (steel or red timber), potted plants, sometimes a tea table with
      // drinkers, a lantern post, a figure at the rail
      const tea = rng.chance(0.4);
      const rz = edge - side * 0.28;
      const railLook: Look = tea ? { wash: 0x5a2a1c, kind: K.bars, row: 1, col: 0.12, line: 1, accent: true } : { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.15, line: 1 };
      ka.quad(new Vector3(side > 0 ? s.xa + 0.1 : s.xb - 0.1, s.floor, rz), u, UP, len - 0.2, 1.0, railLook);
      k.box(cx, s.floor + 1.0, rz, len - 0.1, 0.06, 0.08, tea ? LACQUER : IRON);
      for (let px = s.xa + 0.1; px <= s.xb; px += len / Math.max(1, Math.round(len / 1.6))) k.box(Math.min(px, s.xb - 0.05), s.floor, rz, 0.07, 1.05, 0.07, tea ? LACQUER : IRON);
      const nPots = rng.int(1, 3);
      for (let j = 0; j < nPots; j++) {
        const px = s.xa + len * ((j + rng.range(0.2, 0.8)) / nPots);
        piece(ctx, rng.chance(0.3) ? 'planter' : 'plant', new Vector3(px, s.floor, rz - side * 0.35), u, n, rng.range(1.0, 1.5), rng.range(1.1, 1.7), rng.range(1.0, 1.4));
      }
      if (tea && len > 3.4) {
        const tx = cx + rng.range(-0.6, 0.6), tz = (face + edge) / 2 + side * 0.1, tr = rng.range(-0.3, 0.3);
        mahjong(k, kx, rng, tx, s.floor, tz, tr, 0, rng.pick([0xb8352a, 0x2f5f9a, 0x3c7a5a]), false);
        for (const st of mahjongSeats(tx, tz, tr).slice(0, rng.int(2, 4))) ctx.sitters.push(mat4(st.x, s.floor, st.z, st.yaw));
        veranda(ctx, k, s, face, edge, side, new Rng(900 + i * 7 + side * 50));
      } else if (rng.chance(0.55)) {
        ctx.walkers.push(mat4(cx + rng.range(-1, 1), s.floor, (face + edge) / 2 + rng.range(-0.6, 0.6), rng.range(0, Math.PI * 2), rng.range(0.95, 1.03)));
      }
      if (rng.chance(0.5)) {
        const lx = side > 0 ? s.xa + 0.25 : s.xb - 0.25;
        k.beam(new Vector3(lx, s.floor, rz), new Vector3(lx, s.floor + 2.4, rz), 0.08, 0.08, IRON);
        k.beam(new Vector3(lx, s.floor + 2.4, rz), new Vector3(lx, s.floor + 2.4, rz + side * 0.5), 0.06, 0.06, IRON);
        ctx.lantern(lx, s.floor + 2.35, rz + side * 0.45, 0.7);
      }
      // side steps up from the stair onto a landing's terrace
      if (LANDINGS.some((l) => cx > l.x0 && cx < l.x1)) {
        for (let j = 0; j < 1; j++) k.box(cx, s.floor - 0.15, edge - side * 0.05, 1.6, 0.15, 0.1, COPING);
      }
    });
  }
}

// ── the paifang on the second landing (dome B's gate, turned to span the stair) ──

function stairGate(ctx: Ctx): void {
  const G = STAIR_GATE;
  const xf = new Matrix4().makeTranslation(G.x, G.y, G.z).multiply(new Matrix4().makeRotationY(-Math.PI / 2));
  const name = 'stair-gate';
  const k = new XfKit(xf), x = new XfKitX(xf);
  ctx.kits.set(name, k);
  ctx.kitxs.set(name, x);
  ctx.reflective.add(name);
  const xs = new XfSigns(ctx.signs, xf);
  const p = new Vector3();
  // its lanterns hang smaller than the square gate's: this gate is lower (s 1.3), and seven full-size lantern pools
  // washed the landing salmon (render round 14 made the lantern pools ×1.7)
  buildGate(k, x, xs, (lx, ly, lz, s) => { p.set(lx, ly, lz).applyMatrix4(xf); ctx.lantern(p.x, p.y, p.z, s * 0.72); }, {
    x: 0, y: 0, z: 0, posts: G.posts, s: G.s, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false,
  });
}

// ── over the street: lantern strings, cables, a skybridge, the monorail ──

function lanternString(ctx: Ctx, k: Kit, a: Vector3, b: Vector3, spacing: number, sag: number): void {
  const len = a.distanceTo(b);
  const nSeg = Math.max(2, Math.round(len / spacing));
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < nSeg; i++) k.beam(at(i / nSeg), at((i + 1) / nSeg), 0.025, 0.025, IRON);
  for (let i = 1; i < nSeg; i++) { const q = at(i / nSeg); ctx.lantern(q.x, q.y, q.z, 0.8); }
}

function overhead(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-over', true);
  // red lantern strings across, a few metres over the steps (the mockup's strings), some along the street
  for (const x of [28.5, 34, 41.5, 61, 66, 74, 83, 92]) {
    const y = stairFloor(x) + rng.range(6.2, 8.2);
    lanternString(ctx, k, new Vector3(x + rng.range(-1, 1), y, x < SQ_BACK ? STAIR.z0 : FACE_N), new Vector3(x + rng.range(-1, 1), y + rng.range(-0.6, 0.6), x < SQ_BACK ? STAIR.z1 : FACE_S), 1.25, 0.9);
  }
  for (const [x0, x1, z] of [[36, 52, STAIR.z0 - 1.6], [57, 70, STAIR.z1 + 1.8]] as const) {
    const y0 = stairFloor(x0) + 5.2, y1 = stairFloor(x1) + 5.2;
    lanternString(ctx, k, new Vector3(x0, y0, z), new Vector3(x1, y1, z), 1.4, 0.7);
  }
  // cables and laundry strung between the towers higher up (the facade grammar's spans)
  for (let x = 36; x < FAR_X - 4; x += rng.range(3, 6)) {
    const ya = stairFloor(x) + rng.range(10, 24);
    spanStreet(ctx.fd, new Vector3(x, ya, FACE_N + 0.6), new Vector3(x + rng.range(-1.5, 1.5), ya + rng.range(-1.5, 1.5), FACE_S - 0.6), Math.floor(rng.next() * 1e6));
  }
  // the skybridge over the second flight: a glazed box on steel beams, a lit band, people crossing, red banners
  const bx = 46.5, by = stairFloor(46.5) + 12.5, bw = 3.2;
  const ka = ctx.alpha('stair-a');
  k.box(bx, by - 0.5, (FACE_N + FACE_S) / 2, bw, 0.6, FACE_S - FACE_N + 2, { wash: 0x6c737d, line: 1.5 }, { top: { wash: 0x7d828a, line: 1 } });
  k.box(bx, by + 2.7, (FACE_N + FACE_S) / 2, bw + 0.4, 0.35, FACE_S - FACE_N + 2, { wash: 0x7c838d, line: 1.2 });
  for (const sx of [-1, 1]) {
    ka.quad(new Vector3(bx + sx * bw / 2, by + 0.1, sx > 0 ? FACE_N - 1 : FACE_S + 1), sx > 0 ? ZP : ZN, UP, FACE_S - FACE_N + 2, 2.6, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 1.1, line: 1 });
    ctx.signs.light(new Vector3(bx + sx * (bw / 2 + 0.03), by + 2.45, (FACE_N + FACE_S) / 2), sx > 0 ? ZP : ZN, UP, FACE_S - FACE_N, 0.1, 0xffd9a0, 1.4);
    for (let z = FACE_N + 1; z < FACE_S; z += 3) k.box(bx + sx * bw / 2, by, z, 0.12, 2.7, 0.12, { wash: 0x4a4e56, line: 1 });
  }
  for (let i = 0; i < 4; i++) ctx.walkers.push(mat4(bx + rng.range(-0.8, 0.8), by, rng.range(FACE_N + 1, FACE_S - 1), rng.chance(0.5) ? 0 : Math.PI, rng.range(0.95, 1.03)));
  for (const z of [3.2, 6, 8.8]) {
    // a long red cloth banner hung from the bridge's west face (the mockup's), gold letters
    ctx.signs.place({ at: new Vector3(bx - bw / 2 - 0.08, by - 2.2, z), normal: XN, size: 0.5, spec: { text: z < 5 ? '九龍' : z < 7 ? '萬家燈火' : '天下一家', color: '#e8c46a', vertical: true, style: 'banner', ink: '#8a1e14' } }, k);
  }
  // the monorail: a box-girder track across the street slung from the deck overhead, a train standing on it
  const mx = 59.5, my = Y0 + 36;
  k.box(mx, my - 1.2, (FACE_N + FACE_S) / 2, 1.4, 1.2, 150, { wash: 0x7e8591, kind: K.panel, line: 1.5 });
  k.box(mx, my - 1.45, (FACE_N + FACE_S) / 2, 2.2, 0.25, 150, { wash: 0x5c626c, line: 1.2 });
  for (let z = -60; z <= 70; z += 13) {
    k.beam(new Vector3(mx, my - 0.1, z), new Vector3(mx - 2, Y0 + 50, z - 2), 0.14, 0.14, IRON);
    k.beam(new Vector3(mx, my - 0.1, z), new Vector3(mx + 2, Y0 + 50, z + 2), 0.14, 0.14, IRON);
  }
  for (let i = 0; i < 3; i++) {
    const z = -8 + i * 13.6;
    k.box(mx, my - 4.1, z, 2.7, 2.9, 13, { wash: 0x6a717c, line: 1.2 }, { top: { wash: 0x565c66, line: 1 } });
    k.box(mx, my - 3.1, z, 2.74, 0.9, 12.2, { wash: 0xffd9a0, emit: 0.3, kind: K.facade, row: 0.9, col: 1.4, seed: 17 + i, line: 1, accent: true });
    k.box(mx, my - 4.05, z, 2.76, 0.28, 13.02, { wash: 0xc23b22, line: 1, accent: true });
    k.box(mx, my - 1.2, z, 1.4, 0.6, 2.2, { wash: 0x5c626c, line: 1 });
  }
  // a second, higher bridge near the top, in the haze
  const hx = 67, hy = TOP_Y + 17;
  k.box(hx, hy - 0.5, (FACE_N + FACE_S) / 2, 3, 0.6, FACE_S - FACE_N + 2, { wash: 0x6c737d, line: 1.5 });
  k.box(hx, hy + 2.6, (FACE_N + FACE_S) / 2, 3.3, 0.3, FACE_S - FACE_N + 2, { wash: 0x7c838d, line: 1.2 });
  for (const sx of [-1, 1]) ka.quad(new Vector3(hx + sx * 1.5, hy + 0.1, sx > 0 ? FACE_N - 1 : FACE_S + 1), sx > 0 ? ZP : ZN, UP, FACE_S - FACE_N + 2, 2.5, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 1.2, line: 1 });
  ctx.signs.light(new Vector3(hx - 1.53, hy + 2.35, (FACE_N + FACE_S) / 2), ZP, UP, FACE_S - FACE_N, 0.1, 0xffd9a0, 1.4);
}

// ── the signs: the mockup's four hero signs, the dragon hook on its bracket, blade signs up both sides ──

function stairSigns(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-signs', true);
  const bracket = (x: number, y: number, zWall: number, zOut: number): void => {
    k.beam(new Vector3(x, y, zWall), new Vector3(x, y, zOut), 0.1, 0.12, IRON);
    k.beam(new Vector3(x, y - 1.1, zWall), new Vector3(x, y - 0.05, zWall + (zOut - zWall) * 0.6), 0.06, 0.06, IRON);
  };
  // [text, colour, x, y above the stair's floor there, side (1 north / -1 south), size]
  const hero: [string, number, number, number, number, number][] = [
    ['麵', NEON.magenta, 29.6, 5.6, 1, 1.75],
    ['旅館', NEON.jade, 37.5, 6.4, -1, 1.3],
    ['火鍋', NEON.red, 42.5, 7.6, -1, 1.25],
    ['牙科', NEON.cyan, 48.2, 8.6, -1, 1.2],
    ['藥房', NEON.amber, 44.5, 7.8, 1, 1.05],
    ['涼茶', NEON.jade, 58.5, 7.4, 1, 1.0],
    ['賓館', NEON.magenta, 63.5, 8.2, -1, 1.1],
  ];
  for (const [text, col, x, dy, side, size] of hero) {
    const wall = x < SQ_BACK ? (side > 0 ? STAIR.z0 : STAIR.z1) : side > 0 ? FACE_N : FACE_S;
    const w = size * 1.36;
    const z = wall + side * (0.5 + w / 2);
    const nch = Array.from(text).length;
    const h = size * (nch + 0.62);
    const y = stairFloor(x) + dy;
    ctx.signs.place({ at: new Vector3(x, y, z), normal: XN, size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, k);
    bracket(x, y + h / 2 + 0.3, wall, z + side * (w / 2 + 0.2));
    k.box(x, y + h / 2 + 0.05, z, 0.06, 0.3, 0.06, IRON);
  }
  // the brass dragon on its bracket, just past the 麵 sign, its ring over the stair (the mockup's grapple point)
  const hx = 31.8, hy = stairFloor(31.8) + 5.2;
  k.beam(new Vector3(hx, hy + 0.9, STAIR.z0), new Vector3(hx - 0.2, hy + 0.2, STAIR.z0 + 1.0), 0.07, 0.07, IRON);
  dragonHook(k, ctx, new Vector3(hx, hy, STAIR.z0), new Vector3(-0.55, 0, 1), 1.5);
  dragonHook(k, ctx, new Vector3(61.2, stairFloor(61.2) + 5.6, FACE_S), new Vector3(-0.5, 0, -1), 1.3);
  // blade signs up both sides, reading down the stair, and a few flat boards facing across
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = 36 + (i / 16) * 62 + rng.range(-1.2, 1.2);
    const wall = side > 0 ? FACE_N : FACE_S;
    const size = rng.range(0.7, 1.05);
    const w = size * 1.36;
    const y = stairFloor(x) + rng.range(8, 16);
    const text = rng.pick(WORDS_HERE);
    ctx.signs.place({ at: new Vector3(x, y, wall + side * (0.6 + w / 2)), normal: XN, size, spec: { text, color: hex(rng.pick(NEONS)), vertical: true, style: rng.chance(0.75) ? 'tube' : 'box' }, blade: true, flicker: rng.chance(0.08) ? rng.next() : 0 }, k);
    const h = size * (Array.from(text).length + 0.62);
    k.beam(new Vector3(x, y + h / 2 + 0.25, wall), new Vector3(x, y + h / 2 + 0.25, wall + side * (w + 0.8)), 0.08, 0.08, IRON);
  }
}

// ── the crowd on the steps: umbrellas going up and coming down ──

function crowd(ctx: Ctx, rng: Rng): void {
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const placed: [number, number][] = [];
  let n = 0;
  for (let tries = 0; tries < 200 && n < 26; tries++) {
    // denser low down (the mockup's crowd thins toward the paifang), a few on the top landing and the street past it
    const t = rng.next() ** 1.25;
    const x = STAIR.x0 + 3 + t * (FAR_X - 4 - STAIR.x0 - 3), z = zc + rng.range(-3.3, 3.3);
    // the mockup camera's foreground stays open, the loop's anchor on the first landing, the paifang's posts
    if (x < 26.5 && Math.abs(z - zc) < 2.2) continue;
    if ((x - 37.3) ** 2 + (z - zc) ** 2 < 2.4 ** 2) continue;
    if (Math.abs(x - STAIR_GATE.x) < 2.2) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 1.1)) continue;
    placed.push([x, z]);
    const up = rng.chance(0.6);
    ctx.walkers.push(mat4(x, stairFloor(x), z, (up ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.25, 0.25), rng.range(0.95, 1.04)));
    n++;
  }
}

// ── the far end: the street runs on past the top landing, a last flight into the haze, a tower closing the view ──

function farEnd(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-far');
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const n = 20, run = 0.8, rise = 0.4;
  for (let i = 0; i < n; i++) k.box(FAR_X + i * run + run / 2, TOP_Y + i * rise - 0.3, zc, run + 0.02, rise + 0.3, 8, STEP_RISER, { top: STEP_TOP });
  const top = TOP_Y + n * rise, x1 = FAR_X + n * run;
  k.box(x1 + 6, top - 0.6, zc, 12, 0.6, FACE_S - FACE_N, STEP_RISER, { top: STEP_TOP });
  for (const side of [1, -1]) {
    const face = side > 0 ? FACE_N : FACE_S;
    k.box((FAR_X + x1) / 2, TOP_Y - 1, (face + (side > 0 ? STAIR.z0 : STAIR.z1)) / 2, x1 - FAR_X, top - TOP_Y + 1, 3, PLINTH);
    dressWall(ctx.fd, new Vector3(side > 0 ? FAR_X : x1 + 12, 0, face), side > 0 ? ZP : ZN, x1 + 12 - FAR_X, top, Math.min(Y0 + 50, top + 26), Math.floor(rng.next() * 1e6), {
      shops: true, street: top, timber: 0.3, lit: 0.7, lod: 1, roof: true,
    }, 12, 1);
  }
  dressWall(ctx.fd, new Vector3(x1 + 12, 0, FACE_S + 6), XN, FACE_S - FACE_N + 12, top, top + 60, Math.floor(rng.next() * 1e6), { shops: true, street: top, lit: 0.7, lod: 1, roof: true }, 14, 1);
}

export function buildStairStreet(ctx: Ctx): void {
  const rng = new Rng(4404);
  steps(ctx, rng);
  teaHouse(ctx, rng);
  hotpotShop(ctx, rng);
  footWalls(ctx, rng);
  terraces(ctx, rng);
  stairGate(ctx);
  overhead(ctx, rng);
  stairSigns(ctx, rng);
  crowd(ctx, rng);
  farEnd(ctx, rng);
  ctx.map.push({ x0: STAIR.x0, z0: STAIR.z0, x1: STAIR.x1 + 8, z1: STAIR.z1, kind: 'street' });
}
