// Dome D / C1 (E169): the stair-street's plan and its foot — mockup C (art/nine-dragon-stack/round-6-baseline-hud/
// comp-C-stair-street.jpg), whose camera stands on Lantern Square's south-east corner looking up the stair. From the
// square a Chongqing stair-street climbs east between sign-covered towers: three flights of worn wet granite steps and
// two landings, the paifang on the second landing with the last flight rising on through it.
//
// This file (C1) owns the PLAN (the flights, landings, the paifang's place: shared with C2), the physics
// (`stairColliders()` — rise 0.35 ≤ 0.35, tread 0.667 ≥ 0.36, PHYSICS.md — and `stairFloor(x)`, which world/colliders.ts
// takes) and everything below SQ_BACK (x < 34.6): the first flight's steps; under the square's two corner towers (which
// stand only SQ_DEPTH deep, towers.ts) the tea room and the hotpot shop at the foot, the timber skin of the tea house's
// upper floors and a lit shop row on the towers' end faces; behind the corner towers (SQ_CORNER…SQ_BACK) raised terraces
// on ashlar walls with low pavilions (the tea house's veranda north, shops south) and their towers set back 3.4 m; the
// 麵 sign, the brass dragon (the jian's guard head at ×11) with the grapple ring, two lantern strings, the crowd on the
// first flight. Landing 1
// upward (terraces, towers, the paifang, the bridges, the monorail, the upper signs and crowd, the far end) is C2's:
// stairstreet-upper.ts, buildStairUpper(ctx).
import { type BufferGeometry, Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import type { ColliderDesc } from '../../../world/registry';
import type { Ctx } from './ctx';
import { dressWall } from './facade/grammar';
import type { PieceId } from './facade/pieces';
import { mahjong, mahjongSeats } from './hero/figures';
import { KitX } from './hero/kitx';
import { buildGuardProcedural } from './hero/weapon-parts';
import { K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
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
/** the square's east towers flank the stair's first 12 m (their end faces on the stair's edges, base at Y0 + 5): C1 / C2's
 *  boundary */
export const SQ_BACK = PLAZA.x1 + 12.6;
/** …but the two corner towers at the stair stand only SQ_DEPTH deep (towers.ts wallRun openDepth): behind them, from
 *  SQ_CORNER to SQ_BACK, the stair's low pavilions on raised terraces with their towers set back (mockup C's foot) */
export const SQ_DEPTH = 6;
export const SQ_CORNER = PLAZA.x1 + 0.6 + SQ_DEPTH;
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

// ── looks (C2 has its own copies) ──
const STEP_TOP: Look = { wash: 0x3a3c42, kind: K.flag, wet: 1, line: 1.8 };
const STEP_RISER: Look = { wash: 0x46464c, kind: K.stone, line: 1.8, wet: 0.7 };
const PLINTH: Look = { wash: 0x6a6866, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const COPING: Look = { wash: 0x77756f, kind: K.stone, line: 1.8, wet: 0.5 };
const TERRACE: Look = { wash: 0x55565a, kind: K.flag, wet: 0.8, line: 0 };
const TIMBER_DK: Look = { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood };
const LACQUER: Look = { wash: 0x7e2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const IRON: Look = { wash: 0x2a2c31, line: 0.8 };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const UP = new Vector3(0, 1, 0);
const XP = new Vector3(1, 0, 0), XN = new Vector3(-1, 0, 0), ZP = new Vector3(0, 0, 1), ZN = new Vector3(0, 0, -1);

/**
 * A KitX transformed once built. With `vmBrass` its viewmodel material classes (hero/vm-material.ts VM.*: kind ≥ 20, the
 * jian's parts) become the world's: plain kind, accent + gloss + the gold ruling (the grapple's hooks, kit.ts Look.gold).
 */
class XfKitX extends KitX {
  constructor(private readonly xf: Matrix4, private readonly vmBrass: boolean) { super(); }
  override build(): BufferGeometry {
    const g = super.build();
    if (this.vmBrass) {
      const pat = g.getAttribute('aPat'), misc = g.getAttribute('aMisc'), col = g.getAttribute('color');
      for (let i = 0; i < pat.count; i++) {
        if (pat.getX(i) < 20) continue;
        pat.setX(i, 0);
        misc.setW(i, misc.getX(i) > 0 ? 16 : 16 + 32 + 64);
        if (misc.getX(i) <= 0) col.setXYZ(i, col.getX(i) * 0.52, col.getY(i) * 0.48, col.getZ(i) * 0.42);
      }
    }
    g.applyMatrix4(this.xf);
    return g;
  }
}

/** a facade-grammar piece (instanced with the towers' dressing): local +z along `n`, x along `u` */
function piece(ctx: Ctx, id: PieceId, at: Vector3, u: Vector3, n: Vector3, sx: number, sy: number, sz: number, c = 0xffffff): void {
  ctx.fd.pieces.push({ piece: id, m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(sx, sy, sz)).setPosition(at), c: new Color(c) });
}

/** an interior-mapped shop window / door (the facade's window program): bottom-centre `at`, facing `n` */
function shopGlass(ctx: Ctx, rng: Rng, at: Vector3, u: Vector3, n: Vector3, w: number, h: number, light: number, lit = 1, door = true): void {
  ctx.fd.windows.push({
    m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w, h, 1)).setPosition(at.clone().addScaledVector(n, 0.012)),
    win: new Vector4(rng.range(0, 97), lit, rng.chance(0.3) ? rng.range(0.1, 0.3) : 0, (door ? 16 : 0) + rng.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(light),
  });
}

/** take the facade grammar's dressing (pieces, windows, sign slots) off a box: the overlays below replace it there */
function clearBand(ctx: Ctx, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void {
  const p = new Vector3();
  const inside = (v: Vector3): boolean => v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1 && v.y > y0 && v.y < y1;
  const drop = (list: { m: Matrix4 }[]): void => {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e !== undefined && inside(p.setFromMatrixPosition(e.m))) list.splice(i, 1);
    }
  };
  drop(ctx.fd.pieces);
  drop(ctx.fd.windows);
  for (let i = ctx.fd.signs.length - 1; i >= 0; i--) {
    const sl = ctx.fd.signs[i];
    if (sl !== undefined && inside(sl.at)) ctx.fd.signs.splice(i, 1);
  }
}

function mat4(x: number, y: number, z: number, yaw: number, s = 1): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(s, s, s));
}

// ── the first flight ──

function flightOne(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-steps', true);
  const f = FLIGHTS[0];
  if (f === undefined) return;
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
  for (const t of [0.2, 0.5, 0.8]) ctx.lantern(x0 + (x1 - x0) * t, ey - 0.72, ez - 0.25, 0.62);
  // two tea tables on the veranda with their drinkers (TRELLIS sitters come with stools), a pot of plants at the end
  const kx = ctx.kitx('stair-foot');
  for (const [tx, tz, tr, n] of [[x0 + 1.1, zf - 1.4, 0.3, 3], [x0 + 3.0, zf - 1.5, -0.2, 2]] as const) {
    mahjong(k, kx, rng, tx, floor, tz, tr, 0, 0xb8352a, false);
    for (const st of mahjongSeats(tx, tz, tr).slice(0, n)) ctx.sitters.push(mat4(st.x, floor, st.z, st.yaw));
  }
  for (const [px, sc] of [[x0 + 0.4, 1.3], [x0 + 2.1, 1.1], [x1 - 0.5, 1.4]] as const) piece(ctx, 'plant', new Vector3(px, floor, zf - 0.45), XP, ZP, sc, sc * 1.2, sc);
  // the 茶 cloth banner hung off the eave's end, the 茶樓 board over the eave
  ctx.signs.place({ at: new Vector3(cx + 0.3, ceil + 0.55, zf + 0.12), normal: ZP, size: 0.62, spec: { text: '茶樓', color: hex(NEON.cyan), vertical: false, style: 'tube' } }, k);
  ctx.emitters.push({ at: new Vector3(cx, floor + 1.6, zf - 0.6), color: new Color(0xffc48a), w: x1 - x0 - 0.5, h: 2.6, power: 0.26, spill: 0.15 });
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
  for (const t of [0.25, 0.75]) ctx.lantern(x0 + (x1 - x0) * t, ceil - 0.7, zf + 0.9, 0.62);
  piece(ctx, 'plant', new Vector3(x1 - 0.45, floor, zf + 0.5), XN, ZN, 1.2, 1.4, 1.2);
  piece(ctx, 'plant', new Vector3(x0 + 0.5, floor, zf + 0.5), XN, ZN, 1.0, 1.2, 1.0);
  ctx.signs.place({ at: new Vector3(cx, ceil + 0.5, zf - 0.12), normal: ZN, size: 0.6, spec: { text: '火鍋', color: hex(NEON.red), vertical: false, style: 'tube' } }, k);
  ctx.emitters.push({ at: new Vector3(cx, floor + 1.5, zf + 0.6), color: new Color(0xff9a62), w: x1 - x0 - 0.5, h: 2.4, power: 0.26, spill: 0.15 });
}

/** the stone wall from the stair up to the square towers' base, between the foot shops and the first landing */
function footWalls(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  for (const [z0, z1, zFace, n] of [[STAIR.z0 - 3.4, STAIR.z0, STAIR.z0, ZP], [STAIR.z1, STAIR.z1 + 3.4, STAIR.z1, ZN]] as const) {
    const xa = PLAZA.x1 + 0.6 + (n === ZP ? 4.2 : 4.4), xb = SQ_CORNER;
    k.box((xa + xb) / 2, Y0 - 0.4, (z0 + z1) / 2, xb - xa, SQ_BASE - Y0 + 0.4, z1 - z0, { ...PLINTH, kind: K.stone });
    // a moss-dark band and a ledge where it meets the tower, drain pipes down it, a small earth-god niche
    k.box((xa + xb) / 2, SQ_BASE - 0.35, zFace + n.z * 0.12, xb - xa, 0.3, 0.26, COPING);
    for (const px of [xa + 1.0]) piece(ctx, 'pipe', new Vector3(px, Y0, zFace), n.z > 0 ? XP : XN, n, 1.4, SQ_BASE - Y0 + 6, 1.4, 0x55595f);
    if (n === ZP) {
      // the shrine sits flush in the wall (the stair beside it is walkable)
      const sx = xa + 1.0, sy = stairFloor(sx) + 0.6;
      k.box(sx, sy, zFace + 0.03, 0.7, 0.8, 0.06, { wash: 0x8a2a1c, line: 1, accent: true });
      k.box(sx, sy + 0.8, zFace + 0.05, 0.9, 0.1, 0.1, { wash: 0x2f7d5e, line: 1, accent: true });
      ctx.signs.light(new Vector3(sx, sy + 0.3, zFace + 0.07), XP, UP, 0.3, 0.3, 0xffb347, 2.2);
      ctx.signs.place({ at: new Vector3(sx, sy + 1.25, zFace + 0.03), normal: ZP, size: 0.2, spec: { text: '福德正神', color: '#f0c86a', vertical: false, style: 'plaque' } }, k);
    }
    for (let i = 0; i < 1; i++) {
      const px = xa + 0.8 + i * 2.6 + rng.range(-0.3, 0.3);
      piece(ctx, 'plant', new Vector3(px, SQ_BASE - 0.2, zFace + n.z * 0.14), n.z > 0 ? XP : XN, n, 0.9, 1.0, 0.9);
    }
  }
}

// ── the first 12 m of the stair's sides above the square towers' base: the tea house's upper floors (north) and a row of
// lit shops (south), skinned over the towers' end faces (the grammar's dressing there is cleared first). Nothing reaches
// out over the stair lower than 2.1 m above its steps (the stair is walkable) ──

const EAVE_X1 = 32.2;
/** the 麵 sign hangs in the tea house's second bay (that bay has no gallery) */
const MIAN_X = 26.2;
/** the brass dragon's wall bracket (its bay of the tea house has no lantern) */
const DRAGON_X = 28.2;

function teaHouseUpper(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const ka = ctx.alpha('stair-a');
  const zf = STAIR.z0, x0 = PLAZA.x1 + 0.6, x1 = SQ_CORNER;
  const yA = SQ_BASE, yB = SQ_BASE + 3.4, yTop = SQ_BASE + 6.8;
  clearBand(ctx, x0 - 0.3, x1 + 0.3, zf - 0.6, zf + 2.8, yA - 0.3, yTop + 0.2);
  // the plank skin and the timber frame: sill, floor and head beams, red lacquer posts at every bay
  k.quad(new Vector3(x0, yA, zf + 0.03), XP, UP, x1 - x0, yTop - yA, { wash: 0x4a3526, line: 1, surf: SURF.wood });
  for (const y of [yA, yB, yTop]) k.box((x0 + x1) / 2, y - 0.12, zf + 0.12, x1 - x0, 0.24, 0.22, TIMBER_DK);
  const nb = Math.round((x1 - x0) / 2.4), bw = (x1 - x0) / nb;
  for (let b = 0; b <= nb; b++) k.box(x0 + b * bw, yA, zf + 0.12, 0.2, yTop - yA, 0.2, LACQUER);
  for (let b = 0; b < nb; b++) {
    const bx0 = x0 + b * bw, bc = bx0 + bw / 2;
    // lattice doors onto the tea room, warm behind the lattice; lattice windows above
    shopGlass(ctx, rng, new Vector3(bc, yA + 0.12, zf + 0.04), XP, ZP, bw - 0.36, yB - yA - 0.5, rng.pick([0xffc47e, 0xffb870, 0xffd09a]), rng.range(0.95, 1.15));
    ka.quad(new Vector3(bx0 + 0.18, yA + 0.12, zf + 0.1), XP, UP, bw - 0.36, yB - yA - 0.5, { wash: 0x3d1d12, kind: K.bars, row: 1, col: 0.2, line: 1, accent: true });
    shopGlass(ctx, rng, new Vector3(bc, yB + 0.55, zf + 0.04), XP, ZP, bw - 0.5, 2.0, 0xffc47e, rng.chance(0.8) ? 1 : 0, false);
    ka.quad(new Vector3(bx0 + 0.25, yB + 0.55, zf + 0.1), XP, UP, bw - 0.5, 2.0, { wash: 0x3d1d12, kind: K.net, col: 0.2, line: 1, accent: true });
    // the upper gallery: a shallow balcony with a lattice rail, where it clears the stair (x ≤ EAVE_X1)
    if (bx0 + bw <= EAVE_X1 + 0.1 && Math.abs(bc - MIAN_X) > 1) {
      k.box(bc, yB - 0.02, zf + 0.35, bw, 0.14, 0.7, TIMBER_DK);
      ka.quad(new Vector3(bx0 + 0.05, yB + 0.12, zf + 0.68), XP, UP, bw - 0.1, 0.85, { wash: 0x5a2a1c, kind: K.bars, row: 1, col: 0.11, line: 1, accent: true });
      k.box(bc, yB + 0.95, zf + 0.68, bw, 0.07, 0.09, LACQUER);
      if (rng.chance(0.45)) ctx.walkers.push(mat4(bc + rng.range(-0.5, 0.5), yB + 0.12, zf + 0.35, rng.range(-0.4, 0.4), rng.range(0.95, 1.02)));
    }
  }
  // the pent eave over the tea room's doors (to EAVE_X1), lanterns under it; the roof eave at the top, full length
  const eave = (xa: number, xb: number, yWall: number, drop: number, out: number, tile: number): void => {
    k.quad4(new Vector3(xa, yWall - drop, zf + out), new Vector3(xb, yWall - drop, zf + out), new Vector3(xb, yWall, zf + 0.05), new Vector3(xa, yWall, zf + 0.05),
      xb - xa, Math.hypot(out, drop), { wash: tile, kind: K.tiles, line: 1, accent: true });
    k.box((xa + xb) / 2, yWall - drop - 0.16, zf + out, xb - xa, 0.16, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  };
  eave(x0 - 0.2, EAVE_X1, yB - 0.12, 0.42, 0.95, MIN.malachite);
  eave(x0 - 0.3, x1 + 0.3, yTop + 0.55, 0.6, 1.5, MIN.malachite);
  for (let b = 0; b < nb; b++) {
    const bc = x0 + (b + 0.5) * bw;
    if (bc < EAVE_X1 - 0.6 && Math.abs(bc - MIAN_X) > 1 && Math.abs(bc - DRAGON_X) > 1) ctx.lantern(bc, yB - 0.66, zf + 0.42, 0.62);
    ctx.lantern(bc, yTop - 0.2, zf + 0.9, 0.7);
  }
  // warm light from each bay's doors (one emitter per bay: a single 11 m one made an 5.5 m pool that washed the flight)
  for (let b = 0; b < nb; b++) ctx.emitters.push({ at: new Vector3(x0 + (b + 0.5) * bw, yA + 1.4, zf + 0.2), color: new Color(0xffc48a), w: bw - 0.4, h: 2.6, power: 0.22, spill: 0.15 });
}

function shopRowUpper(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const zf = STAIR.z1, x0 = PLAZA.x1 + 0.6, x1 = SQ_CORNER;
  const yA = SQ_BASE, yB = SQ_BASE + 3.3, yTop = SQ_BASE + 6.4;
  clearBand(ctx, x0 - 0.3, x1 + 0.3, zf - 2.8, zf + 0.6, yA - 0.3, yTop + 0.2);
  k.quad(new Vector3(x1, yA, zf - 0.03), XN, UP, x1 - x0, yTop - yA, { wash: 0x7d7a74, kind: K.stone, line: 1, surf: SURF.concrete });
  for (const y of [yA, yB, yTop]) k.box((x0 + x1) / 2, y - 0.14, zf - 0.14, x1 - x0, 0.28, 0.26, { wash: 0x8f8c86, line: 1.6 });
  const nb = 4, bw = (x1 - x0) / nb;
  const words = ['涼茶', '藥房', '抄手', '豆花'] as const;
  const cols = [NEON.jade, NEON.amber, NEON.red, NEON.cyan] as const;
  for (let b = 0; b <= nb; b++) k.box(x0 + b * bw, yA, zf - 0.14, 0.3, yTop - yA, 0.26, { wash: 0x8f949b, line: 1 });
  for (let b = 0; b < nb; b++) {
    const bx0 = x0 + b * bw, bc = bx0 + bw / 2;
    const shut = b === 2;
    if (shut) piece(ctx, 'shutter', new Vector3(bc, yA + 0.05, zf - 0.02), XN, ZN, bw - 0.5, 2.6, 1, 0xd8d4cc);
    else shopGlass(ctx, rng, new Vector3(bc, yA + 0.1, zf - 0.04), XN, ZN, bw - 0.45, 2.6, rng.pick([0xffc47e, 0xd9efe8, 0xffb870]), rng.range(1.0, 1.15));
    // its sign board over the door (neon on a dark board, facing across the stair) and a striped awning where it clears
    ctx.signs.place({ at: new Vector3(bc, yB - 0.35, zf - 0.12), normal: ZN, size: 0.42, spec: { text: words[b] ?? '茶', color: hex(cols[b] ?? NEON.jade), vertical: false, style: 'tube' } }, k);
    if (bx0 + bw <= EAVE_X1 + 0.1 && !shut) piece(ctx, 'awning', new Vector3(bc, yB - 0.7, zf), XN, ZN, bw - 0.4, 1, 1.1, rng.pick([MIN.cinnabar, MIN.azurite, MIN.malachite]));
    if (!shut) ctx.emitters.push({ at: new Vector3(bc, yA + 1.4, zf - 0.2), color: new Color(0xffc48a), w: bw - 0.6, h: 2.4, power: 0.22, spill: 0.15 });
    // upstairs: a window, an air-con box under it, a potted plant on the sill
    shopGlass(ctx, rng, new Vector3(bc, yB + 0.8, zf - 0.04), XN, ZN, bw - 1.1, 1.6, 0xffc98a, rng.chance(0.75) ? 1 : 0, false);
    piece(ctx, 'acUnit', new Vector3(bc + bw * 0.3, yB + 0.3, zf), XN, ZN, 1, 1, 1, 0xe6e4df);
    piece(ctx, 'plant', new Vector3(bc - bw * 0.25, yB + 0.75, zf - 0.02), XN, ZN, 0.7, 0.8, 0.7);
  }
}

// ── behind the corner towers (x SQ_CORNER…SQ_BACK): raised terraces on ashlar walls, low timber pavilions (the tea
// house north, shops south) under glazed pent roofs, their towers set back 3.4 m — as C2 does up the stair ──

const SETBACK = 3.4;
const ASHLAR: Look = { wash: 0x7a7872, kind: K.stone, line: 1, wet: 0.5, surf: SURF.stone };
const LEAF_COLS = [0x3f6a3e, 0x4f7a44, 0x355a3a, 0x5a8a4a, 0x2f5236] as const;
const POT_COLS = [0x9a5a3a, 0x8a4a30, 0x2f5f7a, 0x3c6a58, 0x6d6a66, 0xa8683e] as const;
const ICO0 = Array.from(new IcosahedronGeometry(1, 0).getAttribute('position').array);
const tint = (c: number, t: number): number => new Color(c).multiplyScalar(t).getHex();

function leafQuad(k: Kit, base: Vector3, dir: Vector3, side: Vector3, L: number, W: number, look: Look): void {
  const mid = base.clone().addScaledVector(dir, L * 0.42);
  const c = base.clone().addScaledVector(dir, L);
  const b = mid.clone().addScaledVector(side, W / 2), d = mid.clone().addScaledVector(side, -W / 2);
  k.quad4(base, b, c, d, W, L, look);
  k.quad4(base, d, c, b, W, L, look);
}

/** a bush of `n` leaves round (cx, cy, cz), radius `r`, fanning out and up from a dark core (C2's plants) */
function leafBush(k: Kit, rng: Rng, cx: number, cy: number, cz: number, r: number, n: number): void {
  k.blob(ICO0, null, cx, cy, cz, r * 0.5, r * 0.42, r * 0.5, { wash: 0x243a26, line: 0 }, true);
  for (let i = 0; i < n; i++) {
    const th = rng.range(0, Math.PI * 2), ph = rng.range(0.15, 1.25);
    const dir = new Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    const base = new Vector3(cx, cy, cz).addScaledVector(new Vector3(dir.x, 0, dir.z), r * rng.range(0.1, 0.35)).add(new Vector3(0, rng.range(-0.3, 0.2) * r, 0));
    const side = new Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(dir, rng.range(-0.7, 0.7));
    const L = r * rng.range(0.6, 0.95);
    leafQuad(k, base, dir, side, L, L * 0.42, { wash: tint(rng.pick(LEAF_COLS), rng.range(0.8, 1.1) * (0.82 + 0.35 * Math.sin(ph))), line: 0.55, wet: 0.35 });
  }
}

function pottedPlant(k: Kit, rng: Rng, x: number, y: number, z: number, s: number, tree: boolean): void {
  const potH = s * rng.range(0.26, 0.36), potR = s * rng.range(0.15, 0.2);
  const pot: Look = { wash: rng.pick(POT_COLS), line: 1, wet: 0.4, accent: true };
  k.cyl(x, y, z, potR * 0.78, potR, potH, 7, pot, { caps: false });
  k.cyl(x, y + potH - 0.02, z, potR * 1.08, potR * 1.08, 0.05, 7, pot);
  const top = y + potH;
  if (tree) {
    k.limb(new Vector3(x, top, z), new Vector3(x, top + s * 0.5, z), s * 0.035, s * 0.022, 5, { wash: 0x4a3526, line: 0 });
    leafBush(k, rng, x, top + s * 0.6, z, s * 0.34, 28);
  } else leafBush(k, rng, x, top + s * 0.14, z, s * 0.36, 24);
}

interface FootSeg { xa: number; xb: number; floor: number; fTop: number; top: number }

/** the ashlar face of a terrace's retaining wall on the stair's edge, a coping, a pier with a lamp at its low end */
function ashlarWall(k: Kit, rng: Rng, s: FootSeg, edge: number, n: Vector3, lamps: Vector3[]): void {
  const course = 0.46, D = 0.16;
  const base = stairFloor(s.xa + 0.01) - 0.3, topY = s.floor - 0.16;
  let c = 0;
  for (let y = base; y < topY - 0.05; y += course, c++) {
    const h = Math.min(course, topY - y);
    let x = s.xa + (c % 2 === 0 ? 0 : -0.45);
    while (x < s.xb - 0.05) {
      const bx0 = Math.max(x, s.xa), bx1 = Math.min(x + rng.range(0.75, 1.35), s.xb);
      x = bx1;
      if (bx1 - bx0 < 0.12 || y + h < stairFloor(bx0) - 0.02) continue;
      k.box((bx0 + bx1) / 2, y, edge + n.z * (rng.range(0, 0.045) - D / 2), bx1 - bx0 - 0.02, h - 0.02, D, { ...ASHLAR, wash: tint(ASHLAR.wash, rng.range(0.82, 1.12)), seed: rng.range(0, 9) }, { top: null, bottom: null });
    }
  }
  for (let x = s.xa; x < s.xb - 0.05;) {
    const x1 = Math.min(s.xb, x + rng.range(0.9, 1.5));
    k.box((x + x1) / 2, s.floor - 0.16, edge + n.z * 0.08 - n.z * 0.21, x1 - x - 0.015, 0.17, 0.42, { ...COPING, wash: tint(COPING.wash, rng.range(0.9, 1.08)) });
    x = x1;
  }
  const px = s.xa + 0.24, pz = edge + n.z * (0.1 - 0.25);
  k.box(px, base, pz, 0.48, s.floor + 1.05 - base, 0.5, { ...ASHLAR, wash: tint(ASHLAR.wash, 1.08) }, { top: null });
  k.box(px, s.floor + 1.05, pz, 0.62, 0.12, 0.64, COPING);
  k.box(px, s.floor + 1.17, pz, 0.07, 0.5, 0.07, IRON);
  k.box(px, s.floor + 1.67, pz, 0.24, 0.32, 0.24, { wash: 0xffd9a0, emit: 1.1, line: 1, accent: true }, { top: { ...IRON } });
  k.box(px, s.floor + 1.99, pz, 0.32, 0.06, 0.32, IRON);
  lamps.push(new Vector3(px, s.floor + 1.83, pz));
  // ferns in the joints
  for (let i = 0; i < 2; i++) {
    const fx = rng.range(s.xa + 0.6, s.xb - 0.4), fy = rng.range(Math.max(stairFloor(fx) + 0.3, base + 0.3), topY - 0.1);
    if (fy < topY) leafBush(k, rng, fx, fy, edge + n.z * 0.1, rng.range(0.14, 0.24), 10);
  }
}

/** the pavilion's glazed pent roof: from the set-back tower's face down over the frontage to an eave past it */
function pentRoof(k: Kit, rng: Rng, s: FootSeg, face: number, n: Vector3): void {
  const tile = rng.pick([MIN.malachite, MIN.malachite, 0x3d6a58, MIN.azurite]);
  const zB = face - n.z * SETBACK, zF = face + n.z * 0.85, yB = s.fTop + 2.4, yF = s.fTop + 0.55;
  const xa = s.xa - 0.12, xb = s.xb + 0.12, len = xb - xa, slope = Math.hypot(SETBACK + 0.85, yB - yF);
  const A = new Vector3(xa, yF, zF), B = new Vector3(xb, yF, zF), C = new Vector3(xb, yB, zB), D = new Vector3(xa, yB, zB);
  const look: Look = { wash: tile, kind: K.tiles, line: 1, accent: true };
  if (n.z > 0) k.quad4(A, B, C, D, len, slope, look);
  else k.quad4(B, A, D, C, len, slope, look);
  k.box((xa + xb) / 2, yF - 0.2, zF, len, 0.22, 0.1, { wash: MIN.lacquer, line: 1, accent: true });
  for (const [x, dx] of [[xa, -1], [xb, 1]] as const) {
    const g = { wash: 0x6d6a66, line: 1 };
    if (n.z * dx > 0) k.tri(new Vector3(x, yF, zF), new Vector3(x, yB, zB), new Vector3(x, yF, zB), g);
    else k.tri(new Vector3(x, yF, zF), new Vector3(x, yF, zB), new Vector3(x, yB, zB), g);
    k.beam(new Vector3(x, yF - 0.05, zF), new Vector3(x + dx * 0.3, yF + 0.32, zF + n.z * 0.18), 0.09, 0.09, { wash: tile, line: 1, accent: true });
  }
}

/** the tea house's veranda (north): red posts with brackets along the rail, a glazed eave, a lattice frieze, lanterns,
 *  lit lattice doors across the pavilion, tea tables with drinkers */
function teaVeranda(ctx: Ctx, k: Kit, kx: KitX, rng: Rng, s: FootSeg, face: number, edge: number, side: number): void {
  const len = s.xb - s.xa, cx = (s.xa + s.xb) / 2;
  const yIn = s.floor + 3.95, yOut = s.floor + 3.0, zIn = face + side * 0.05, zOut = edge + side * 0.35;
  const xa = s.xa + 0.05, xb = s.xb - 0.05;
  const tile = MIN.malachite;
  const a = new Vector3(xa, yOut, zOut), b = new Vector3(xb, yOut, zOut), c = new Vector3(xb, yIn, zIn), d = new Vector3(xa, yIn, zIn);
  if (side > 0) k.quad4(a, b, c, d, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  else k.quad4(b, a, d, c, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  k.box(cx, yOut - 0.2, zOut, len - 0.05, 0.2, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  const rz = edge - side * 0.2;
  const nPost = Math.max(2, Math.round(len / 2.2) + 1);
  for (let j = 0; j < nPost; j++) {
    const px = xa + 0.1 + ((xb - xa - 0.2) * j) / (nPost - 1);
    k.box(px, s.floor, rz, 0.16, yOut - s.floor + 0.15, 0.16, LACQUER);
    k.beam(new Vector3(px - 0.35, yOut - 0.22, rz), new Vector3(px, yOut - 0.62, rz), 0.07, 0.07, LACQUER);
    k.beam(new Vector3(px + 0.35, yOut - 0.22, rz), new Vector3(px, yOut - 0.62, rz), 0.07, 0.07, LACQUER);
  }
  const ka = ctx.alpha('stair-a');
  const u = side > 0 ? XP : XN, n = side > 0 ? ZP : ZN;
  ka.quad(new Vector3(side > 0 ? xa : xb, yOut - 0.62, rz), u, UP, len - 0.1, 0.42, { wash: 0x5a2a1c, kind: K.net, col: 0.16, line: 1, accent: true });
  const nl = Math.max(1, Math.round(len / 1.6));
  for (let j = 0; j < nl; j++) ctx.lantern(xa + ((j + 0.5) * (len - 0.1)) / nl, yOut - 0.3, rz - side * 0.1, 0.66);
  // the tea room: lit lattice doors across the pavilion's face
  const nb = Math.max(1, Math.round(len / 1.5)), bw = (len - 0.3) / nb;
  for (let j = 0; j < nb; j++) {
    const bc = s.xa + 0.15 + (j + 0.5) * bw;
    shopGlass(ctx, rng, new Vector3(bc, s.floor + 0.05, face + side * 0.05), u, n, bw - 0.2, 2.5, rng.pick([0xffc47e, 0xffb870, 0xffd09a]), rng.range(1.0, 1.2));
    ka.quad(new Vector3(bc - ((bw - 0.2) / 2) * u.x, s.floor + 0.05, face + side * 0.1), u, UP, bw - 0.2, 2.5, { wash: 0x3d1d12, kind: K.bars, row: 1, col: 0.2, line: 1, accent: true });
    k.box(bc - (bw / 2) * u.x, s.floor, face + side * 0.1, 0.14, 2.7, 0.14, TIMBER_DK);
    ctx.emitters.push({ at: new Vector3(bc, s.floor + 1.4, face + side * 0.3), color: new Color(0xffc48a), w: bw - 0.3, h: 2.4, power: 0.2, spill: 0.15 });
  }
  k.box(cx, s.floor + 2.55, face + side * 0.1, len - 0.2, 0.2, 0.18, TIMBER_DK);
  // the 茶 cloth hung off the veranda's first post, facing down the stair (the mockup's: below-left of the 麵 sign)
  if (s.xa < SQ_CORNER + 0.1) {
    const bx = side > 0 ? xa + 0.2 : xb - 0.2;
    k.beam(new Vector3(bx, yOut - 0.1, rz), new Vector3(bx, yOut - 0.1, rz + side * 0.75), 0.06, 0.06, IRON);
    ctx.signs.place({ at: new Vector3(bx, yOut - 1.05, rz + side * 0.6), normal: XN, size: 0.72, spec: { text: '茶', color: '#1a1614', vertical: true, style: 'banner', ink: '#e8e0cc' }, blade: true }, k);
  }
  // a tea table under the eave with its drinkers, one more at the rail looking down onto the stair
  const tx = cx + rng.range(-0.4, 0.4), tz = (face + edge) / 2 + side * 0.1, tr = rng.range(-0.3, 0.3);
  mahjong(k, kx, rng, tx, s.floor, tz, tr, 0, rng.pick([0xb8352a, 0x2f5f9a, 0x3c7a5a]), false);
  for (const st of mahjongSeats(tx, tz, tr).slice(0, 3)) ctx.sitters.push(mat4(st.x, s.floor, st.z, st.yaw));
  ctx.walkers.push(mat4(s.xa + len * rng.range(0.2, 0.4), s.floor, rz - side * 0.42, side > 0 ? rng.range(-0.3, 0.3) : Math.PI + rng.range(-0.3, 0.3), rng.range(0.95, 1.02)));
}

/** a shop at a terrace's level (south): an awning, a lit sign box, goods by the door, a shopkeeper */
function footShop(ctx: Ctx, k: Kit, rng: Rng, s: FootSeg, face: number, n: Vector3, u: Vector3): void {
  const len = s.xb - s.xa, cx = (s.xa + s.xb) / 2;
  piece(ctx, 'awning', new Vector3(cx, s.floor + 2.75, face), u, n, Math.min(len - 0.6, 3.6), 1, rng.range(1.1, 1.5), rng.pick([MIN.cinnabar, MIN.azurite, MIN.malachite, 0x8a6a3a]));
  piece(ctx, 'signBox', new Vector3(s.xa + (n.z > 0 ? 0.35 : len - 0.35), s.floor + 2.9, face), u, n, 1, 1, 1, rng.pick([0xff5a9a, 0x5ae0ff, 0x6affc0, 0xffc060]));
  for (let j = 0; j < rng.int(2, 4); j++) {
    const gx = cx + rng.range(-len / 2 + 0.5, len / 2 - 0.5), gz = face + n.z * rng.range(0.35, 0.8), sz = rng.range(0.3, 0.5);
    k.box(gx, s.floor, gz, sz, rng.range(0.25, 0.5), sz, { wash: rng.pick([0x8a6a3a, 0x6d5236, 0x9a8a6a, 0x5a4632]), line: 1, surf: SURF.wood }, { rotY: rng.range(-0.3, 0.3) });
  }
  ctx.walkers.push(mat4(cx + rng.range(-0.8, 0.8), s.floor, face + n.z * 0.9, n.z > 0 ? 0 : Math.PI, rng.range(0.95, 1.02)));
  ctx.emitters.push({ at: new Vector3(cx, s.floor + 1.4, face + n.z * 0.3), color: new Color(0xffc48a), w: len - 0.6, h: 2.4, power: 0.2, spill: 0.15 });
}

function footTerraces(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const ka = ctx.alpha('stair-a');
  const kx = ctx.kitx('stair-foot');
  const mid = (SQ_CORNER + SQ_BACK) / 2;
  for (const side of [1, -1] as const) {
    const face = side > 0 ? FACE_N : FACE_S, edge = side > 0 ? STAIR.z0 : STAIR.z1;
    const n = side > 0 ? ZP : ZN, u = side > 0 ? XP : XN;
    const lift = side > 0 ? 1.3 : 0.8;
    const lamps: Vector3[] = [];
    const segs: FootSeg[] = [[SQ_CORNER, mid], [mid, SQ_BACK]].map(([xa = SQ_CORNER, xb = SQ_BACK]) => {
      const floor = stairFloor(xb - 0.01) + lift;
      return { xa, xb, floor, fTop: floor + (side > 0 ? 6.4 : 6.1), top: floor + rng.range(30, 44) };
    });
    for (const s of segs) {
      const cx = (s.xa + s.xb) / 2, len = s.xb - s.xa;
      const below = Math.min(stairFloor(s.xa + 0.01), s.floor) - 1.5;
      k.box(cx, below, (face + edge) / 2, len, s.floor - below, Math.abs(edge - face), PLINTH, { top: TERRACE });
      ashlarWall(k, rng, s, edge, n, lamps);
      // the pavilion: a two-storey frontage (the facade grammar, timber, its ground floor at the terrace), the pent
      // roof, the tower set back behind it (as deep as the square's towers leave room for)
      const p0 = new Vector3(side > 0 ? s.xa : s.xb, 0, face);
      dressWall(ctx.fd, p0, n, len, s.floor, s.fTop, Math.floor(rng.next() * 1e6), {
        shops: true, street: s.floor, detailY: [s.floor - 1, s.fTop + 1], timber: 0.7, lit: 0.85, lod: 0, roof: false, setbacks: false,
      }, SETBACK, 1);
      pentRoof(k, rng, s, face, n);
      dressWall(ctx.fd, p0.clone().addScaledVector(n, -SETBACK), n, len, s.fTop + 0.9, s.top, Math.floor(rng.next() * 1e6), {
        shops: false, street: s.floor, detailY: [s.fTop, s.fTop + 12], timber: 0.3, lit: 0.75, lod: 0, roof: true, setbacks: false,
      }, side > 0 ? 4.9 : 10.2, 1);
      // the balustrade: red timber on the tea house, iron by the shops; pots along its inside, a tree now and then
      const rz = edge - side * 0.2;
      const timber = side > 0;
      ka.quad(new Vector3(side > 0 ? s.xa + 0.1 : s.xb - 0.1, s.floor + 0.08, rz), u, UP, len - 0.2, 0.92, timber ? { wash: 0x6a2418, kind: K.bars, row: 1, col: 0.13, line: 1, accent: true } : { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.15, line: 1 });
      k.box(cx, s.floor + 1.0, rz, len - 0.1, 0.07, 0.1, timber ? LACQUER : IRON);
      for (let j = 0; j <= 2; j++) k.box(s.xa + 0.1 + (j * (len - 0.2)) / 2, s.floor, rz, 0.09, 1.1, 0.09, timber ? LACQUER : IRON);
      for (let j = 0; j < 3; j++) pottedPlant(k, rng, s.xa + len * ((j + rng.range(0.25, 0.75)) / 3), s.floor, rz - side * rng.range(0.35, 0.55), rng.range(0.9, 1.3), rng.chance(0.25));
      if (side > 0) {
        clearBand(ctx, s.xa - 0.05, s.xb + 0.05, Math.min(face, edge) - 0.6, Math.max(face, edge) + 0.6, s.floor - 0.3, s.floor + 3.3);
        teaVeranda(ctx, k, kx, rng, s, face, edge, side);
      } else footShop(ctx, k, rng, s, face, n, u);
    }
    for (const p of lamps) ctx.emitters.push({ at: p, color: new Color(0xffd9a0), w: 0.24, h: 0.32, power: 0.12, spill: 0.2 });
  }
}

// ── over the foot: two strings of red lanterns across ──

function lanternString(ctx: Ctx, k: Kit, a: Vector3, b: Vector3, spacing: number, sag: number): void {
  const len = a.distanceTo(b);
  const nSeg = Math.max(2, Math.round(len / spacing));
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < nSeg; i++) k.beam(at(i / nSeg), at((i + 1) / nSeg), 0.025, 0.025, IRON);
  for (let i = 1; i < nSeg; i++) { const q = at(i / nSeg); ctx.lantern(q.x, q.y, q.z, 0.72); }
}

function footStrings(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-over', true);
  for (const x of [28.5, 34]) {
    const y = stairFloor(x) + rng.range(6.2, 8.2);
    lanternString(ctx, k, new Vector3(x + rng.range(-1, 1), y, STAIR.z0), new Vector3(x + rng.range(-1, 1), y + rng.range(-0.6, 0.6), STAIR.z1), 1.25, 0.9);
  }
}

// ── the 麵 sign and the brass dragon on its bracket (the mockup's grapple point) ──

function footSigns(ctx: Ctx): void {
  const k = ctx.kit('stair-signs', true);
  // the 麵 sign: big, high on the tea house's corner, hung clear of its upper gallery (the mockup's upper-left)
  const x = MIAN_X, size = 1.95, wall = STAIR.z0;
  const w = size * 1.36, h = size * 1.62;
  const z = wall + 0.3 + w / 2, y = Y0 + 9.1;
  ctx.signs.place({ at: new Vector3(x, y, z), normal: XN, size, spec: { text: '麵', color: hex(NEON.magenta), vertical: true, style: 'tube' }, blade: true }, k);
  const by = y + h / 2 + 0.3, zOut = z + w / 2 + 0.2;
  k.beam(new Vector3(x, by, wall), new Vector3(x, by, zOut), 0.1, 0.12, IRON);
  k.beam(new Vector3(x, by - 1.3, wall), new Vector3(x, by - 0.05, wall + (zOut - wall) * 0.6), 0.06, 0.06, IRON);
  for (const dz of [-w / 2 + 0.2, w / 2 - 0.2]) k.box(x, y + h / 2 + 0.05, z + dz, 0.05, by - y - h / 2 - 0.05, 0.05, IRON);
  // the brass dragon (the grapple's anchor, the mockup's hero prop): the jian's own sculpted guard head
  // (hero/weapon-parts.ts buildGuardProcedural, snout +y, crown +x) at 7×, on an iron bracket out of the wall just past
  // the sign, looking out over the stair toward the square, the grapple ring hanging from its jaw
  const out = new Vector3(-0.3, 0, 0.95).normalize();
  const base = new Vector3(DRAGON_X, Y0 + 7.1, wall);
  const head = base.clone().addScaledVector(out, 2.7);
  const ez = new Vector3().crossVectors(UP, out);
  const xf = new Matrix4().makeBasis(UP, out, ez).scale(new Vector3(11, 11, 11)).setPosition(head);
  const dx = new XfKitX(xf, true);
  ctx.kitxs.set('stair-dragon', dx);
  ctx.reflective.add('stair-dragon');
  buildGuardProcedural(dx);
  const brass: Look = { wash: 0x8a6a2c, line: 1.1, gloss: true, gold: true, accent: true };
  k.box(base.x, base.y - 0.45, wall + 0.05, 0.5, 1.1, 0.1, IRON);
  k.beam(base, head.clone().addScaledVector(out, -0.45), 0.15, 0.17, brass);
  k.beam(base.clone().add(new Vector3(0, -0.55, 0)), head.clone().addScaledVector(out, -0.5).add(new Vector3(0, -0.1, 0)), 0.07, 0.07, brass);
  k.beam(new Vector3(base.x, base.y + 1.0, wall), head.clone().addScaledVector(out, -0.4).add(new Vector3(0, 0.25, 0)), 0.05, 0.05, IRON);
  // the ring under the open jaw, on a short chain
  const jaw = head.clone().addScaledVector(out, 0.38).add(new Vector3(0, -0.34, 0));
  const ringC = jaw.clone().add(new Vector3(0, -0.55, 0));
  k.beam(jaw, ringC.clone().add(new Vector3(0, 0.2, 0)), 0.035, 0.035, brass);
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
    k.beam(ringC.clone().addScaledVector(out, Math.cos(a0) * 0.2).add(new Vector3(0, Math.sin(a0) * 0.2, 0)),
      ringC.clone().addScaledVector(out, Math.cos(a1) * 0.2).add(new Vector3(0, Math.sin(a1) * 0.2, 0)), 0.045, 0.045, brass);
  }
  ctx.hooks.push(ringC.clone());
}

// ── the crowd on the first flight: umbrellas going up and coming down ──

function footCrowd(ctx: Ctx, rng: Rng): void {
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const placed: [number, number][] = [];
  let n = 0;
  for (let tries = 0; tries < 140 && n < 12; tries++) {
    const x = rng.range(STAIR.x0 + 3, (LANDINGS[0]?.x0 ?? 35.3) - 0.2), z = zc + rng.range(-3.3, 3.3);
    // the mockup camera's foreground stays open
    if (x < 26.5 && Math.abs(z - zc) < 2.2) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 1.1)) continue;
    placed.push([x, z]);
    const up = rng.chance(0.6);
    ctx.walkers.push(mat4(x, stairFloor(x), z, (up ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.25, 0.25), rng.range(0.95, 1.04)));
    n++;
  }
}

/** C1: the stair-street's foot and first flight (x < SQ_BACK); buildStairUpper (C2) builds landing 1 upward */
export function buildStairStreet(ctx: Ctx): void {
  const rng = new Rng(4404);
  flightOne(ctx, rng);
  teaHouse(ctx, rng);
  hotpotShop(ctx, rng);
  footWalls(ctx, rng);
  teaHouseUpper(ctx, rng);
  shopRowUpper(ctx, rng);
  footTerraces(ctx, rng);
  footStrings(ctx, rng);
  footSigns(ctx);
  footCrowd(ctx, rng);
  ctx.map.push({ x0: STAIR.x0, z0: STAIR.z0, x1: STAIR.x1 + 8, z1: STAIR.z1, kind: 'street' });
}
