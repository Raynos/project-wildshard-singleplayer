// Dome D / C1 (E169): the stair-street's plan and its foot — mockup C (art/nine-dragon-stack/round-6-baseline-hud/
// comp-C-stair-street.jpg), whose camera stands on Lantern Square's south-east corner looking up the stair. From the
// square a Chongqing stair-street climbs east between sign-covered towers: three flights of worn wet granite steps and
// two landings, the paifang on the second landing with the last flight rising on through it.
//
// The PLAN (the flights, landings, the paifang's place: shared with C2) and the physics (`stairColliders()`,
// `stairFloor(x)`) are the runtime's, ../world/stairPlan.ts. This file (C1, layout-only: baked, ../world/layoutBake.ts)
// owns everything below SQ_BACK (x < 34.6): the first flight's steps; under the square's two corner towers (which
// stand only SQ_DEPTH deep, towers.ts) the tea room and the hotpot shop at the foot, the timber skin of the tea house's
// upper floors and a lit shop row on the towers' end faces; behind the corner towers (SQ_CORNER…SQ_BACK) raised terraces
// on ashlar walls with low pavilions (the tea house's veranda north, shops south) and their towers set back 3.4 m; the
// 麵 sign, the brass dragon (the jian's guard head at ×11) with the grapple ring, the crowd on the first flight. All of it
// is ONE kit, 'stair-foot' (the steps, the signs' boards, real lattice bars instead of alpha cards, the dragon folded into
// its KitX): the C1 lane's draws (E281). No lantern string crosses the foot any more: from the square it capped mockup
// C's frame (plan F6). Landing 1
// upward (terraces, towers, the paifang, the bridges, the monorail, the upper signs and crowd, the far end) is C2's:
// stairstreet-upper.ts, buildStairUpper(ctx).
import { type BufferGeometry, Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import type { Ctx } from '../world/ctx';
import { dressWall } from './facadeGrammar';
import type { PieceId } from '../world/facade/pieceIds';
import { mahjongSeats } from './figures';
import { KitX } from '../world/hero/kitx';
import { buildGuardProcedural } from '../world/hero/weapon-parts';
import { K, Kit, type Look } from '../world/kit';
import { SURF } from '../look/paint';
import { PLAZA, STAIR, Y0 } from '../layout';
import { MIN, NEON } from '../util';
import { Rng } from '@wildshard/engine/core/rng';
import { FACE_N, FACE_S, FLIGHTS, LANDINGS, RISE, RUN, SQ_BACK, SQ_CORNER, STAIR_GATE, stairFloor } from '../world/stairPlan';

/** the corner towers' base (their end faces on the stair's edges stand on it) */
const SQ_BASE = Y0 + 5;

// ── looks (C2 has its own copies) ──
const PLINTH: Look = { wash: 0x6a6866, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const COPING: Look = { wash: 0x77756f, kind: K.stone, line: 1.8, wet: 0.5 };
const TERRACE: Look = { wash: 0x55565a, kind: K.flag, wet: 0.8, line: 0 };
const TIMBER_DK: Look = { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood };
const LACQUER: Look = { wash: 0x7e2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const IRON: Look = { wash: 0x2a2c31, line: 0.8 };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const tint = (c: number, t: number): number => new Color(c).multiplyScalar(t).getHex();
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
        // (a deep gold, not the brown it was nor the cream it read as under the high-key grade: mockup C's dragon is the
  // richest metal in the frame, E281)
        if (misc.getX(i) <= 0) col.setXYZ(i, col.getX(i) * 0.78, col.getY(i) * 0.54, col.getZ(i) * 0.22);
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
  // sign slots are shrunk to nothing, not removed: build.ts fills the slots in order from one rng, so a removed slot
  // would change the words and styles of every sign after it, all over the city
  for (const sl of ctx.fd.signs) if (inside(sl.at)) sl.size = 0.001;
}

function mat4(x: number, y: number, z: number, yaw: number, s = 1): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(s, s, s));
}

/**
 * Real flat bars (one quad each, facing u × up) from p0 along u for len, h tall, every pitch, with a rail every `rows` m
 * (0 = only the top and bottom rails): the lattices and balustrades the alpha kit drew as dithered cards, which cost the
 * C1 lane a draw of their own (E281).
 */
function lattice(k: Kit, p0: Vector3, u: Vector3, len: number, h: number, pitch: number, rows: number, look: Look): void {
  const count = Math.max(1, Math.round(len / pitch)), t = 0.035;
  for (let i = 1; i < count; i++) k.quad(p0.clone().addScaledVector(u, (i / count) * len - t / 2), u, UP, t, h, look);
  const step = rows > 0 ? rows : h;
  for (let y = 0; y <= h + 0.001; y += step) k.quad(p0.clone().add(new Vector3(0, Math.min(y, h - t), 0)), u, UP, len, t, look);
}

/**
 * A tea table (a round top on a pedestal, a cloth, a pot and cups; with `hotpot` a wide pot of broth). It stands where
 * a mahjong table (~1 900 vertices of tiles nobody sees from the stair) stood, and takes the same 36 numbers from the rng
 * so every later piece of the street keeps its roll.
 */
function teaTable(k: Kit, rng: Rng, px: number, py: number, pz: number, r: number, cloth: number, hotpot = false): void {
  for (let i = 0; i < 36; i++) rng.next();
  const wood: Look = { wash: 0x4a3020, line: 1, accent: true, surf: SURF.wood };
  k.cyl(px, py, pz, 0.09, 0.06, 0.66, 6, { wash: 0x2e2018, line: 0.8 }, { caps: false });
  k.cyl(px, py, pz, 0.28, 0.24, 0.05, 6, { wash: 0x2e2018, line: 0.8 });
  k.cyl(px, py + 0.66, pz, 0.46, 0.46, 0.06, 10, wood);
  k.box(px, py + 0.72, pz, 0.62, 0.008, 0.28, { wash: cloth, line: 0.6, accent: true }, { rotY: r });
  if (hotpot) {
    k.cyl(px, py + 0.72, pz, 0.2, 0.24, 0.14, 8, { wash: 0x3a3a3e, line: 1 });
    k.cyl(px, py + 0.855, pz, 0.22, 0.22, 0.012, 8, { wash: 0xb8352a, emit: 0.25, line: 0, accent: true });
  } else {
    k.cyl(px + Math.cos(r) * 0.12, py + 0.73, pz - Math.sin(r) * 0.12, 0.08, 0.1, 0.13, 6, { wash: 0x2f5f7a, line: 1, accent: true });
  }
  for (let i = 0; i < 3; i++) {
    const a = r + 1.2 + i * 2.1;
    k.cyl(px + Math.cos(a) * 0.3, py + 0.73, pz + Math.sin(a) * 0.3, 0.032, 0.04, 0.05, 5, { wash: 0xe8e0cc, line: 0.6, accent: true }, { caps: false });
  }
}

// ── shops let into the terraces' retaining walls on the stair's edges (E281: the C targets' warm-lit shopfronts stepping
// up the flights). Everything but the stone sill is an instance of a shared piece: the facade's interior-mapped window,
// posts, a ledge, a glazed eave or a striped awning, lattice rails, couplets; plus a hanging sign, a lantern, a warm pool
// of light and now and then a customer at the counter. C2 (stairstreet-upper.ts) uses it too ──

/** a shop window in a retaining wall: x0…x1 along the wall, y0 (its sill, over the highest step under it) … y1 */
export interface Hole { x0: number; x1: number; y0: number; y1: number }

/** the running-bond blocks a hole cuts: the parts of [bx0, bx1] outside it (the course y…y + h overlapping it) */
export function cutByHole(bx0: number, bx1: number, y: number, h: number, hole: Hole | undefined): [number, number][] {
  if (hole === undefined || y + h <= hole.y0 - 0.12 || y >= hole.y1 + 0.02 || bx1 <= hole.x0 - 0.1 || bx0 >= hole.x1 + 0.1) return [[bx0, bx1]];
  const out: [number, number][] = [];
  if (hole.x0 - 0.1 - bx0 > 0.12) out.push([bx0, hole.x0 - 0.1]);
  if (bx1 - (hole.x1 + 0.1) > 0.12) out.push([hole.x1 + 0.1, bx1]);
  return out;
}

/**
 * The figures this lane added after pass 3 (the shops' customers, the people on the balconies) wait here and join the
 * crowd at the end of the stair's build, cut to a multiple of ten: world/build.ts gives walkers their coat and umbrella
 * by index (i % 10), so every figure after this lane's — the Well's — keeps its variant (the square lane's rule, E281).
 */
const extraFigures: { m: Matrix4; rank: number }[] = [];
/** `rank`: lower is more prominent (a climber's x up the stair); people at counters and rails rank after every climber */
export function extraFigure(m: Matrix4, rank = 1000): void { extraFigures.push({ m, rank }); }
export function flushExtraFigures(ctx: Ctx): void {
  const n = Math.floor(extraFigures.length / 10) * 10;
  // (the lowest ranks first, so the cut drops the least prominent figures)
  pushClimbers(ctx, [...extraFigures].sort((a, b) => a.rank - b.rank).slice(0, n));
  extraFigures.length = 0;
}

/** the same through several holes */
export function cutByHoles(bx0: number, bx1: number, y: number, h: number, holes: readonly Hole[]): [number, number][] {
  let parts: [number, number][] = [[bx0, bx1]];
  for (const hole of holes) parts = parts.flatMap(([a, b]) => cutByHole(a, b, y, h, hole));
  return parts;
}

const SHOP_WORDS = ['麵', '茶', '涼茶', '豆花', '抄手', '小面', '雲吞', '糖水', '粥麵', '燒臘', '藥房', '冰室'] as const;
const SHOP_NEON = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber] as const;

/**
 * A shop in a retaining wall facing the stair (`n` out of the wall, toward the steps; `floor(x)` the drawn step under x).
 * `tea`: a glazed green eave and red couplets; else a striped awning. Its own numbers (`r`).
 */
export function wallShop(ctx: Ctx, k: Kit, r: Rng, hole: Hole, edge: number, n: Vector3, floor: (x: number) => number, tea: boolean): void {
  const u = n.z > 0 ? XP : XN;
  const w = hole.x1 - hole.x0, h = hole.y1 - hole.y0, cx = (hole.x0 + hole.x1) / 2;
  const at = (x: number, y: number, out: number): Vector3 => new Vector3(x, y, edge + n.z * out);
  ctx.fd.windows.push({
    m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w - 0.08, h, 1)).setPosition(at(cx, hole.y0, 0.012)),
    win: new Vector4(r.range(0, 97), r.range(1.2, 1.45), 0, 16 + r.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(r.pick([0xffc47e, 0xffb870, 0xffd09a, 0xffc98a])),
  });
  // the sill (a worn granite slab), red jambs, a dark timber lintel
  k.box(cx, hole.y0 - 0.1, edge + n.z * 0.08, w + 0.36, 0.1, 0.3, { ...COPING, wash: 0x86837d });
  for (const x of [hole.x0 + 0.02, hole.x1 - 0.02]) piece(ctx, 'post', at(x, hole.y0 - 0.1, 0.1), u, n, 0.8, h + 0.16, 0.8);
  piece(ctx, 'ledge', at(cx, hole.y1 + 0.02, 0), u, n, w + 0.36, 1.2, 0.8, 0x7a5a44);
  // over it a glazed eave (a tea room) or a striped cloth awning, springing from under the terrace's coping
  if (tea) piece(ctx, 'eave', at(cx, hole.y1 + 0.46, 0), u, n, w + 0.6, 0.62, 0.5, r.pick([0x3f8f6a, 0x357d62, 0x3a6ea8]));
  else piece(ctx, 'awning', at(cx, hole.y1 + 0.42, 0), u, n, w + 0.3, 0.8, 0.75, r.pick([MIN.cinnabar, MIN.azurite, MIN.malachite, 0xd9a441]));
  // a lattice counter front across the window's lower part
  const nr = Math.max(1, Math.round(w - 0.15));
  for (let i = 0; i < nr; i++) piece(ctx, 'rail', at(hole.x0 + 0.1 + ((i + 0.5) * (w - 0.2)) / nr, hole.y0, 0.05), u, n, (w - 0.2) / nr, Math.min(0.95, h * 0.42), 1, 0x6a2e1e);
  if (tea) for (const x of [hole.x0 - 0.3, hole.x1 + 0.3]) piece(ctx, 'couplet', at(x, hole.y0 + h * 0.15, 0.01), u, n, 1, Math.min(1, (h * 0.72) / 1.3), 1);
  // its hanging sign on a bracket, reading down the stair (≥ 2.1 m over the steps), a lantern under the eave
  const sx = hole.x1 + 0.45, word = r.pick(SHOP_WORDS), size = 0.34;
  const sh = size * (Array.from(word).length + 0.62);
  const sy = Math.max(hole.y1 - 0.2, floor(sx) + 2.15 + sh / 2);
  ctx.signs.place({ at: at(sx, sy, 0.62), normal: XN, size, spec: { text: word, color: hex(r.pick(SHOP_NEON)), vertical: true, style: r.chance(0.55) ? 'tube' : 'box' }, blade: true }, k);
  k.beam(at(sx, sy + sh / 2 + 0.12, 0), at(sx, sy + sh / 2 + 0.12, 0.95), 0.05, 0.05, IRON);
  ctx.lantern(hole.x0 + 0.25, hole.y1 - 0.12, edge + n.z * 0.45, 0.5);
  ctx.emitters.push({ at: at(cx, hole.y0 + h * 0.5, 0.3), color: new Color(0xffc48a), w: w - 0.2, h, power: 0.24, spill: 0.3 });
  // now and then a customer at the counter (never on landing 1, where dome C2's cameras stand)
  const L1 = LANDINGS[0], keep = L1 === undefined || cx < L1.x0 - 1.5 || cx > L1.x1 + 1.5;
  if (r.chance(0.45) && keep) extraFigure(mat4(cx + r.range(-0.3, 0.3), floor(cx), edge + n.z * 0.72, n.z > 0 ? Math.PI : 0, r.range(0.95, 1.02)));
}

/**
 * Push a run of climbers so the most prominent of them (lowest `rank` first: the nearest the square's and the landing's
 * cameras) take the crowd's dark-coat, dark-umbrella slots and the rest the beige ones. world/build.ts sorts
 * `ctx.walkers` into variants by index (i % 10: 0–6 dark coats, 2 of them a red umbrella; 7–9 beige, 8 an ochre umbrella):
 * the C targets' climbers are dark robes under dark umbrellas with a red one here and there (E281). The count is unchanged,
 * so no other lane's figure changes variant.
 */
export function pushClimbers(ctx: Ctx, list: readonly { m: Matrix4; rank: number }[]): void {
  const s0 = ctx.walkers.length;
  const dark: number[] = [], light: number[] = [];
  list.forEach((_, j) => { ((s0 + j) % 10 < 7 ? dark : light).push(j); });
  const byRank = [...list].sort((a, b) => a.rank - b.rank);
  const out: (Matrix4 | undefined)[] = Array.from({ length: list.length }, () => undefined);
  [...dark, ...light].forEach((slot, i) => { const c = byRank[i]; if (c !== undefined) out[slot] = c.m; });
  for (const m of out) if (m !== undefined) ctx.walkers.push(m);
}

/**
 * Timber tea-house balconies on a frontage over its veranda or shop (the C targets' verandas stacked up the flanks, E281):
 * the facade's timber balcony, a lit door behind it, a potted plant, a lantern under the pent roof, now and then
 * somebody at the rail looking down the stair. One a storey (two on the 9 m fronts), stepping up with the segments.
 * The grammar's dressing behind is cleared first (its sign slots only shrink: the city's signs keep their words).
 */
export function frontBalconies(ctx: Ctx, r: Rng, s: { xa: number; xb: number; floor: number }, face: number, n: Vector3, u: Vector3, fTop: number): void {
  if (Math.abs((s.xa + s.xb) / 2 - STAIR_GATE.x) < 3.4) return;
  const len = s.xb - s.xa, w = Math.min(len - 0.9, 2.8);
  if (w < 1.6) return;
  const xc = s.xa + len / 2 + r.range(-0.3, 0.3);
  for (let yb = s.floor + 4.4; yb + 1.7 < fTop; yb += 3.0) {
    clearBand(ctx, xc - w / 2 - 0.2, xc + w / 2 + 0.2, Math.min(face, face + n.z * 1.5) - 0.3, Math.max(face, face + n.z * 1.5) + 0.3, yb - 0.4, yb + 2.4);
    piece(ctx, 'balconyTimber', new Vector3(xc, yb, face), u, n, w / 3.6, 1, r.range(0.95, 1.15), 0xffffff);
    ctx.fd.windows.push({
      m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w - 0.9, 2.1, 1)).setPosition(new Vector3(xc, yb + 0.05, face + n.z * 0.012)),
      win: new Vector4(r.range(0, 97), r.range(1.1, 1.35), 0, 16 + r.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(r.pick([0xffc47e, 0xffb870, 0xffd09a])),
    });
    piece(ctx, 'plant', new Vector3(xc - w / 2 + 0.4, yb, face + n.z * 0.72), u, n, r.range(1.0, 1.3), r.range(1.1, 1.5), 1);
    ctx.lantern(xc + w / 2 - 0.25, yb + 2.1, face + n.z, 0.6);
    ctx.emitters.push({ at: new Vector3(xc, yb + 1.2, face + n.z * 0.4), color: new Color(0xffc48a), w: w - 0.8, h: 2, power: 0.16, spill: 0.2 });
    if (r.chance(0.5)) extraFigure(mat4(xc + r.range(-w / 3, w / 3), yb, face + n.z * 0.7, n.z > 0 ? r.range(-0.3, 0.3) : Math.PI + r.range(-0.3, 0.3), r.range(0.95, 1.02)));
  }
}

/**
 * Stacked tea houses up a set-back tower over the pent roof (the C targets' stair walls: deep timber balconies storey on
 * storey, plants spilling over their rails, a glazed eave or an awning over each, hanging signs, lanterns and people at
 * the rails; E281 round 2). `wall` is the tower's face, `n` out of it toward the stair, `y0` the first balcony floor.
 * All instances but the blade signs; the grammar's dressing behind is cleared first (its sign slots only shrink).
 */
export function towerStack(ctx: Ctx, r: Rng, xa: number, xb: number, wall: number, n: Vector3, u: Vector3, y0: number, levels: number): void {
  const len = xb - xa, w = Math.min(len - 0.5, 3.4);
  if (w < 1.8) return;
  const xc = (xa + xb) / 2 + r.range(-0.25, 0.25);
  const at = (x: number, y: number, out: number): Vector3 => new Vector3(x, y, wall + n.z * out);
  clearBand(ctx, xc - w / 2 - 0.3, xc + w / 2 + 0.3, Math.min(wall, wall + n.z * 2.2) - 0.4, Math.max(wall, wall + n.z * 2.2) + 0.4, y0 - 0.5, y0 + levels * 3.1 + 0.4);
  for (let j = 0; j < levels; j++) {
    const yb = y0 + j * 3.1, deep = r.range(1.35, 1.6);
    piece(ctx, 'balconyTimber', at(xc, yb, 0), u, n, w / 3.6, 1, deep, 0xffffff);
    ctx.fd.windows.push({
      m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w - 1.0, 2.1, 1)).setPosition(at(xc, yb + 0.05, 0.012)),
      win: new Vector4(r.range(0, 97), r.range(1.1, 1.4), 0, 16 + r.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(r.pick([0xffc47e, 0xffb870, 0xffd09a])),
    });
    // plants on the rail and spilling over it, a pot in the corner
    for (let x = xc - w / 2 + 0.5; x < xc + w / 2 - 0.4; x += r.range(0.9, 1.4)) {
      piece(ctx, 'planter', at(x, yb + 0.98, 1.2 * deep - 0.28), u, n, r.range(0.75, 1.0), r.range(0.9, 1.3), 0.55);
    }
    piece(ctx, 'plant', at(xc + w / 2 - 0.45, yb, 0.55), u, n, r.range(1.0, 1.3), r.range(1.2, 1.6), 1);
    // over it a glazed eave or a striped awning, and a lantern under its lip; now and then a hanging sign
    if (r.chance(0.65)) piece(ctx, 'eave', at(xc, yb + 2.75, 0), u, n, w + 0.5, 0.7, 1.35 * deep / 1.25, r.pick([0x3f8f6a, 0x357d62, 0x3a6ea8, 0x2f6f5c]));
    else piece(ctx, 'awning', at(xc, yb + 2.7, 0.1), u, n, w, 0.9, 1.1 * deep, r.pick([MIN.cinnabar, MIN.azurite, MIN.malachite, 0xd9a441]));
    ctx.lantern(xc - w / 2 + 0.3, yb + 2.15, wall + n.z * (1.2 * deep - 0.1), r.range(0.55, 0.7));
    if (r.chance(0.45)) {
      const sx = xc + (r.chance(0.5) ? -1 : 1) * (w / 2 + 0.35), word = r.pick(SHOP_WORDS), size = 0.36;
      ctx.signs.place({ at: at(sx, yb + 1.5, 0.75), normal: XN, size, spec: { text: word, color: hex(r.pick(SHOP_NEON)), vertical: true, style: r.chance(0.6) ? 'tube' : 'box' }, blade: true }, null);
    }
    ctx.emitters.push({ at: at(xc, yb + 1.2, 0.5), color: new Color(0xffc48a), w: w - 0.8, h: 2, power: 0.14, spill: 0.2 });
    if (r.chance(0.55)) extraFigure(mat4(xc + r.range(-w / 3, w / 3), yb, wall + n.z * 0.8, n.z > 0 ? r.range(-0.3, 0.3) : Math.PI + r.range(-0.3, 0.3), r.range(0.95, 1.02)));
  }
}

// ── the first flight ──

/** the drawn floor on flight 1 (its half-step tops) — where people stand; stairFloor(x) is the collider's */
function drawnFloor(x: number): number {
  const f = FLIGHTS[0];
  if (f === undefined || x < f.x0 || x >= f.x1) return stairFloor(x);
  return f.y0 + (Math.min(2 * f.steps - 1, Math.floor((x - f.x0) / (RUN / 2))) + 1) * (RISE / 2);
}

// C2's step looks (stairstreet-upper.ts), so the whole stair reads as one
const HALF_TOP: Look = { wash: 0x51545a, kind: K.flag, wet: 1, line: 1.8 };
// (E281: dark risers in their own shadow, wet treads a shade lighter, and a bright worn nosing on every step, so that
// from the square the flights read as single stone steps edged in light, as the C targets paint them, not as a dark
// ramp. Light granite risers were tried and read as a pale ramp under the high-key grade.)
const HALF_RISER: Look = { wash: 0x44454a, kind: K.stone, line: 1.8, wet: 0.6 };
// (a faint glow on the worn edge: the wet sheen that picks out every step from the square, E281 pass 5)
const NOSING: Look = { wash: 0xdfe1e3, kind: K.stone, line: 0, wet: 0.6, emit: 0.3 };
const MOSS: Look = { wash: 0x3a4a34, kind: K.leaf, line: 0, wet: 0.6 };

/**
 * Flight 1, drawn as C2 draws flights 2–3: HALF-STEPS (0.175 m rise, 0.33 m tread: the mockup's fine worn steps) over
 * the physics' 0.35 / 0.667 treads — each collider tread shows two stone steps, the upper one flush with it — laid in
 * 2–4 long granite slabs, worn lower in the middle, bright worn nosings, moss where they meet the walls.
 */
function flightOne(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const f = FLIGHTS[0];
  if (f === undefined) return;
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const hr = RISE / 2, hd = RUN / 2;
  for (let j = 0; j < 2 * f.steps; j++) {
    const x = f.x0 + j * hd, top = f.y0 + (j + 1) * hr;
    let z = STAIR.z0;
    while (z < STAIR.z1 - 0.05) {
      const len = Math.min(STAIR.z1 - z, rng.range(1.5, 3.2));
      const mid = Math.abs(z + len / 2 - zc) < 2.2;
      const sag = mid && rng.chance(0.35) ? rng.range(0.008, 0.025) : 0;
      const tone = rng.range(0.78, 1.14);
      k.box(x + hd / 2, top - hr - 0.22, z + len / 2, hd + 0.03, hr + 0.22 - sag, len - 0.025,
        { ...HALF_RISER, wash: tint(HALF_RISER.wash, tone) }, { top: { ...HALF_TOP, wash: tint(HALF_TOP.wash, tone) } });
      const nx = x - 0.005, ny = top - sag;
      k.quad4(new Vector3(nx, ny - 0.085, z + len - 0.02), new Vector3(nx, ny - 0.085, z + 0.01), new Vector3(nx + 0.085, ny + 0.002, z + 0.01), new Vector3(nx + 0.085, ny + 0.002, z + len - 0.02),
        len - 0.03, 0.12, { ...NOSING, wash: tint(NOSING.wash, tone) });
      z += len;
    }
    for (const [ze, dz] of [[STAIR.z0, 1], [STAIR.z1, -1]] as const) {
      if (rng.chance(0.45)) k.quad(new Vector3(x + 0.02, top + 0.004, ze), XP, new Vector3(0, 0, dz), hd - 0.04, rng.range(0.08, 0.22), MOSS);
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
  lattice(k, new Vector3(x0 + 0.25, floor + 0.05, zf - 0.22), XP, x1 - x0 - 0.5, 0.95, 0.12, 0, { wash: 0x5a2a1c, line: 0.5, accent: true });
  k.box(cx, floor + 0.95, zf - 0.22, x1 - x0 - 0.3, 0.07, 0.1, LACQUER);
  // a lattice transom under the ceiling (格子)
  lattice(k, new Vector3(x0 + 0.25, ceil - 0.85, zf - 0.21), XP, x1 - x0 - 0.5, 0.55, 0.18, 0.18, { wash: 0x5a2a1c, line: 0.5, accent: true });
  // the pent eave out over the stair (glazed tiles, a lacquer fascia) with lanterns under it
  const ey = ceil - 0.2, ez = zf + 1.35;
  k.quad4(new Vector3(x0 - 0.2, ey - 0.55, ez), new Vector3(x1 + 0.2, ey - 0.55, ez), new Vector3(x1 + 0.2, ey + 0.1, zf), new Vector3(x0 - 0.2, ey + 0.1, zf),
    x1 - x0 + 0.4, 1.5, { wash: MIN.malachite, kind: K.tiles, line: 1, accent: true });
  k.box(cx, ey - 0.68, ez, x1 - x0 + 0.4, 0.14, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  for (const t of [0.2, 0.5, 0.8]) ctx.lantern(x0 + (x1 - x0) * t, ey - 0.72, ez - 0.25, 0.62);
  // two tea tables on the veranda with their drinkers (TRELLIS sitters come with stools), a pot of plants at the end
  for (const [tx, tz, tr, n] of [[x0 + 1.1, zf - 1.4, 0.3, 3], [x0 + 3.0, zf - 1.5, -0.2, 2]] as const) {
    teaTable(k, rng, tx, floor, tz, tr, 0xb8352a);
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
  lattice(k, new Vector3(x1 - 0.25, floor + 0.05, zf + 0.18), XN, x1 - x0 - 0.5, 0.95, 0.14, 0, { wash: 0x2a2c31, line: 0.5 });
  k.box(cx, floor + 0.95, zf + 0.18, x1 - x0 - 0.3, 0.05, 0.06, IRON);
  piece(ctx, 'awning', new Vector3(cx, ceil - 0.55, zf), XN, ZN, x1 - x0 - 0.3, 1, 1.35, MIN.cinnabar);
  teaTable(k, rng, cx - 0.5, floor, zf + 1.5, 0.1, 0x2f5f9a, true);
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

interface FrontSpec {
  /** the face's left end (seen from outside) on its plane; `u` runs along it, `n` out of it (both axis-aligned) */
  a: Vector3;
  u: Vector3;
  n: Vector3;
  len: number;
  /** the skin's base (the tower's base) */
  yA: number;
  /** which bays (by their centre's distance along u) get the gallery and the lower eave's lanterns */
  lower: (s: number) => boolean;
  lantern: (s: number) => boolean;
  /** where the lower eave ends (along u) */
  eaveEnd: number;
}

/**
 * A two-storey timber front skinned over a tower's lower floors (the grammar's dressing there is cleared first): a
 * plank wall and a lacquer frame, lit lattice doors below and lattice windows above, a shallow upper gallery with a
 * lattice rail, a glazed pent eave over the doors with lanterns under it, the roof eave at the top.
 */
function timberFront(ctx: Ctx, rng: Rng, S: FrontSpec): void {
  const k = ctx.kit('stair-foot', true);
  const { a, u, n, len, yA } = S;
  const yB = yA + 3.4, yTop = yA + 6.8;
  const P = (s: number, y: number, out: number): Vector3 => a.clone().addScaledVector(u, s).addScaledVector(n, out).setY(y);
  const e = P(len, yA, 0), i0 = P(0, yA, -0.6), o1 = P(len, yA, 2.8);
  clearBand(ctx, Math.min(a.x, e.x) - 0.3, Math.max(a.x, e.x) + 0.3, Math.min(i0.z, o1.z), Math.max(i0.z, o1.z), yA - 0.3, yTop + 0.2);
  k.quad(P(0, yA, 0.03), u, UP, len, yTop - yA, { wash: 0x4a3526, line: 1, surf: SURF.wood });
  for (const y of [yA, yB, yTop]) k.box(P(len / 2, 0, 0.12).x, y - 0.12, P(len / 2, 0, 0.12).z, len, 0.24, 0.22, TIMBER_DK);
  const nb = Math.round(len / 2.4), bw = len / nb;
  for (let b = 0; b <= nb; b++) { const p = P(b * bw, yA, 0.12); k.box(p.x, yA, p.z, 0.2, yTop - yA, 0.2, LACQUER); }
  for (let b = 0; b < nb; b++) {
    const s0 = b * bw, sc = s0 + bw / 2;
    shopGlass(ctx, rng, P(sc, yA + 0.12, 0.04), u, n, bw - 0.36, yB - yA - 0.5, rng.pick([0xffc47e, 0xffb870, 0xffd09a]), rng.range(0.95, 1.15));
    lattice(k, P(s0 + 0.18, yA + 0.12, 0.1), u, bw - 0.36, yB - yA - 0.5, 0.2, 0.72, { wash: 0x3d1d12, line: 0.5, accent: true });
    shopGlass(ctx, rng, P(sc, yB + 0.55, 0.04), u, n, bw - 0.5, 2.0, 0xffc47e, rng.chance(0.8) ? 1 : 0, false);
    lattice(k, P(s0 + 0.25, yB + 0.55, 0.1), u, bw - 0.5, 2.0, 0.2, 0.2, { wash: 0x3d1d12, line: 0.5, accent: true });
    if (S.lower(sc)) {
      const g = P(sc, 0, 0.35), r = P(sc, 0, 0.68);
      k.box(g.x, yB - 0.02, g.z, bw, 0.14, 0.7, TIMBER_DK);
      lattice(k, P(s0 + 0.05, yB + 0.12, 0.68), u, bw - 0.1, 0.85, 0.11, 0, { wash: 0x5a2a1c, line: 0.5, accent: true });
      k.box(r.x, yB + 0.95, r.z, bw, 0.07, 0.09, LACQUER);
      if (rng.chance(0.45)) {
        const w = P(sc + rng.range(-0.5, 0.5), yB + 0.12, 0.35);
        ctx.walkers.push(mat4(w.x, w.y, w.z, (n.z > 0 ? 0 : Math.PI) + rng.range(-0.4, 0.4), rng.range(0.95, 1.02)));
      }
    }
    ctx.emitters.push({ at: P(sc, yA + 1.4, 0.2), color: new Color(0xffc48a), w: bw - 0.4, h: 2.6, power: 0.22, spill: 0.15 });
  }
  const eave = (sa: number, sb: number, yWall: number, drop: number, out: number, tile: number): void => {
    k.quad4(P(sa, yWall - drop, out), P(sb, yWall - drop, out), P(sb, yWall, 0.05), P(sa, yWall, 0.05), Math.abs(sb - sa), Math.hypot(out, drop), { wash: tile, kind: K.tiles, line: 1, accent: true });
    const f = P((sa + sb) / 2, 0, out);
    k.box(f.x, yWall - drop - 0.16, f.z, Math.abs(sb - sa), 0.16, 0.08, { wash: MIN.lacquer, line: 1, accent: true });
  };
  eave(-0.2, S.eaveEnd, yB - 0.12, 0.42, 0.95, MIN.malachite);
  eave(-0.3, len + 0.3, yTop + 0.55, 0.6, 1.5, MIN.malachite);
  for (let b = 0; b < nb; b++) {
    const sc = (b + 0.5) * bw;
    if (sc < S.eaveEnd - 0.6 && S.lantern(sc)) { const l = P(sc, yB - 0.66, 0.42); ctx.lantern(l.x, l.y, l.z, 0.62); }
    const t = P(sc, yTop - 0.2, 0.9);
    ctx.lantern(t.x, t.y, t.z, 0.7);
  }
}

function teaHouseUpper(ctx: Ctx, rng: Rng): void {
  const x0 = PLAZA.x1 + 0.6, len = SQ_CORNER - x0;
  timberFront(ctx, rng, {
    a: new Vector3(x0, 0, STAIR.z0), u: XP, n: ZP, len, yA: SQ_BASE, eaveEnd: Math.min(EAVE_X1, SQ_CORNER) - x0,
    lower: (s) => x0 + s <= EAVE_X1 && Math.abs(x0 + s - MIAN_X) > 1,
    lantern: (s) => Math.abs(x0 + s - MIAN_X) > 1 && Math.abs(x0 + s - DRAGON_X) > 1,
  });
}

/** the square's south wall, where mockup C's camera turns right (C1 view 6): its lower floors a timber tea house */
function southTeaHouse(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stair-foot', true);
  const x0 = PLAZA.x1 + 0.6, len = 12.4, z = PLAZA.z1 + 0.6;
  timberFront(ctx, rng, { a: new Vector3(x0, 0, z), u: XN, n: ZN, len, yA: Y0 + 5, eaveEnd: len + 0.2, lower: () => true, lantern: () => true });
  // its signs: the 茶樓 board over the doors' eave, a 茶 cloth hung from the gallery
  ctx.signs.place({ at: new Vector3(x0 - 4.8, Y0 + 7.95, z - 1.05), normal: ZN, size: 0.6, spec: { text: '茶樓', color: hex(NEON.cyan), vertical: false, style: 'tube' } }, k);
  ctx.signs.place({ at: new Vector3(x0 - 9.6, Y0 + 7.2, z - 0.75), normal: ZN, size: 0.7, spec: { text: '茶', color: '#1a1614', vertical: true, style: 'banner', ink: '#e8e0cc' } }, k);
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
    // the last bay keeps its face bare: C2's 旅館 / 火鍋 / 牙科 blades hang over the south stair edge at x ≈ 28–30
    const bare = bx0 + bw > 27.5;
    if (shut) piece(ctx, 'shutter', new Vector3(bc, yA + 0.05, zf - 0.02), XN, ZN, bw - 0.5, 2.6, 1, 0xd8d4cc);
    else shopGlass(ctx, rng, new Vector3(bc, yA + 0.1, zf - 0.04), XN, ZN, bw - 0.45, 2.6, rng.pick([0xffc47e, 0xd9efe8, 0xffb870]), rng.range(1.0, 1.15));
    // its sign board over the door (neon on a dark board, facing across the stair) and a striped awning where it clears
    if (!bare) ctx.signs.place({ at: new Vector3(bc, yB - 0.35, zf - 0.12), normal: ZN, size: 0.42, spec: { text: words[b] ?? '茶', color: hex(cols[b] ?? NEON.jade), vertical: false, style: 'tube' } }, k);
    if (bx0 + bw <= EAVE_X1 + 0.1 && !shut && !bare) piece(ctx, 'awning', new Vector3(bc, yB - 0.7, zf), XN, ZN, bw - 0.4, 1, 1.1, rng.pick([MIN.cinnabar, MIN.azurite, MIN.malachite]));
    if (!shut) ctx.emitters.push({ at: new Vector3(bc, yA + 1.4, zf - 0.2), color: new Color(0xffc48a), w: bw - 0.6, h: 2.4, power: 0.22, spill: 0.15 });
    // upstairs: a window, an air-con box under it, a potted plant on the sill
    shopGlass(ctx, rng, new Vector3(bc, yB + 0.8, zf - 0.04), XN, ZN, bw - 1.1, 1.6, 0xffc98a, rng.chance(0.75) ? 1 : 0, false);
    if (!bare) piece(ctx, 'acUnit', new Vector3(bc + bw * 0.3, yB + 0.3, zf), XN, ZN, 1, 1, 1, 0xe6e4df);
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
function ashlarWall(k: Kit, rng: Rng, s: FootSeg, edge: number, n: Vector3, lamps: Vector3[], hole?: Hole): void {
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
      const p = rng.range(0, 0.045), tone = rng.range(0.82, 1.12), seed = rng.range(0, 9);
      for (const [a, b] of cutByHole(bx0, bx1, y, h, hole)) {
        k.box((a + b) / 2, y, edge + n.z * (p - D / 2), b - a - 0.02, h - 0.02, D, { ...ASHLAR, wash: tint(ASHLAR.wash, tone), seed }, { top: null, bottom: null });
      }
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
    const inHole = hole !== undefined && fx > hole.x0 - 0.3 && fx < hole.x1 + 0.3 && fy > hole.y0 - 0.3;
    if (fy < topY) leafBush(inHole ? new Kit() : k, rng, fx, fy, edge + n.z * 0.1, rng.range(0.14, 0.24), 10);
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
function teaVeranda(ctx: Ctx, k: Kit, rng: Rng, s: FootSeg, face: number, edge: number, side: number): void {
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
  const u = side > 0 ? XP : XN, n = side > 0 ? ZP : ZN;
  lattice(k, new Vector3(side > 0 ? xa : xb, yOut - 0.62, rz + side * 0.09), u, len - 0.1, 0.42, 0.16, 0.14, { wash: 0x5a2a1c, line: 0.5, accent: true });
  const nl = Math.max(1, Math.round(len / 1.6));
  for (let j = 0; j < nl; j++) ctx.lantern(xa + ((j + 0.5) * (len - 0.1)) / nl, yOut - 0.3, rz - side * 0.1, 0.66);
  // the tea room: lit lattice doors across the pavilion's face
  const nb = Math.max(1, Math.round(len / 1.5)), bw = (len - 0.3) / nb;
  for (let j = 0; j < nb; j++) {
    const bc = s.xa + 0.15 + (j + 0.5) * bw;
    shopGlass(ctx, rng, new Vector3(bc, s.floor + 0.05, face + side * 0.05), u, n, bw - 0.2, 2.5, rng.pick([0xffc47e, 0xffb870, 0xffd09a]), rng.range(1.0, 1.2));
    lattice(k, new Vector3(bc - ((bw - 0.2) / 2) * u.x, s.floor + 0.05, face + side * 0.1), u, bw - 0.2, 2.5, 0.2, 0.42, { wash: 0x3d1d12, line: 0.5, accent: true });
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
  teaTable(k, rng, tx, s.floor, tz, tr, rng.pick([0xb8352a, 0x2f5f9a, 0x3c7a5a]));
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
  const mid = (SQ_CORNER + SQ_BACK) / 2;
  const shops = new Rng(7310), green = new Rng(7314), bal = new Rng(7315), stack = new Rng(7317);
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
      const hx0 = s.xa + 0.7, hx1 = Math.min(hx0 + 1.3, s.xb - 0.35);
      const hy0 = stairFloor(hx1 - 0.01) + 0.1, hy1 = s.floor - 0.5;
      const hole = hy1 - hy0 > 1.3 ? { x0: hx0, x1: hx1, y0: hy0, y1: hy1 } : undefined;
      ashlarWall(k, rng, s, edge, n, lamps, hole);
      if (hole !== undefined) wallShop(ctx, k, shops, hole, edge, n, drawnFloor, side > 0);
      // the pavilion: a two-storey frontage (the facade grammar, timber, its ground floor at the terrace), the pent
      // roof, the tower set back behind it (as deep as the square's towers leave room for)
      const p0 = new Vector3(side > 0 ? s.xa : s.xb, 0, face);
      dressWall(ctx.fd, p0, n, len, s.floor, s.fTop, Math.floor(rng.next() * 1e6), {
        shops: true, street: s.floor, detailY: [s.floor - 1, s.fTop + 1], timber: 0.7, lit: 0.85, lod: 0, roof: false, setbacks: false,
      }, SETBACK, 1);
      pentRoof(k, rng, s, face, n);
      frontBalconies(ctx, bal, s, face, n, u, s.fTop);
      towerStack(ctx, stack, s.xa, s.xb, face - n.z * SETBACK, n, u, s.fTop + 3.1, 2);
      dressWall(ctx.fd, p0.clone().addScaledVector(n, -SETBACK), n, len, s.fTop + 0.9, s.top, Math.floor(rng.next() * 1e6), {
        shops: false, street: s.floor, detailY: [s.fTop, s.fTop + 12], timber: 0.3, lit: 0.75, lod: 0, roof: true, setbacks: false,
      }, side > 0 ? 4.9 : 10.2, 1);
      // the balustrade: red timber on the tea house, iron by the shops; pots along its inside, a tree now and then
      const rz = edge - side * 0.2;
      const timber = side > 0;
      lattice(k, new Vector3(side > 0 ? s.xa + 0.1 : s.xb - 0.1, s.floor + 0.08, rz + side * 0.05), u, len - 0.2, 0.92, timber ? 0.13 : 0.15, 0, timber ? { wash: 0x6a2418, line: 0.5, accent: true } : { wash: 0x2a2c31, line: 0.5 });
      k.box(cx, s.floor + 1.0, rz, len - 0.1, 0.07, 0.1, timber ? LACQUER : IRON);
      for (let j = 0; j <= 2; j++) k.box(s.xa + 0.1 + (j * (len - 0.2)) / 2, s.floor, rz, 0.09, 1.1, 0.09, timber ? LACQUER : IRON);
      for (let j = 0; j < 3; j++) pottedPlant(k, rng, s.xa + len * ((j + rng.range(0.25, 0.75)) / 3), s.floor, rz - side * rng.range(0.35, 0.55), rng.range(0.9, 1.3), rng.chance(0.25));
      // planter troughs on the coping in front of the rail and a big potted shrub at the lip: mockup C's stone terrace
      // walls at the foot are green along their tops (instances of the facade's planter and plant, E281 pass 6)
      for (let x = s.xa + green.range(0.5, 0.9); x < s.xb - 0.6; x += green.range(1.2, 1.8)) {
        piece(ctx, 'planter', new Vector3(x, s.floor, edge - side * 0.14), u, n, green.range(1.0, 1.35), green.range(1.1, 1.5), 0.7);
      }
      piece(ctx, 'plant', new Vector3(s.xb - 0.45, s.floor, edge - side * 0.32), u, n, green.range(1.5, 1.9), green.range(1.7, 2.2), 1.5);
      if (side > 0) {
        clearBand(ctx, s.xa - 0.05, s.xb + 0.05, Math.min(face, edge) - 0.6, Math.max(face, edge) + 0.6, s.floor - 0.3, s.floor + 3.3);
        teaVeranda(ctx, k, rng, s, face, edge, side);
      } else footShop(ctx, k, rng, s, face, n, u);
    }
    for (const p of lamps) ctx.emitters.push({ at: p, color: new Color(0xffd9a0), w: 0.24, h: 0.32, power: 0.12, spill: 0.2 });
  }
}

// ── the 麵 sign and the brass dragon on its bracket (the mockup's grapple point) ──

function footSigns(ctx: Ctx): void {
  const k = ctx.kit('stair-foot', true);
  // the 麵 sign: high on the tea house's corner, hung close to its wall, clear of its upper gallery — the mockup's
  // upper-left corner, not the middle of the frame (E281: at 1.95 m and 0.3 m off the wall it filled mockup C's top)
  const x = MIAN_X, size = 1.25, wall = STAIR.z0;
  const w = size * 1.36, h = size * 1.62;
  const z = wall + 0.2 + w / 2, y = Y0 + 9.85;
  ctx.signs.place({ at: new Vector3(x, y, z), normal: XN, size, spec: { text: '麵', color: hex(NEON.magenta), vertical: true, style: 'tube' }, blade: true }, k);
  const by = y + h / 2 + 0.3, zOut = z + w / 2 + 0.2;
  k.beam(new Vector3(x, by, wall), new Vector3(x, by, zOut), 0.1, 0.12, IRON);
  k.beam(new Vector3(x, by - 1.3, wall), new Vector3(x, by - 0.05, wall + (zOut - wall) * 0.6), 0.06, 0.06, IRON);
  for (const dz of [-w / 2 + 0.2, w / 2 - 0.2]) k.box(x, y + h / 2 + 0.05, z + dz, 0.05, by - y - h / 2 - 0.05, 0.05, IRON);
  // two red lanterns on a chain under the sign's wall end, one more a bay nearer the square (mockup C's lanterns down
  // the tea house's face beneath the 麵 sign)
  k.beam(new Vector3(x - 0.3, y - h / 2 - 0.05, wall + 0.55), new Vector3(x - 0.3, y - h / 2 - 1.55, wall + 0.55), 0.02, 0.02, IRON);
  ctx.lantern(x - 0.3, y - h / 2 - 0.9, wall + 0.55, 0.62);
  ctx.lantern(x - 0.3, y - h / 2 - 1.75, wall + 0.55, 0.56);
  ctx.lantern(x - 2.1, y - h / 2 - 1.2, wall + 0.5, 0.6);
  // the brass dragon (the grapple's anchor, the mockup's hero prop): the jian's own sculpted guard head
  // (hero/weapon-parts.ts buildGuardProcedural, snout +y, crown +x) at 11×, on an iron bracket out of the wall just past
  // the sign and level with it (mockup C: a quarter of the way down the frame, right of the sign), looking out over the
  // stair toward the square, the grapple ring hanging from its jaw. Its KitX is the foot's (one draw with the kit).
  const out = new Vector3(-0.3, 0, 0.95).normalize();
  const base = new Vector3(DRAGON_X, Y0 + 9.6, wall);
  const head = base.clone().addScaledVector(out, 2.7);
  const ez = new Vector3().crossVectors(UP, out);
  const xf = new Matrix4().makeBasis(UP, out, ez).scale(new Vector3(11, 11, 11)).setPosition(head);
  const dx = new XfKitX(xf, true);
  ctx.kitxs.set('stair-foot', dx);
  buildGuardProcedural(dx);
  const brass: Look = { wash: 0xa8842e, line: 1.1, gloss: true, gold: true, accent: true };
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
  const list: { m: Matrix4; rank: number }[] = [];
  let n = 0;
  for (let tries = 0; tries < 140 && n < 12; tries++) {
    const x = rng.range(STAIR.x0 + 3, (LANDINGS[0]?.x0 ?? 35.3) - 0.2), z = zc + rng.range(-3.3, 3.3);
    // the mockup camera's foreground stays open, and the axis up flight 1 (mockup C sees the paifang's base over it: a
    // crowd in the middle of the flight hid it, E281); the climbers keep to the sides as the mockup's do
    if (x < 26.5 && Math.abs(z - zc) < 2.2) continue;
    if (Math.abs(z - zc) < 1.7) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 1.1)) continue;
    placed.push([x, z]);
    const up = rng.chance(0.6);
    list.push({ m: mat4(x, drawnFloor(x), z, (up ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.25, 0.25), rng.range(0.95, 1.04)), rank: x });
    n++;
  }
  pushClimbers(ctx, list);
}

/** C1: the stair-street's foot and first flight (x < SQ_BACK); buildStairUpper (C2) builds landing 1 upward */
export function buildStairStreet(ctx: Ctx): void {
  const rng = new Rng(4404);
  extraFigures.length = 0;
  flightOne(ctx, rng);
  teaHouse(ctx, rng);
  hotpotShop(ctx, rng);
  footWalls(ctx, rng);
  teaHouseUpper(ctx, rng);
  shopRowUpper(ctx, rng);
  southTeaHouse(ctx, rng);
  footTerraces(ctx, rng);
  // (the lantern string across the foot is gone, E281: it capped mockup C's frame; its three numbers are still drawn so
  // the crowd below keeps its places)
  for (let i = 0; i < 3; i++) rng.next();
  footSigns(ctx);
  footCrowd(ctx, rng);
  ctx.map.push({ x0: STAIR.x0, z0: STAIR.z0, x1: STAIR.x1 + 8, z1: STAIR.z1, kind: 'street' });
}
