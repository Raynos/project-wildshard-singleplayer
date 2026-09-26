// Dome C2 (E169): the upper stair-street — landing 1 upward (mockup C's middle and far ground; the dome's 3×3 targets in
// art/nine-dragon-stack/round-15-eight-domes/C2-stair-look/). Everything at x ≥ SQ_BACK, where the square's towers end:
// - the steps of flight 2 and 3, drawn as HALF-STEPS (0.175 m rise, 0.33 m tread: the mockup's fine worn steps) over
//   the physics' 0.35 / 0.667 treads (dome D's stairColliders, unchanged) — each collider tread shows two stone steps,
//   the upper one flush with it; nosings catch the light, moss at the ends, the landings' curbs, fallen petals;
// - stepped stone terraces on both sides RAISED over the stair: ashlar retaining walls with a coping and piers, vines
//   hanging over, red timber / iron balustrades, rows of potted plants in flower, tea verandas with drinkers, people at
//   the rail, lantern posts; the towers standing on them (the facade grammar, shops at the terrace level);
// - the paifang on landing 2 (dome B's gate turned across the stair);
// - over the street: lantern strings, cables, the skybridge beyond the paifang (people at its rails, red banners, lanterns
//   under its eaves), a high bridge, the monorail; the hero neon (旅館 火鍋 牙科 stacked on the right as the mockup's),
//   blade signs up both sides; the crowd with umbrellas; the far end.
// Dome D's stairstreet.ts keeps the plan (stairFloor, the colliders), the foot and flight 1; towers.ts calls
// `buildStairUpper(ctx)` after `buildStairStreet(ctx)`. Nothing here hangs over the stair lower than 2.1 m above it; the
// only things standing in the walkable stair are the landings' stone planters, whose boxes are `stairUpperColliders()`.
// The terraces' kit is split per 32 m cell with a draw distance (ctx.cell / ctx.far), the paifang too.
import { type BufferGeometry, Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import type { ColliderDesc } from '../../../world/registry';
import type { Ctx } from './ctx';
import { buildGate } from './gate';
import { dressWall, spanStreet } from './facade/grammar';
import type { PieceId } from './facade/pieces';
import { mahjong } from './hero/figures';
import { KitX, merge } from './hero/kitx';
import { K, Kit, type Look } from './kit';
import { dragonHook } from './props';
import { FACE_N, FACE_S, FAR_X, FLIGHTS, LANDINGS, RISE, RUN, SQ_BACK, STAIR_GATE, TOP_Y, stairFloor } from './stairstreet';
import { SURF } from '../look/paint';
import { SignBuilder, type SignPlace } from '../look/signs';
import { STAIR, Y0 } from '../layout';
import { MIN, NEON, Rng } from '../util';

// ── looks ──
const STEP_TOP: Look = { wash: 0x4a4c52, kind: K.flag, wet: 1, line: 1.8 };
const STEP_RISER: Look = { wash: 0x4f4e53, kind: K.stone, line: 1.8, wet: 0.7 };
const NOSING: Look = { wash: 0xa4a7ad, kind: K.stone, line: 0, wet: 0.8 };
const MOSS: Look = { wash: 0x3a4a34, kind: K.leaf, line: 0, wet: 0.6 };
const PLINTH: Look = { wash: 0x6a6866, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const ASHLAR: Look = { wash: 0x7a7872, kind: K.stone, line: 1, wet: 0.5, surf: SURF.stone };
const COPING: Look = { wash: 0x8a877f, kind: K.stone, line: 1.8, wet: 0.5 };
const TERRACE: Look = { wash: 0x55565a, kind: K.flag, wet: 0.8, line: 0 };
const LACQUER: Look = { wash: 0x7e2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const TIMBER: Look = { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood };
const IRON: Look = { wash: 0x2a2c31, line: 0.8 };
const STEEL: Look = { wash: 0x5c626c, line: 1.2 };
const POT_COLS = [0x9a5a3a, 0x8a4a30, 0x2f5f7a, 0x3c6a58, 0x6d6a66, 0xa8683e] as const;
const LEAF_COLS = [0x3f6a3e, 0x4f7a44, 0x355a3a, 0x5a8a4a, 0x2f5236] as const;
const FLOWER_COLS = [0xf2eee4, 0xe98aa8, 0xd9443a, 0xf0c86a] as const;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const UP = new Vector3(0, 1, 0);
const XP = new Vector3(1, 0, 0), XN = new Vector3(-1, 0, 0), ZP = new Vector3(0, 0, 1), ZN = new Vector3(0, 0, -1);
/** the plants' dark cores and the flowers (a low icosphere) */
const ICO0 = Array.from(new IcosahedronGeometry(1, 0).getAttribute('position').array);

// ── the visual step profile: two half-steps per collider tread ──

/** the drawn floor under x (the half-step tops; the landings; the top landing) — where people and props stand */
export function visFloor(x: number): number {
  for (const f of FLIGHTS) {
    if (x >= f.x0 && x < f.x1) {
      const j = Math.min(2 * f.steps - 1, Math.floor((x - f.x0) / (RUN / 2)));
      return f.y0 + (j + 1) * (RISE / 2);
    }
  }
  return stairFloor(x);
}

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
function shopGlass(ctx: Ctx, rng: Rng, at: Vector3, u: Vector3, n: Vector3, w: number, h: number, light: number, lit = 1, door = true): void {
  ctx.fd.windows.push({
    m: new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w, h, 1)).setPosition(at.clone().addScaledVector(n, 0.012)),
    win: new Vector4(rng.range(0, 97), lit, rng.chance(0.3) ? rng.range(0.1, 0.3) : 0, (door ? 16 : 0) + rng.int(0, 1)), wall: new Color(0x6d6a66), light: new Color(light),
  });
}

function mat4(x: number, y: number, z: number, yaw: number, s = 1): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(s, s, s));
}

const tint = (c: number, t: number): number => new Color(c).multiplyScalar(t).getHex();

// ── plants: real leaves (two-sided diamond quads, each ink-outlined like a gongbi leaf) round a dark core ──

/** one leaf from `base` along `dir` (unit), its blade spread along `side` (unit, ⟂ dir); both faces */
function leafQuad(k: Kit, base: Vector3, dir: Vector3, side: Vector3, L: number, W: number, look: Look): void {
  const mid = base.clone().addScaledVector(dir, L * 0.42);
  const a = base, c = base.clone().addScaledVector(dir, L);
  const b = mid.clone().addScaledVector(side, W / 2), d = mid.clone().addScaledVector(side, -W / 2);
  k.quad4(a, b, c, d, W, L, look);
  k.quad4(a, d, c, b, W, L, look);
}

const leafLook = (rng: Rng, lift: number): Look => ({ wash: tint(rng.pick(LEAF_COLS), rng.range(0.8, 1.1) * (0.82 + 0.35 * lift)), line: 0.55, wet: 0.35 });

/** a bush of `n` leaves round (cx, cy, cz), radius `r`: leaves fan out and up from a dark core */
function leafBush(k: Kit, rng: Rng, cx: number, cy: number, cz: number, r: number, n: number, phi: readonly [number, number] = [0.15, 1.25], narrow = 0.42): void {
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

/** a potted plant standing at (x, y, z), ~`s` m tall: 'bush' round, 'tall' upright blades, 'tree' a little trunk */
function pottedPlant(k: Kit, rng: Rng, x: number, y: number, z: number, s: number, form: 'bush' | 'tall' | 'tree' = 'bush', flowers = false): void {
  const potH = s * rng.range(0.26, 0.36), potR = s * rng.range(0.15, 0.2);
  const pot: Look = { wash: rng.pick(POT_COLS), line: 1, wet: 0.4, accent: true };
  k.cyl(x, y, z, potR * 0.78, potR, potH, 7, pot, { caps: false });
  k.cyl(x, y + potH - 0.02, z, potR * 1.08, potR * 1.08, 0.05, 7, pot);
  const top = y + potH;
  if (form === 'tree') {
    const th = s * 0.5;
    k.limb(new Vector3(x, top, z), new Vector3(x + rng.range(-0.08, 0.08), top + th, z + rng.range(-0.08, 0.08)), s * 0.035, s * 0.022, 5, { wash: 0x4a3526, line: 0 });
    leafBush(k, rng, x, top + th + s * 0.1, z, s * 0.34, 26);
    leafBush(k, rng, x + s * 0.16, top + th * 0.75, z + s * 0.08, s * 0.2, 12);
  } else if (form === 'tall') {
    leafBush(k, rng, x, top + s * 0.05, z, s * 0.62, 14, [0.95, 1.45], 0.2);
  } else {
    leafBush(k, rng, x, top + s * 0.14, z, s * 0.36, 22);
  }
  if (flowers) {
    const fc = rng.pick(FLOWER_COLS);
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, Math.PI * 2), r = s * rng.range(0.08, 0.24);
      k.blob(ICO0, null, x + Math.cos(a) * r, top + s * rng.range(0.2, 0.4), z + Math.sin(a) * r, s * 0.04, s * 0.03, s * 0.04, { wash: fc, line: 0, accent: true, emit: 0.05 });
    }
  }
}

// ── the steps: flights 2 and 3 as half-steps, the two landings, the top landing and the street past it ──

function steps(ctx: Ctx, rng: Rng): void {
  const { k } = terraceKit(ctx);
  const zc = (STAIR.z0 + STAIR.z1) / 2, w = STAIR.z1 - STAIR.z0;
  const hr = RISE / 2, hd = RUN / 2;
  for (const f of FLIGHTS.slice(1)) {
    for (let j = 0; j < 2 * f.steps; j++) {
      const x = f.x0 + j * hd, top = f.y0 + (j + 1) * hr;
      // each step is 2–4 long granite slabs laid across the stair, a shade apart, a few worn a little lower in the middle
      let z = STAIR.z0;
      while (z < STAIR.z1 - 0.05) {
        const len = Math.min(STAIR.z1 - z, rng.range(1.5, 3.2));
        const mid = Math.abs(z + len / 2 - zc) < 2.2;
        const sag = mid && rng.chance(0.35) ? rng.range(0.008, 0.025) : 0;
        const tone = rng.range(0.86, 1.1);
        k.box(x + hd / 2, top - hr - 0.22, z + len / 2, hd + 0.03, hr + 0.22 - sag, len - 0.025,
          { ...STEP_RISER, wash: tint(STEP_RISER.wash, tone) }, { top: { ...STEP_TOP, wash: tint(STEP_TOP.wash, tone) } });
        // the worn nosing: a narrow bevel that catches the sky (the mockup's bright step edges)
        const nx = x - 0.005, ny = top - sag;
        k.quad4(new Vector3(nx, ny - 0.06, z + len - 0.02), new Vector3(nx, ny - 0.06, z + 0.01), new Vector3(nx + 0.06, ny + 0.002, z + 0.01), new Vector3(nx + 0.06, ny + 0.002, z + len - 0.02),
          len - 0.03, 0.085, { ...NOSING, wash: tint(NOSING.wash, tone) });
        z += len;
      }
      // moss where the treads meet the walls
      for (const [ze, dz] of [[STAIR.z0, 1], [STAIR.z1, -1]] as const) {
        if (rng.chance(0.45)) k.quad(new Vector3(x + 0.02, top + 0.004, ze), XP, new Vector3(0, 0, dz), hd - 0.04, rng.range(0.08, 0.22), MOSS);
      }
    }
  }
  for (const l of LANDINGS) {
    k.box((l.x0 + l.x1) / 2, l.y - 0.6, zc, l.x1 - l.x0, 0.6, w, STEP_RISER, { top: { ...STEP_TOP, wet: 1 } });
    // a curb of long stones along the landing's edges (the top step of the flight below), a drain channel at the sides
    k.box(l.x0 + 0.2, l.y - 0.1, zc, 0.4, 0.12, w - 0.02, { ...COPING, wash: 0x5d5c60, wet: 0.9 });
    for (const zs of [STAIR.z0 + 0.12, STAIR.z1 - 0.12]) k.box((l.x0 + l.x1) / 2, l.y - 0.05, zs, l.x1 - l.x0 - 0.1, 0.06, 0.2, { wash: 0x2f3034, line: 1, wet: 1 });
    // fallen red petals and a few leaves on the wet stone
    for (let i = 0; i < 70; i++) {
      // drifted to the edges and the curb, where the water runs
      const edgeZ = rng.chance(0.5) ? STAIR.z0 + rng.range(0.1, 1.4) : STAIR.z1 - rng.range(0.1, 1.4);
      const px = rng.range(l.x0 + 0.1, l.x1 - 0.2), pz = rng.chance(0.65) ? edgeZ : rng.range(STAIR.z0 + 0.3, STAIR.z1 - 0.3);
      const a = rng.range(0, Math.PI * 2), L = rng.range(0.05, 0.09), W = L * 0.5;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a)), side = new Vector3(-Math.sin(a), 0, Math.cos(a));
      const b = new Vector3(px, l.y + 0.004, pz);
      const mid = b.clone().addScaledVector(dir, L * 0.5);
      k.quad4(b, mid.clone().addScaledVector(side, -W / 2), b.clone().addScaledVector(dir, L), mid.clone().addScaledVector(side, W / 2), W, L,
        { wash: rng.pick([0x9a2418, 0xb8352a, 0x7e1e1a, 0xc9523a]), line: 0, accent: true });
    }
  }
  // the top landing and the scenery street past it, one slab across the whole street
  k.box((STAIR.x1 + FAR_X) / 2, TOP_Y - 0.6, (FACE_N + FACE_S) / 2, FAR_X - STAIR.x1, 0.6, FACE_S - FACE_N, STEP_RISER, { top: STEP_TOP });
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
    // raised over the stair: the north terraces a storey-ish higher (the mockup's tea houses), the south lower
    const lift = s.xa > STAIR.x1 ? 0.15 : side > 0 ? rng.range(1.1, 1.6) : rng.range(0.55, 1.0);
    s.floor = stairFloor(Math.min(s.xb, FAR_X) - 0.01) + lift;
    const under = s.xa > 42 && s.xa < 114;
    s.top = under ? Math.min(Y0 + 50, s.floor + rng.range(22, 36)) : s.floor + rng.range(30, 50);
  }
  return out;
}

/** the retaining wall's face: ashlar blocks in running bond over the core, a coping, a pier at the segment's start */
function retainingWall(k: Kit, rng: Rng, s: Seg, edge: number, n: Vector3, pier: boolean): void {
  const course = 0.46, D = 0.16;
  const base = visFloor(s.xa + 0.01) - 0.25, topY = s.floor - 0.16;
  let c = 0;
  for (let y = base; y < topY - 0.05; y += course, c++) {
    const h = Math.min(course, topY - y);
    let x = s.xa + (c % 2 === 0 ? 0 : -0.45);
    while (x < s.xb - 0.05) {
      const bx0 = Math.max(x, s.xa), bx1 = Math.min(x + rng.range(0.75, 1.35), s.xb);
      x = bx1;
      if (bx1 - bx0 < 0.12 || y + h < visFloor(bx0) - 0.02) continue;
      const p = rng.range(0.0, 0.045);
      k.box((bx0 + bx1) / 2, y, edge + n.z * (p - D / 2), bx1 - bx0 - 0.02, h - 0.02, D, { ...ASHLAR, wash: tint(ASHLAR.wash, rng.range(0.82, 1.12)), seed: rng.range(0, 9) }, { top: null, bottom: null });
    }
  }
  // the coping: long capstones overhanging the face
  for (let x = s.xa; x < s.xb - 0.05;) {
    const x1 = Math.min(s.xb, x + rng.range(0.9, 1.5));
    k.box((x + x1) / 2, s.floor - 0.16, edge + n.z * 0.08 - n.z * 0.21, x1 - x - 0.015, 0.17, 0.42, { ...COPING, wash: tint(COPING.wash, rng.range(0.9, 1.08)) });
    x = x1;
  }
  if (pier) {
    const px = s.xa + 0.24, pz = edge + n.z * (0.1 - 0.25);
    k.box(px, base, pz, 0.48, s.floor + 1.05 - base, 0.5, { ...ASHLAR, wash: tint(ASHLAR.wash, 1.08) }, { top: null });
    k.box(px, s.floor + 1.05, pz, 0.62, 0.12, 0.64, COPING);
    k.box(px, s.floor + 1.17, pz, 0.34, 0.1, 0.36, COPING);
    // a fern spilling off the pier's cap beside the lamp
    leafBush(k, rng, px + 0.12, s.floor + 1.3, pz + n.z * 0.12, 0.22, 14, [-0.3, 0.8]);
    // a lamp on the pier: a short iron post and a glazed lantern box, warm (no light pool: as a ctx emitter it counts
    // as one of the square's sodium street lamps and washed the landings beige)
    k.box(px, s.floor + 1.27, pz, 0.07, 0.5, 0.07, IRON);
    k.box(px, s.floor + 1.77, pz, 0.24, 0.32, 0.24, { wash: 0xffd9a0, emit: 1.1, line: 1, accent: true }, { top: { ...IRON } });
    k.box(px, s.floor + 2.09, pz, 0.32, 0.06, 0.32, IRON);
  }
  // weep holes with their dark water stains, ferns in the joints
  for (let x = s.xa + rng.range(0.6, 1.4); x < s.xb - 0.3; x += rng.range(1.6, 2.6)) {
    const y = Math.max(visFloor(x) + 0.5, base + 0.4) + rng.range(0, 0.5);
    if (y > topY - 0.3) continue;
    k.box(x, y, edge + n.z * 0.06, 0.1, 0.1, 0.12, { wash: 0x1c1d20, line: 0.6 });
    k.quad(new Vector3(x - 0.07, visFloor(x) + 0.02, edge + n.z * 0.05), n.z > 0 ? XP : XN, UP, 0.14, y - visFloor(x) - 0.02, { wash: 0x3a3b3e, line: 0, wet: 1 }, 0);
  }
  if (rng.chance(0.55)) {
    const fx = rng.range(s.xa + 0.4, s.xb - 0.4), fy = rng.range(Math.max(visFloor(fx) + 0.3, base + 0.3), topY - 0.2);
    leafBush(k, rng, fx, fy, edge + n.z * 0.1, rng.range(0.12, 0.2), 9, [0.2, 1.0]);
  }
}

/** a shop at a terrace's level under its tower frontage: awning, a lit sign box, goods out front, a shopkeeper */
function shopFront(ctx: Ctx, k: Kit, rng: Rng, s: Seg, face: number, n: Vector3, u: Vector3): void {
  const len = s.xb - s.xa, cx = (s.xa + s.xb) / 2;
  piece(ctx, 'awning', new Vector3(cx, s.floor + 2.75, face), u, n, Math.min(len - 0.6, 3.6), 1, rng.range(1.1, 1.5), rng.pick([MIN.cinnabar, MIN.azurite, MIN.malachite, 0x8a6a3a]));
  piece(ctx, 'signBox', new Vector3(s.xa + (n.z > 0 ? 0.35 : len - 0.35), s.floor + 2.9, face), u, n, 1, 1, 1, rng.pick([0xff5a9a, 0x5ae0ff, 0x6affc0, 0xffc060]));
  // crates, baskets and sacks of goods by the door, a shelf of jars
  for (let j = 0; j < rng.int(2, 4); j++) {
    const gx = cx + rng.range(-len / 2 + 0.5, len / 2 - 0.5), gz = face + n.z * rng.range(0.35, 0.8), sz = rng.range(0.3, 0.5);
    k.box(gx, s.floor, gz, sz, rng.range(0.25, 0.5), sz, { wash: rng.pick([0x8a6a3a, 0x6d5236, 0x9a8a6a, 0x5a4632]), line: 1, surf: SURF.wood }, { rotY: rng.range(-0.3, 0.3) });
  }
  const shx = cx + rng.range(-0.5, 0.5);
  k.box(shx, s.floor + 0.9, face + n.z * 0.2, 1.2, 0.05, 0.3, { wash: 0x4a3526, line: 1 });
  for (let j = 0; j < 4; j++) k.cyl(shx - 0.45 + j * 0.3, s.floor + 0.95, face + n.z * 0.2, 0.08, 0.09, 0.2, 6, { wash: rng.pick([0x9a5a3a, 0x3c6a58, 0xc9a24a, 0x7a3a2a]), line: 1, accent: true });
  if (rng.chance(0.35)) ctx.walkers.push(mat4(cx + rng.range(-0.8, 0.8), s.floor, face + n.z * 0.9, n.z > 0 ? 0 : Math.PI, rng.range(0.95, 1.02)));
  ctx.emitters.push({ at: new Vector3(cx, s.floor + 1.4, face + n.z * 0.3), color: new Color(0xffc48a), w: len - 0.6, h: 2.4, power: 0.2, spill: 0.3 });
}

/** vines and ferns hanging over a coping: strands of leaves down the wall face, a leafy clump on the coping */
function vines(k: Kit, rng: Rng, x: number, y: number, face: number, n: Vector3): void {
  leafBush(k, rng, x, y + 0.12, face - n.z * 0.12, rng.range(0.22, 0.34), 16, [0.1, 0.9]);
  const m = rng.int(2, 4);
  for (let i = 0; i < m; i++) {
    let p = new Vector3(x + rng.range(-0.35, 0.35), y, face + n.z * 0.1);
    const len = rng.range(0.5, 1.4), nL = Math.round(len / 0.13);
    for (let j = 0; j < nL; j++) {
      const q = p.clone().add(new Vector3(Math.sin(j * 0.9 + i) * 0.03, -0.13, n.z * 0.004));
      // the stem: one flat strip facing the stair (2 tris)
      const w = n.z > 0 ? 0.008 : -0.008;
      k.quad4(new Vector3(p.x - w, p.y, p.z), new Vector3(p.x + w, p.y, p.z), new Vector3(q.x + w, q.y, q.z), new Vector3(q.x - w, q.y, q.z), 0.016, 0.13, { wash: 0x2f4a2a, line: 0 });
      const out = new Vector3(j % 2 === 0 ? 1 : -1, -0.5, n.z * 0.8).normalize();
      leafQuad(k, q, out, new Vector3().crossVectors(out, n).normalize(), rng.range(0.1, 0.17), 0.06, leafLook(rng, 0.2));
      p = q;
    }
  }
}

/** how far the towers along the stair stand back behind their low frontage */
const SETBACK = 3.4;

/** the frontage's glazed pent roof: from the set-back tower's face down over the parapet to an eave past the face */
function pentRoof(k: Kit, rng: Rng, s: Seg, face: number, n: Vector3, fTop: number): void {
  const tile = rng.pick([MIN.malachite, MIN.malachite, 0x3d6a58, MIN.azurite, 0x4a4e56]);
  const zB = face - n.z * SETBACK, zF = face + n.z * 0.85, yB = fTop + 2.4, yF = fTop + 0.55;
  const xa = s.xa - 0.12, xb = s.xb + 0.12, len = xb - xa, slope = Math.hypot(SETBACK + 0.85, yB - yF);
  const A = new Vector3(xa, yF, zF), B = new Vector3(xb, yF, zF), C = new Vector3(xb, yB, zB), D = new Vector3(xa, yB, zB);
  const look: Look = { wash: tile, kind: K.tiles, line: 1, accent: true };
  if (n.z > 0) k.quad4(A, B, C, D, len, slope, look);
  else k.quad4(B, A, D, C, len, slope, look);
  // the eave's lacquer fascia, the ridge against the tower, gable ends, upturned corners
  k.box((xa + xb) / 2, yF - 0.2, zF, len, 0.22, 0.1, { wash: MIN.lacquer, line: 1, accent: true });
  k.box((xa + xb) / 2, yB - 0.05, zB + n.z * 0.12, len, 0.2, 0.24, { wash: tint(tile, 0.8), line: 1, accent: true });
  for (const [x, dx] of [[xa, -1], [xb, 1]] as const) {
    const g = { wash: 0x6d6a66, line: 1 };
    if (n.z * dx > 0) k.tri(new Vector3(x, yF, zF), new Vector3(x, yB, zB), new Vector3(x, yF, zB), g);
    else k.tri(new Vector3(x, yF, zF), new Vector3(x, yF, zB), new Vector3(x, yB, zB), g);
    k.beam(new Vector3(x, yF - 0.05, zF), new Vector3(x + dx * 0.3, yF + 0.32, zF + n.z * 0.18), 0.09, 0.09, { wash: tile, line: 1, accent: true });
  }
}

/**
 * A tea terrace's timber veranda (the mockup's tea house): red lacquer posts along the rail, a glazed pent roof from
 * the tower's face out over the rail, a lattice frieze under its eave, lanterns, now and then a 茶 cloth banner.
 */
function veranda(ctx: Ctx, k: Kit, s: Seg, face: number, edge: number, side: number, rng: Rng, banner: boolean): void {
  const len = s.xb - s.xa, cx = (s.xa + s.xb) / 2;
  const yIn = s.floor + 3.95, yOut = s.floor + 3.0;
  const zIn = face + side * 0.05, zOut = edge + side * 0.35;
  const xa = s.xa + 0.05, xb = s.xb - 0.05;
  const tile = rng.chance(0.7) ? MIN.malachite : MIN.azurite;
  const a = new Vector3(xa, yOut, zOut), b = new Vector3(xb, yOut, zOut), c = new Vector3(xb, yIn, zIn), d = new Vector3(xa, yIn, zIn);
  if (side > 0) k.quad4(a, b, c, d, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  else k.quad4(b, a, d, c, len - 0.1, Math.hypot(yIn - yOut, zOut - zIn), { wash: tile, kind: K.tiles, line: 1, accent: true });
  // the fascia board along the eave (dark timber, a lacquer line), the row of round tile ends (瓦當) along its edge,
  // upturned end tiles at the corners
  k.box(cx, yOut - 0.2, zOut, len - 0.05, 0.2, 0.08, TIMBER);
  k.box(cx, yOut - 0.22, zOut + side * 0.045, len - 0.05, 0.04, 0.02, { wash: MIN.lacquer, line: 0, accent: true });
  for (let x = xa + 0.1; x < xb - 0.05; x += 0.22) k.blob(ICO0, null, x, yOut - 0.01, zOut + side * 0.05, 0.075, 0.075, 0.03, { wash: tint(tile, 0.75), line: 0, accent: true });
  for (const ex of [xa, xb]) k.beam(new Vector3(ex, yOut - 0.05, zOut), new Vector3(ex + (ex === xa ? -0.25 : 0.25), yOut + 0.28, zOut + side * 0.15), 0.08, 0.08, { wash: tile, line: 1, accent: true });
  const rz = edge - side * 0.2;
  const nPost = Math.max(2, Math.round(len / 2.2) + 1);
  for (let j = 0; j < nPost; j++) {
    const px = xa + 0.1 + ((xb - xa - 0.2) * j) / (nPost - 1);
    k.box(px, s.floor, rz, 0.17, yOut - s.floor + 0.15, 0.17, TIMBER);
    k.box(px, s.floor, rz, 0.24, 0.12, 0.24, { ...COPING, wash: 0x6d6a66 });
    // a bracket (雀替) under the eave at every post
    k.beam(new Vector3(px - 0.35, yOut - 0.22, rz), new Vector3(px, yOut - 0.62, rz), 0.07, 0.07, LACQUER);
    k.beam(new Vector3(px + 0.35, yOut - 0.22, rz), new Vector3(px, yOut - 0.62, rz), 0.07, 0.07, LACQUER);
  }
  // the eave's underside: rafters from the wall out to the fascia, a purlin across them (the view from the stair)
  for (let x = xa + 0.2; x < xb - 0.1; x += 0.42) k.beam(new Vector3(x, yIn - 0.12, zIn), new Vector3(x, yOut - 0.1, zOut - side * 0.04), 0.06, 0.08, TIMBER);
  k.beam(new Vector3(xa, (yIn + yOut) / 2 - 0.16, (zIn + zOut) / 2), new Vector3(xb, (yIn + yOut) / 2 - 0.16, (zIn + zOut) / 2), 0.1, 0.12, TIMBER);
  const u = side > 0 ? XP : XN;
  lattice(k, new Vector3(side > 0 ? xa : xb, yOut - 0.62, rz + side * 0.09), u, len - 0.1, 0.42, 0.16, 0.14, { wash: 0x5a2a1c, line: 0.5, accent: true });
  const nl = Math.max(1, Math.round(len / 2.4));
  for (let j = 0; j < nl; j++) ctx.lantern(xa + (j + 0.5) * (len - 0.1) / nl, yOut - 0.3, rz - side * 0.1, 0.72);
  if (banner || rng.chance(0.6)) {
    const bx = xa + 0.25;
    const size = banner ? 0.78 : 0.55;
    k.beam(new Vector3(bx, yOut - 0.2, rz - side * 0.05), new Vector3(bx, yOut - 0.2, rz + side * 0.62), 0.05, 0.05, IRON);
    ctx.signs.place({ at: new Vector3(bx, yOut - 0.35 - size * 1.1, rz + side * 0.4), normal: XN, size, spec: { text: '茶', color: '#1a1614', vertical: true, style: 'banner', ink: '#e8e0cc' }, blade: true }, k);
  }
  // the tea room behind: lit lattice doors across the tower's face (the grammar's own shopfront is taken off first)
  const nb = Math.max(1, Math.round(len / 1.6)), bw = (len - 0.3) / nb;
  const n = side > 0 ? ZP : ZN;
  for (let j = 0; j < nb; j++) {
    const bc = s.xa + 0.15 + (j + 0.5) * bw;
    shopGlass(ctx, rng, new Vector3(bc, s.floor + 0.05, face + side * 0.05), u, n, bw - 0.2, 2.5, rng.pick([0xffc47e, 0xffb870, 0xffd09a]), rng.range(1.25, 1.4));
    lattice(k, new Vector3(bc - (bw - 0.2) / 2 * u.x, s.floor + 0.05, face + side * 0.1), u, bw - 0.2, 2.5, 0.2, 0.42, { wash: 0x3d1d12, line: 0.5, accent: true });
    k.box(bc - (bw / 2) * u.x, s.floor, face + side * 0.1, 0.14, 2.7, 0.14, { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood });
  }
  k.box(cx, s.floor + 2.55, face + side * 0.1, len - 0.2, 0.2, 0.18, { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood });
  // warm light from the tea room onto the terrace
  ctx.emitters.push({ at: new Vector3(cx, s.floor + 1.5, face + side * 0.4), color: new Color(0xffc48a), w: len - 0.4, h: 2.4, power: 0.2, spill: 0.3 });
}

/** take the facade grammar's dressing (pieces, windows, sign slots) off a box: an overlay replaces it there */
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
  // a sign slot is shrunk to nothing, never removed: build.ts fills the slots in order from one rng, so a removed slot
  // would change the word and style of every sign after it (the whole Well's)
  for (const sl of ctx.fd.signs) if (inside(sl.at)) sl.size = 0.001;
}

const WORDS_HERE = ['麵', '茶', '牙科', '火鍋', '旅館', '藥房', '涼茶', '小面', '抄手', '豆花', '麻辣烫', '串串香', '酸辣粉', '賓館', '按摩', '中醫', '跌打', '五金'] as const;
const NEONS = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber, 0xff7a2a] as const;

/** a kit with other kits folded into its geometry at build (the paifang's transformed kits): one draw for all */
class FoldKit extends Kit {
  readonly extra: Kit[] = [];
  // (build.ts builds a kit only when it has vertices: count the folded ones too)
  override get vertexCount(): number { return this.extra.reduce((n, e) => n + e.vertexCount, super.vertexCount); }
  override build(): BufferGeometry {
    const own = super.vertexCount > 0 ? [super.build()] : [];
    const parts = [...own, ...this.extra.filter((e) => e.vertexCount > 0).map((e) => e.build())];
    return parts.length === 1 ? parts[0] ?? super.build() : merge(parts);
  }
}
class FoldKitX extends KitX {
  readonly extra: KitX[] = [];
  override get vertexCount(): number { return this.extra.reduce((n, e) => n + e.vertexCount, super.vertexCount); }
  override build(): BufferGeometry {
    const own = super.vertexCount > 0 ? [super.build()] : [];
    const parts = [...own, ...this.extra.filter((e) => e.vertexCount > 0).map((e) => e.build())];
    return parts.length === 1 ? parts[0] ?? super.build() : merge(parts);
  }
}

/** dome C2's ONE kit: the steps, the terraces, the strings and bridges, the signs' boards, the far end and the paifang
 *  folded in — one draw (the lane's cap is 12); not drawn from > 110 m (deep in the Well) */
const KIT = 'stair-terraces';
function terraceKit(ctx: Ctx): { k: FoldKit; kx: FoldKitX } {
  const k0 = ctx.kits.get(KIT), kx0 = ctx.kitxs.get(KIT);
  const k = k0 instanceof FoldKit ? k0 : new FoldKit();
  const kx = kx0 instanceof FoldKitX ? kx0 : new FoldKitX();
  if (k !== k0) { ctx.kits.set(KIT, k); ctx.reflective.add(KIT); ctx.far(KIT, 110); }
  if (kx !== kx0) ctx.kitxs.set(KIT, kx);
  return { k, kx };
}

/** real flat bars (one quad each, facing u × up): from p0 along u for len, h tall, every pitch — the alpha kit's
 *  dithered bar cards cost a draw of their own */
function barRow(k: Kit, p0: Vector3, u: Vector3, len: number, h: number, pitch: number, look: Look, t = 0.03): void {
  const count = Math.max(1, Math.round(len / pitch));
  for (let i = 1; i < count; i++) k.quad(p0.clone().addScaledVector(u, (i / count) * len - t / 2), u, UP, t, h, look);
}

/** a lattice panel of real bars: verticals every `pitch`, rails every `rows` m */
function lattice(k: Kit, p0: Vector3, u: Vector3, len: number, h: number, pitch: number, rows: number, look: Look): void {
  barRow(k, p0, u, len, h, pitch, look, 0.035);
  for (let y = 0; y <= h + 0.001; y += rows) k.quad(p0.clone().add(new Vector3(0, Math.min(y, h - 0.035), 0)), u, UP, len, 0.035, look);
}

function terraces(ctx: Ctx, rng: Rng): void {
  for (const side of [1, -1] as const) {
    // north (side 1): the face at FACE_N facing +z, the terrace from it to the stair's edge; south mirrored
    const face = side > 0 ? FACE_N : FACE_S, edge = side > 0 ? STAIR.z0 : STAIR.z1;
    const n = side > 0 ? ZP : ZN, u = side > 0 ? XP : XN;
    const segs = segments(rng, side);
    const fronts: number[] = [];
    segs.forEach((s, i) => {
      const cx = (s.xa + s.xb) / 2, len = s.xb - s.xa;
      const { k, kx } = terraceKit(ctx);
      const onStair = s.xa < STAIR.x1;
      const below = Math.min(visFloor(s.xa + 0.01), s.floor) - 1.5;
      // the plinth (its core; the ashlar skin is its face on the stair), its top the terrace
      k.box(cx, below, (face + edge) / 2, len, s.floor - below, Math.abs(edge - face), PLINTH, { top: TERRACE });
      if (onStair) retainingWall(k, rng, s, edge, n, i % 2 === 0);
      else k.box(cx, s.floor - 0.1, edge - side * 0.15, len + 0.02, 0.14, 0.32, COPING);
      // what stands on it: along the stair a low frontage (2–3 storeys, shops at the terrace's level) under a glazed
      // pent roof, the tower set back behind it (the mockup's tea houses under the towers, the canyon opening upward);
      // past the top, the tower on the street as before
      const prev = segs[i - 1];
      const downhill = side > 0 ? 8 : 4;
      const p0 = new Vector3(side > 0 ? s.xa : s.xb, 0, face);
      if (onStair) {
        const fTop = s.floor + (i % 3 === 1 ? 9 : 6) + 0.2;
        fronts.push(fTop);
        const prevFront = fronts[fronts.length - 2];
        dressWall(ctx.fd, p0, n, len, s.floor, fTop, Math.floor(rng.next() * 1e6), {
          shops: true, street: s.floor, detailY: [s.floor - 1, fTop + 1], timber: 0.6, density: 0.8, lit: 0.8, lod: 0, roof: false, setbacks: false,
        }, SETBACK, 1 + (prevFront !== undefined && prevFront < fTop - 1 ? downhill : 0));
        pentRoof(k, rng, s, face, n, fTop);
        dressWall(ctx.fd, p0.clone().addScaledVector(n, -SETBACK), n, len, fTop + 0.9, s.top, Math.floor(rng.next() * 1e6), {
          shops: false, street: s.floor, detailY: [fTop, fTop + 12], timber: 0.3, lit: 0.75, lod: 1, density: 0.55, roof: true, setbacks: s.top - fTop > 24,
        }, 12 - SETBACK, 1 + (prev !== undefined && prev.top < s.top - 3 ? downhill : 0));
      } else {
        dressWall(ctx.fd, p0, n, len, s.floor, s.top, Math.floor(rng.next() * 1e6), {
          shops: true, street: s.floor, detailY: [s.floor - 1, s.floor + 10], timber: 0.4, lit: 0.75, lod: 2, roof: true, setbacks: s.top - s.floor > 30,
        }, 12, 1 + (prev !== undefined && prev.top < s.top - 3 ? downhill : 0));
      }
      // what stands on the terrace: a balustrade (red timber or iron), potted plants in rows, a tea veranda with
      // drinkers or people at the rail, a lantern post
      // the north side of flight 2 is a run of tea verandas (view 5's left, the mockup's tea house on up the stair)
      const tea = onStair && ((side > 0 && s.xa < 53) || i % 3 === (side > 0 ? 0 : 1) || rng.chance(0.25));
      const rz = edge - side * 0.2;
      const timberRail = tea || rng.chance(0.5);
      const railLook: Look = timberRail ? { wash: 0x6a2418, line: 0.5, accent: true } : { wash: 0x2a2c31, line: 0.5 };
      barRow(k, new Vector3(side > 0 ? s.xa + 0.1 : s.xb - 0.1, s.floor + 0.08, rz + side * 0.05), u, len - 0.2, 0.92, timberRail ? 0.13 : 0.15, railLook);
      k.box(cx, s.floor + 1.0, rz, len - 0.1, 0.07, 0.1, timberRail ? LACQUER : IRON);
      k.box(cx, s.floor + 0.02, rz, len - 0.1, 0.07, 0.1, timberRail ? LACQUER : IRON);
      const np = Math.max(1, Math.round(len / 1.4));
      for (let j = 0; j <= np; j++) k.box(Math.min(s.xa + 0.1 + (j * (len - 0.2)) / np, s.xb - 0.05), s.floor, rz, 0.09, 1.1, 0.09, timberRail ? LACQUER : IRON);
      // the plants: a row of pots along the inside of the rail, some over the coping, now and then a little tree
      const nPots = onStair ? rng.int(2, 4) : rng.int(1, 2);
      for (let j = 0; j < nPots; j++) {
        const px = s.xa + len * ((j + rng.range(0.25, 0.75)) / nPots);
        const form = rng.chance(0.18) ? 'tree' : rng.chance(0.3) ? 'tall' : 'bush';
        pottedPlant(k, rng, px, s.floor, rz - side * rng.range(0.35, 0.6), rng.range(0.8, 1.35) * (form === 'tree' ? 1.5 : 1), form, rng.chance(0.4));
      }
      if (onStair) {
        const nv = rng.int(2, 3);
        for (let j = 0; j < nv; j++) vines(k, rng, s.xa + len * rng.range(0.15, 0.85), s.floor - 0.1, edge, n);
      }
      if (tea && len > 3.2) {
        const tx = cx + rng.range(-0.5, 0.5), tz = (face + edge) / 2 + side * 0.1, tr = rng.range(-0.3, 0.3);
        mahjong(k, kx, rng, tx, s.floor, tz, tr, 0, rng.pick([0xb8352a, 0x2f5f9a, 0x3c7a5a]), false);
        clearBand(ctx, s.xa - 0.05, s.xb + 0.05, Math.min(face, edge) - 0.6, Math.max(face, edge) + 0.6, s.floor - 0.3, s.floor + 3.3);
        veranda(ctx, k, s, face, edge, side, new Rng(900 + i * 7 + side * 50), s.xa < (LANDINGS[0]?.x1 ?? 40));
        // tea drinkers standing at the rail, looking down onto the stair (the mockup's)
        const m = rng.int(1, 2);
        for (let j = 0; j < m; j++) ctx.walkers.push(mat4(s.xa + len * ((j + rng.range(0.25, 0.75)) / m), s.floor, rz - side * 0.42, side > 0 ? rng.range(-0.35, 0.35) : Math.PI + rng.range(-0.35, 0.35), rng.range(0.95, 1.03)));
      } else {
        // a shop at the terrace's level: an awning over its door, a lit sign box, goods stacked out front; now and then
        // somebody at the rail
        if (onStair) shopFront(ctx, k, rng, s, face, n, u);
        if (rng.chance(0.25)) ctx.walkers.push(mat4(s.xa + len * rng.range(0.2, 0.8), s.floor, rz - side * 0.45, side > 0 ? rng.range(-0.4, 0.4) : Math.PI + rng.range(-0.4, 0.4), rng.range(0.95, 1.03)));
      }
      if ((!onStair || i % 2 === 1) && rng.chance(0.4)) {
        const lx = side > 0 ? s.xa + 0.3 : s.xb - 0.3;
        k.beam(new Vector3(lx, s.floor, rz - side * 0.1), new Vector3(lx, s.floor + 2.6, rz - side * 0.1), 0.08, 0.08, IRON);
        k.beam(new Vector3(lx, s.floor + 2.6, rz - side * 0.1), new Vector3(lx, s.floor + 2.6, rz + side * 0.5), 0.06, 0.06, IRON);
        ctx.lantern(lx, s.floor + 2.55, rz + side * 0.45, 0.66);
      }
      // air-con units and a lit sign box on the tower's first floor over the terrace
      if (rng.chance(0.6)) piece(ctx, 'acUnit', new Vector3(s.xa + len * rng.range(0.2, 0.8), s.floor + rng.range(3.4, 4.2), face), u, n, 1, 1, 1, 0xe6e4df);
    });
  }
  // stone planters against the landings' walls, in flower (their boxes are stairUpperColliders())
  for (const p of landingPlanters()) {
    const { k } = terraceKit(ctx);
    k.box(p.x, p.y, p.z, p.w, 0.5, p.d, { ...ASHLAR, wash: 0x6f6d68 }, { top: { wash: 0x2e2a24, line: 0 } });
    k.box(p.x, p.y + 0.5, p.z, p.w + 0.08, 0.07, p.d + 0.08, COPING);
    for (let j = 0; j < 3; j++) leafBush(k, rng, p.x + (j - 1) * p.w * 0.3, p.y + 0.62, p.z, rng.range(0.26, 0.36), 26);
    const fc = rng.pick(FLOWER_COLS);
    for (let j = 0; j < 9; j++) k.blob(ICO0, null, p.x + rng.range(-p.w / 2, p.w / 2) * 0.85, p.y + rng.range(0.75, 0.95), p.z + rng.range(-0.12, 0.12), 0.035, 0.028, 0.035, { wash: fc, line: 0, accent: true, emit: 0.05 });
  }
}

/** the stone planters on the landings, against the side walls: bottom-centre x, y, z, width (along x), depth (z) */
function landingPlanters(): { x: number; y: number; z: number; w: number; d: number }[] {
  const out: { x: number; y: number; z: number; w: number; d: number }[] = [];
  for (const l of LANDINGS) {
    for (const [ze, dz] of [[STAIR.z0, 1], [STAIR.z1, -1]] as const) {
      for (const t of [0.22, 0.78]) out.push({ x: l.x0 + (l.x1 - l.x0) * t, y: l.y, z: ze + dz * 0.26, w: 1.1, d: 0.5 });
    }
  }
  return out;
}

/** dome C2's walkable-area props for the physics (colliders.ts): the landings' planters as boxes */
export function stairUpperColliders(): ColliderDesc[] {
  return landingPlanters().map((p) => ({ kind: 'box', x: p.x, y: p.y + 0.29, z: p.z, hx: p.w / 2 + 0.04, hy: 0.29, hz: p.d / 2 + 0.04, surface: 'stone' }));
}

// ── the paifang on the second landing (dome B's gate, turned to span the stair) ──

function stairGate(ctx: Ctx): void {
  const G = STAIR_GATE;
  const xf = new Matrix4().makeTranslation(G.x, G.y, G.z).multiply(new Matrix4().makeRotationY(-Math.PI / 2));
  // built in its own frame, then folded into C2's one kit (no draw of its own)
  const k = new XfKit(xf), x = new XfKitX(xf);
  const fold = terraceKit(ctx);
  fold.k.extra.push(k);
  fold.kx.extra.push(x);
  const xs = new XfSigns(ctx.signs, xf);
  const p = new Vector3();
  // its lanterns hang smaller than the square gate's: this gate is lower (s 1.3), and seven full-size lantern pools
  // washed the landing salmon (render round 14 made the lantern pools ×1.7)
  buildGate(k, x, xs, (lx, ly, lz, s) => { p.set(lx, ly, lz).applyMatrix4(xf); ctx.lantern(p.x, p.y, p.z, s * 0.72); }, {
    x: 0, y: 0, z: 0, posts: G.posts, s: G.s, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false,
  });
}

// ── over the street: lantern strings, cables, the skybridge, the high bridge, the monorail ──

function lanternString(ctx: Ctx, k: Kit, a: Vector3, b: Vector3, spacing: number, sag: number, s = 0.72): void {
  const len = a.distanceTo(b);
  const nSeg = Math.max(2, Math.round(len / spacing));
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < nSeg; i++) k.beam(at(i / nSeg), at((i + 1) / nSeg), 0.025, 0.025, IRON);
  for (let i = 1; i < nSeg; i++) { const q = at(i / nSeg); ctx.lantern(q.x, q.y, q.z, s); }
}

/**
 * A footbridge across the street between the set-back towers' faces, open to the sky as mockup C's are (a roof's
 * underside read as a ceiling from the square): a thin deck on two girders and a truss, open balustrades with people at
 * the west rail looking down the stair, long red banners off the west face, lamps along the soffit.
 */
function bridge(ctx: Ctx, k: Kit, rng: Rng, bx: number, by: number, bw: number, banners: readonly string[], people: number, underLanterns: boolean): void {
  const z0 = FACE_N - SETBACK, z1 = FACE_S + SETBACK, zc = (z0 + z1) / 2, L = z1 - z0;
  k.box(bx, by - 0.28, zc, bw, 0.28, L, { wash: 0x5f656e, line: 1.5 }, { top: { wash: 0x5d5f63, kind: K.flag, wet: 0.8, line: 1 }, bottom: { wash: 0x33363c, line: 1 } });
  if (underLanterns) lanternString(ctx, k, new Vector3(bx, by - 0.6, z0 + 2.4), new Vector3(bx, by - 0.6, z1 - 2.4), 2.6, 0.5, 0.55);
  for (const sx of [-1, 1]) {
    const ex = bx + sx * (bw / 2);
    k.box(ex, by - 0.85, zc, 0.2, 0.6, L, { wash: 0x3a3d44, line: 1.2 });
    // a band of warm lamps along the girder's face (reads against the haze from the square)
    ctx.signs.light(new Vector3(ex + sx * 0.12, by - 0.55, zc), sx > 0 ? ZP : ZN, UP, L - 2, 0.12, 0xffc98a, 1.6);
    k.box(ex + sx * 0.03, by - 0.26, zc, 0.05, 0.24, L, { wash: MIN.lacquer, line: 1, accent: true });
    for (let z = z0; z < z1 - 0.1; z += 1.8) k.beam(new Vector3(ex, by - 0.85, z), new Vector3(ex, by - 0.3, z + 0.9), 0.07, 0.07, STEEL);
    // the open balustrade: a low curb, bars, a lacquer top rail, posts
    k.box(ex, by, zc, 0.16, 0.22, L, { wash: 0x80868f, kind: K.panel, line: 1.2 });
    // (both rows face west, down the stair: the only side they are seen from)
    barRow(k, new Vector3(ex - 0.03, by + 0.22, z0), ZP, L, 0.85, 0.16, { wash: 0x2a2c31, line: 0.5 });
    k.box(ex, by + 1.07, zc, 0.12, 0.08, L, { ...LACQUER });
    for (let z = z0; z <= z1 + 0.01; z += 2.0) k.box(ex, by, z, 0.1, 1.12, 0.1, IRON);
    ctx.signs.light(new Vector3(ex + sx * 0.12, by - 0.6, zc), sx > 0 ? ZP : ZN, UP, L - 1, 0.08, 0xffd9a0, 1.2);
  }
  // people crossing and at the west rail (looking down the stair)
  for (let i = 0; i < people; i++) {
    const atRail = i % 3 !== 2;
    const px = atRail ? bx - bw / 2 + 0.4 : bx + rng.range(-bw / 2 + 0.6, bw / 2 - 0.6);
    ctx.walkers.push(mat4(px, by, zc + rng.range(-6, 6), atRail ? -Math.PI / 2 + rng.range(-0.3, 0.3) : rng.chance(0.5) ? 0 : Math.PI, rng.range(0.95, 1.03)));
  }
  // long red banners hung off the west face (the mockup's), gold letters
  const size = banners.length > 2 ? 0.72 : 0.55;
  banners.forEach((text, i) => {
    const z = zc + (i - (banners.length - 1) / 2) * 3.0;
    const h = size * (Array.from(text).length + 0.62);
    const bz = bx - bw / 2 - 0.14;
    ctx.signs.place({ at: new Vector3(bz, by - 0.5 - h / 2, z), normal: XN, size, spec: { text, color: '#e8c46a', vertical: true, style: 'banner', ink: '#8a1e14' } }, k);
    k.beam(new Vector3(bz - 0.02, by - 0.32, z - size * 0.6), new Vector3(bz - 0.02, by - 0.32, z + size * 0.6), 0.04, 0.04, IRON);
  });
  // where it meets the towers: raking struts under the deck
  for (const [z, dz] of [[z0, 1], [z1, -1]] as const) for (const sx of [-1, 1]) k.beam(new Vector3(bx + sx * (bw / 2 - 0.2), by - 3.0, z), new Vector3(bx + sx * (bw / 2 - 0.2), by - 0.9, z + dz * 2.0), 0.15, 0.15, STEEL);
}

function overhead(ctx: Ctx, rng: Rng): void {
  const { k } = terraceKit(ctx);
  // two strings of red lanterns across, high (+9 m) and staggered: from the square (mockup C) they frame the paifang
  // instead of veiling it; the low dense strings made a ceiling over the canyon
  for (const [x, dy, dx] of [[43.5, 9.5, 1.4], [62.5, 8.5, -1.2]] as const) {
    const y = stairFloor(x) + dy;
    lanternString(ctx, k, new Vector3(x - dx, y, FACE_N + 0.3), new Vector3(x + dx, y - 0.5, FACE_S - 0.3), 1.8, 1.1);
  }
  // cables and laundry strung between the towers higher up (the facade grammar's spans)
  for (let x = 36; x < FAR_X - 4; x += rng.range(2.6, 5)) {
    const ya = stairFloor(x) + rng.range(9, 22);
    spanStreet(ctx.fd, new Vector3(x, ya, FACE_N + 0.6), new Vector3(x + rng.range(-1.5, 1.5), ya + rng.range(-1.5, 1.5), FACE_S - 0.6), Math.floor(rng.next() * 1e6));
  }
  // layered in depth as mockup C has them (from its camera, frame fractions from the top): the monorail's lit train
  // (~20 %), the skybridge with its people and banners (~23 %), the paifang's roof (~32 %); both clear of the aerial
  // cameras over flight 2 and, from landing 1, above the paifang. (A third, far bridge under the sky screen read as a
  // ceiling from the square: dropped, round B.)
  bridge(ctx, k, rng, 67.2, TOP_Y + 20, 2.6, ['九龍', '萬家燈火', '天下一家', '九龍城'], 7, true);
  // the monorail: a box-girder track across the street slung from the deck overhead, a train standing on it
  const mx = 60, my = Y0 + 44;
  k.box(mx, my - 1.2, (FACE_N + FACE_S) / 2, 1.4, 1.2, 150, { wash: 0x7e8591, kind: K.panel, line: 1.5 });
  k.box(mx, my - 1.45, (FACE_N + FACE_S) / 2, 2.2, 0.25, 150, { wash: 0x5c626c, line: 1.2 });
  for (let z = -60; z <= 70; z += 13) {
    k.beam(new Vector3(mx, my - 0.1, z), new Vector3(mx - 2, Y0 + 50, z - 2), 0.14, 0.14, IRON);
    k.beam(new Vector3(mx, my - 0.1, z), new Vector3(mx + 2, Y0 + 50, z + 2), 0.14, 0.14, IRON);
  }
  for (let i = 0; i < 3; i++) {
    const z = -8 + i * 13.6;
    k.box(mx, my - 4.1, z, 2.7, 2.9, 13, { wash: 0x6a717c, line: 1.2 }, { top: { wash: 0x565c66, line: 1 } });
    k.box(mx, my - 3.1, z, 2.74, 0.9, 12.2, { wash: 0xffd9a0, emit: 0.9, kind: K.facade, row: 0.9, col: 1.4, seed: 17 + i, line: 1, accent: true });
    k.box(mx, my - 4.05, z, 2.76, 0.28, 13.02, { wash: 0xc23b22, line: 1, accent: true });
    k.box(mx, my - 1.2, z, 1.4, 0.6, 2.2, { wash: 0x5c626c, line: 1 });
  }
}

// ── the signs: the mockup's hero stack on the right (旅館 · 火鍋 · 牙科), blade signs up both sides ──

function stairSigns(ctx: Ctx, rng: Rng): void {
  const { k } = terraceKit(ctx);
  const bracket = (x: number, y: number, zWall: number, zOut: number): void => {
    k.beam(new Vector3(x, y, zWall), new Vector3(x, y, zOut), 0.1, 0.12, IRON);
    k.beam(new Vector3(x, y - 1.1, zWall), new Vector3(x, y - 0.05, zWall + (zOut - zWall) * 0.6), 0.06, 0.06, IRON);
  };
  // [text, colour, x, y above the stair's floor there, side (1 north / -1 south), size]
  const hero: [string, number, number, number, number, number][] = [
    ['賓館', NEON.jade, 45.8, 3.7, -1, 1.2],
    ['藥房', NEON.red, 47.8, 6.4, -1, 1.15],
    ['涼茶', NEON.cyan, 49.8, 9.1, -1, 1.1],
    ['中醫', NEON.amber, 44.5, 7.8, 1, 1.05],
    ['豆花', NEON.jade, 58.5, 7.4, 1, 1.0],
    ['按摩', NEON.magenta, 63.5, 8.2, -1, 1.1],
  ];
  for (const [text, col, x, dy, side, size] of hero) {
    const wall = side > 0 ? FACE_N : FACE_S;
    const w = size * 1.36;
    // the hero stack on the right hangs out to the stair's edge on long brackets (all of it > 4 m over the steps)
    const z = x > 45 && x < 50 ? STAIR.z1 + 0.45 : wall + side * (0.5 + w / 2);
    const nch = Array.from(text).length;
    const h = size * (nch + 0.62);
    const y = stairFloor(x) + dy;
    ctx.signs.place({ at: new Vector3(x, y, z), normal: XN, size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, k);
    bracket(x, y + h / 2 + 0.3, wall, z + side * (w / 2 + 0.2));
    k.box(x, y + h / 2 + 0.05, z, 0.06, 0.3, 0.06, IRON);
    // a lantern on the bracket's end
    ctx.lantern(x, y + h / 2 + 0.25, z + side * (w / 2 + 0.1), 0.55);
  }
  // mockup C's column on the right (牙科 · 火鍋 · 旅館, top to bottom): from the square's camera it has to hang near the
  // foot, over the south stair edge in dome C1's range (x 27.1–28.6 kept clear for it by dome D): one mast on a bracket
  // from the terrace's wall at Y0 + 12.5 (under the pavilion's eave, clear of the striped awning at x 29–31), the three
  // blades hung down it, the lowest 2.35 m over the steps
  {
    const cx = 28, cz = STAIR.z1 - 0.7, size = 0.82, w = size * 1.36, h = size * 2.62, top = Y0 + 12.5;
    const col: [string, number][] = [['牙科', NEON.cyan], ['火鍋', NEON.red], ['旅館', NEON.jade]];
    col.forEach(([text, c], i) => {
      const y = top - 0.15 - h / 2 - i * (h + 0.2);
      ctx.signs.place({ at: new Vector3(cx, y, cz), normal: XN, size, spec: { text, color: hex(c), vertical: true, style: 'tube' }, blade: true }, k);
    });
    const mz = cz + w / 2 + 0.07, bottom = top - 0.15 - 3 * h - 0.4;
    k.beam(new Vector3(cx, bottom, mz), new Vector3(cx, top, mz), 0.08, 0.08, IRON);
    k.beam(new Vector3(cx, top, FACE_S), new Vector3(cx, top, cz - w / 2 - 0.1), 0.1, 0.12, IRON);
    k.beam(new Vector3(cx, top - 1.3, FACE_S), new Vector3(cx, top - 0.05, FACE_S - 2.2), 0.07, 0.07, IRON);
  }
  dragonHook(k, ctx, new Vector3(61.2, stairFloor(61.2) + 5.6, FACE_S), new Vector3(-0.5, 0, -1), 1.3);
  // blade signs up both sides, reading down the stair
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = 36 + (i / 18) * 62 + rng.range(-1.2, 1.2);
    const wall = side > 0 ? FACE_N : FACE_S;
    const size = rng.range(0.7, 1.05);
    const w = size * 1.36;
    const y = stairFloor(x) + rng.range(10, 17);
    const text = rng.pick(WORDS_HERE);
    ctx.signs.place({ at: new Vector3(x, y, wall + side * (0.6 + w / 2)), normal: XN, size, spec: { text, color: hex(rng.pick(NEONS)), vertical: true, style: rng.chance(0.75) ? 'tube' : 'box' }, blade: true, flicker: rng.chance(0.08) ? rng.next() : 0 }, k);
    const h = size * (Array.from(text).length + 0.62);
    k.beam(new Vector3(x, y + h / 2 + 0.25, wall), new Vector3(x, y + h / 2 + 0.25, wall + side * (w + 0.8)), 0.08, 0.08, IRON);
  }
}

// ── the crowd on the upper steps: umbrellas going up and coming down, thinning toward the top ──

function crowd(ctx: Ctx, rng: Rng): void {
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const placed: [number, number][] = [];
  let n = 0;
  // a handful, spaced (the mockup's few climbing mid-stair): half on flight 2 (view 5's), the rest on to the top; none
  // in the paifang's centre bay as seen from the square
  const f2 = FLIGHTS[1] ?? { x0: 39.3, x1: 52.7 };
  for (let tries = 0; tries < 500 && n < 16; tries++) {
    const x = n < 8 ? rng.range(f2.x0 + 0.5, f2.x1) : rng.range(f2.x1, FAR_X - 4), z = zc + rng.range(-3.3, 3.3);
    if (Math.abs(x - STAIR_GATE.x) < 5 && Math.abs(z - zc) < 1.2) continue;
    // (the axis up the stair from the square and from landing 1 stays open near the eye)
    if (x < 45 && Math.abs(z - zc) < 1.6) continue;
    // the loop's anchor on the first landing stays open, and the paifang's posts
    if ((x - 37.3) ** 2 + (z - zc) ** 2 < 2.6 ** 2) continue;
    if (Math.abs(x - STAIR_GATE.x) < 1.4 && STAIR_GATE.posts.some((p) => Math.abs(z - zc - p) < 1.1)) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 2.6)) continue;
    placed.push([x, z]);
    const up = rng.chance(0.6);
    ctx.walkers.push(mat4(x, visFloor(x), z, (up ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.25, 0.25), rng.range(0.95, 1.04)));
    n++;
  }
}

// ── the far end: the street runs on past the top landing, a last flight into the haze, a tower closing the view ──

function farEnd(ctx: Ctx, rng: Rng): void {
  const { k } = terraceKit(ctx);
  const zc = (STAIR.z0 + STAIR.z1) / 2;
  const n = 20, run = 0.8, rise = 0.4;
  for (let i = 0; i < n; i++) k.box(FAR_X + i * run + run / 2, TOP_Y + i * rise - 0.3, zc, run + 0.02, rise + 0.3, 8, STEP_RISER, { top: STEP_TOP });
  const top = TOP_Y + n * rise, x1 = FAR_X + n * run;
  k.box(x1 + 6, top - 0.6, zc, 12, 0.6, FACE_S - FACE_N, STEP_RISER, { top: STEP_TOP });
  for (const side of [1, -1]) {
    const face = side > 0 ? FACE_N : FACE_S;
    k.box((FAR_X + x1) / 2, TOP_Y - 1, (face + (side > 0 ? STAIR.z0 : STAIR.z1)) / 2, x1 - FAR_X, top - TOP_Y + 1, 3, PLINTH);
    dressWall(ctx.fd, new Vector3(side > 0 ? FAR_X : x1 + 12, 0, face), side > 0 ? ZP : ZN, x1 + 12 - FAR_X, top, Math.min(Y0 + 50, top + 26), Math.floor(rng.next() * 1e6), {
      shops: true, street: top, timber: 0.3, lit: 0.7, lod: 2, roof: true,
    }, 12, 1);
  }
  dressWall(ctx.fd, new Vector3(x1 + 12, 0, FACE_S + 6), XN, FACE_S - FACE_N + 12, top, top + 60, Math.floor(rng.next() * 1e6), { shops: true, street: top, lit: 0.7, lod: 1, roof: true }, 14, 1);
}

/** the upper stair-street, landing 1 upward (dome C2); towers.ts calls it after dome D's `buildStairStreet` */
export function buildStairUpper(ctx: Ctx): void {
  const rng = new Rng(4405);
  steps(ctx, rng);
  terraces(ctx, rng);
  stairGate(ctx);
  overhead(ctx, rng);
  stairSigns(ctx, rng);
  crowd(ctx, rng);
  farEnd(ctx, rng);
}
