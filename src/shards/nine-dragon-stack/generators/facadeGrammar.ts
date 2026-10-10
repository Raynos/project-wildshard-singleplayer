// Copied from the facade lab (the dev labs (deleted in E357 F7), round-7-lab-facade) into the clean room.
// The Kowloon facade grammar: dressTower(tower, seed, options) turns a plain box (3 m floors, ~4 m bays) into a
// Kowloon-Walled-City wall — every bay of every floor gets something. Deterministic: the same seed is the same tower.
//
//  1. SEGMENTS  — the box is stacked into 1–3 segments; upper ones set back 1–2.5 m on some faces (terraces).
//  2. COLUMNS   — each bay column gets a program (cages, balconies, enclosed balconies, bay windows, twin windows, AC
//                 stacks …) so the facade reads in vertical runs, then 1 floor in ~4 mutates (the illegal additions).
//  3. MODULES   — each bay-floor emits its windows (interior-mapped quads) and its kit pieces (instanced).
//  4. EXTRAS    — per bay-floor rolls: AC units + their drip stains, laundry poles, awnings, sill plants, hoods, dishes,
//                 lit sign boxes on the low floors; per face: drain-pipe runs at the bay seams, sagging cable bundles,
//                 galleries with posts and glazed pent eaves (the Well's stacked verandas).
//  5. ROOF      — parapets, water tanks, rooftop shacks with malachite / azurite glazed roofs and cinnabar ridges,
//                 antennas and dishes; terraces get planters and a tank.
//  6. SHELL     — the wall itself is one quad per bay-floor cell, its wash baked per vertex: the patchwork of repairs,
//                 the ink-wash shadow under each projection (AO), neon spill around each sign box, the drip stains.
import { Color, Matrix4, Vector3, Vector4 } from 'three';
import { type Builder, E, K, type Look } from '../world/facade/geo';
import { Dressing, type SignSlot } from '../world/facade/dressing';
import { CAGE_W, PAL, type PieceId } from '../world/facade/pieceIds';
import { BALCONY_W } from './facadePieces';
import { Rng } from '@wildshard/engine/core/rng';

export interface TowerSpec {
  /** footprint centre (world) */
  x: number;
  z: number;
  /** footprint size along the tower's local x (w) and z (d), metres */
  w: number;
  d: number;
  /** base altitude and height (m) */
  y0: number;
  h: number;
  /** rotation about y (radians) */
  rot?: number;
  /** which faces are dressed: 1 = +z (front), 2 = -z, 4 = +x, 8 = -x (default all); the rest get a painted shell */
  faces?: number;
}

export interface DressOptions {
  floorH?: number;
  bayW?: number;
  /** 0..1: how much of the extras get rolled (1 = Kowloon) */
  density?: number;
  /** chance a floor becomes a continuous gallery with posts (the Well's verandas) */
  gallery?: number;
  /** ground-floor shopfronts */
  shops?: boolean;
  setbacks?: boolean;
  roof?: boolean;
  /** 0 full · 1 mid (no small clutter) · 2 far (painted shell, no pieces, no windows) */
  lod?: 0 | 1 | 2;
  /** force the tower's base wall wash */
  wash?: number;
  /** the world height of the street (the shops' floor) */
  street?: number;
  /** 0..1: how much is timber veranda (brown rails, red posts, glazed eaves) instead of concrete and steel */
  timber?: number;
  /** 0..1: the lit share of the windows (dusk ≈ 0.5) */
  lit?: number;
  /** world-height band [min, max] where small clutter (plants, laundry, dishes) is placed; outside it the modules
   *  stay but the small stuff is skipped (it would be 1–2 px). Default: everywhere */
  detailY?: readonly [number, number];
  /** false: emit no sign slots (a wall cut back round a street's mouth: its whole slots are kept, shrunk, elsewhere) */
  signs?: boolean;
}

type Mod = 'win1' | 'win2' | 'win3' | 'cage1' | 'cage2' | 'balcony' | 'balconySolid' | 'enclosed' | 'bay' | 'ac' | 'blank' | 'shop' | 'gallery' | 'addon';

/** the plain window cells a hung room may cover (nothing on them stands out past ~0.9 m) */
const PLAIN = new Set<Mod>(['win1', 'win2', 'win3', 'blank', 'ac', 'cage1', 'cage2']);

const COLUMN_WEIGHTS: readonly (readonly [Mod, number])[] = [
  ['win2', 0.14], ['win1', 0.06], ['win3', 0.06], ['cage1', 0.13], ['cage2', 0.12], ['balcony', 0.16], ['balconySolid', 0.06],
  ['enclosed', 0.12], ['bay', 0.08], ['ac', 0.05], ['blank', 0.03],
];

// (E281 pass 6: the mockups' walls are pale warm stone and render — they win over the darker dome targets — so the
// washes are lighter and warmer than pass 1's; the same twelve, so every pick lands on the same slot)
export const WALLS = [0xc0b39c, 0xb9af9a, 0xc6b598, 0xb3b0a3, 0xbeae95, 0xc8b99f, 0xb2b1a0, 0xbab4a8, 0xc9b392, 0xb0af9d, 0xa79d8b, 0xada08c] as const;
/** the timber cladding of a Chongqing stilt-house front (E281): dark lacquered boards */
const TIMBER = [0x5a4230, 0x4e3a2b, 0x634633, 0x553a2c, 0x6a4a34] as const;
const WARM = [0xffb866, 0xffab55, 0xffc47c, 0xf2a052, 0xffbc70, 0xffc98a] as const;
const COOL = [0xd9efe8, 0xc4e2ff] as const;
const AWN = [PAL.cinnabar, PAL.azurite, PAL.malachite, 0xd9a441, 0xe8e4d8, 0x7e1e1a] as const;
export const NEONS = [0xff3fa4, 0x3fe6ff, 0x33f0b0, 0xff3b30, 0xffb347] as const;

const up = new Vector3(0, 1, 0);
const tmpC = new Color();

function shade(hex: number, k: number): number {
  tmpC.setHex(hex).multiplyScalar(k);
  return tmpC.getHex();
}
function mixHex(a: number, b: number, t: number): number {
  const ca = new Color(a), cb = new Color(b);
  return ca.lerp(cb, t).getHex();
}

/** one face of one segment, in world space: origin at its left-bottom corner on the wall plane, u along, n out */
interface Face { o: Vector3; u: Vector3; n: Vector3; len: number; y0: number; y1: number; dressed: boolean; bit: number; floor0: number }

interface Cell { mod: Mod; aoTop: number; aoAll: number; stainX: number; stain: number; spill: number; spillC: number }

class Emit {
  /** the module being emitted is a timber column: its windows are lattice (窗格) */
  lattice = false;
  /** E281 round 2: the near-face clutter's own stream (a fork per face: the grammar's rolls are untouched, so no wall
   *  re-rolls and no sign slot moves) */
  rx: Rng = Rng.scrambled(1);
  /** when set, windows draw their states from it instead of the tower's stream (the clutter's hung rooms) */
  winR: Rng | null = null;
  /** no sign slots from this tower (DressOptions.signs) */
  noSigns = false;
  /** E281 pass 9: how far the cell being dressed stands out of the face plane (a stepped-out bay column), m */
  zOff = 0;

  sign(slot: SignSlot): void { if (!this.noSigns) this.out.addSign(slot); }

  constructor(readonly out: Dressing, readonly rng: Rng, readonly fh: number, readonly lod: number, readonly dens: number,
    readonly timber: number, readonly lit: number) {}

  put(piece: PieceId, f: Face, s: number, y: number, z: number, sx = 1, sy = 1, sz = 1, c = 0xffffff): void {
    const p = f.o.clone().addScaledVector(f.u, s).addScaledVector(f.n, z + this.zOff).setY(y);
    const m = new Matrix4().makeBasis(f.u, up, f.n).scale(new Vector3(sx, sy, sz)).setPosition(p);
    this.out.pieces.push({ piece, m, c: new Color(c) });
  }

  /** a piece turned to face along u (+1) or against it (-1): for a bay box's side windows */
  putTurned(piece: PieceId, at: Vector3, dir: Vector3, sx: number, sy: number, c: number): void {
    const n = dir.clone().normalize();
    const u = new Vector3().crossVectors(up, n);
    const m = new Matrix4().makeBasis(u, up, n).scale(new Vector3(sx, sy, 1)).setPosition(at);
    this.out.pieces.push({ piece, m, c: new Color(c) });
  }

  /** an interior-mapped window: centre s along the face, sill y, size w × h, `z` out from the wall plane */
  win(f: Face, s: number, y: number, w: number, h: number, wall: number, z = 0, door = false, litBias = 0, n: Vector3 = f.n, u: Vector3 = f.u, base: Vector3 | null = null): void {
    const r = this.winR ?? this.rng;
    const p = (base ?? f.o.clone().addScaledVector(u, s).addScaledVector(f.n, this.zOff)).clone().addScaledVector(n, z + 0.012).setY(y);
    // (E281 pass 5) no two windows quite alike: a plain window's lintel drops by up to a quarter and its width narrows
    // by up to a sixth, from a hash of where it is (the rng is untouched, so nothing else in the city re-rolls)
    let ww = w, hh = h;
    if (!door && h > 0.9) {
      const hx = Math.sin(p.x * 12.9898 + p.y * 78.233 + p.z * 37.719) * 43758.5453;
      const k = hx - Math.floor(hx), k2 = (k * 7.13) % 1;
      hh = h * (1 - 0.25 * k);
      ww = w * (1 - 0.16 * k2);
    }
    const m = new Matrix4().makeBasis(u, up, n).scale(new Vector3(ww, hh, 1)).setPosition(p);
    const lit = r.chance(this.lit + litBias) ? r.range(0.8, 1.15) : 0;
    const cool = r.chance(0.045);
    const light = new Color(cool ? r.pick(COOL) : r.pick(WARM));
    const curtain = r.chance(0.45) ? r.range(0.25, 0.7) : 0;
    const mull = r.int(0, 3);
    const frame = r.weighted<number>([[0, 0.5], [1, 0.35], [2, 0.1], [3, 0.05]]);
    const style = mull + (this.lattice ? 3 : frame) * 4 + (door ? 16 : 0) + (this.lattice ? 32 : 0);
    this.out.windows.push({ m, win: new Vector4(r.range(0, 97), lit, curtain, style), wall: new Color(wall), light });
  }
}

/**
 * Dress one tower. Returns (and fills) `out`: instanced piece placements, interior-mapped windows, sign slots and the
 * merged shell geometry. Faces not in `tower.faces` get a painted shell (floors + a lit-window pattern, no pieces).
 */
export function dressTower(t: TowerSpec, seed: number, opt: DressOptions = {}, out: Dressing = new Dressing()): Dressing {
  const rng = Rng.scrambled(seed);
  const fh = opt.floorH ?? 3;
  const bayW = opt.bayW ?? 4;
  const dens = opt.density ?? 1;
  const lod = opt.lod ?? 0;
  const faces = t.faces ?? 15;
  const rot = t.rot ?? 0;
  const street = opt.street ?? t.y0;
  const baseWash = opt.wash ?? rng.pick(WALLS);
  const em = new Emit(out, rng, fh, lod, dens, opt.timber ?? 0.1, opt.lit ?? 0.5);
  em.noSigns = opt.signs === false;
  out.towers++;
  const R = new Matrix4().makeRotationY(rot);
  const toWorld = (lx: number, ly: number, lz: number): Vector3 => new Vector3(lx, ly, lz).applyMatrix4(R).add(new Vector3(t.x, 0, t.z));
  const dirW = (lx: number, lz: number): Vector3 => new Vector3(lx, 0, lz).applyMatrix4(R).normalize();

  // ── 1. segments (setbacks) ──
  const floorsTotal = Math.max(1, Math.floor(t.h / fh));
  const segs: { f0: number; f1: number; inset: [number, number, number, number] }[] = [];
  if (opt.setbacks !== false && floorsTotal > 10 && rng.chance(0.75)) {
    const nSeg = floorsTotal > 22 && rng.chance(0.5) ? 3 : 2;
    let f0 = 0;
    const inset: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < nSeg; i++) {
      const f1 = i === nSeg - 1 ? floorsTotal : f0 + Math.max(4, Math.round((floorsTotal / nSeg) * rng.range(0.8, 1.25)));
      segs.push({ f0, f1: Math.min(f1, floorsTotal), inset: [...inset] as [number, number, number, number] });
      f0 = Math.min(f1, floorsTotal);
      if (f0 >= floorsTotal) break;
      // the next segment steps back on 1–3 faces
      for (let k = 0; k < 4; k++) if (rng.chance(0.5)) inset[k] = (inset[k] ?? 0) + rng.pick([1, 1.5, 2, 2.5]);
    }
  } else segs.push({ f0: 0, f1: floorsTotal, inset: [0, 0, 0, 0] });

  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    if (seg === undefined) continue;
    const [iPZ, iNZ, iPX, iNX] = seg.inset;
    const x0 = -t.w / 2 + iNX, x1 = t.w / 2 - iPX, z0 = -t.d / 2 + iNZ, z1 = t.d / 2 - iPZ;
    const y0 = t.y0 + seg.f0 * fh, y1 = t.y0 + seg.f1 * fh;
    const wash = shade(baseWash, rng.range(0.96, 1.04));
    const top = si === segs.length - 1;
    // faces: +z, -z, +x, -x (left-bottom corners seen from outside)
    const fl: Face[] = [
      { o: toWorld(x0, y0, z1), u: dirW(1, 0), n: dirW(0, 1), len: x1 - x0, y0, y1, dressed: (faces & 1) !== 0, bit: 1, floor0: seg.f0 },
      { o: toWorld(x1, y0, z0), u: dirW(-1, 0), n: dirW(0, -1), len: x1 - x0, y0, y1, dressed: (faces & 2) !== 0, bit: 2, floor0: seg.f0 },
      { o: toWorld(x1, y0, z1), u: dirW(0, -1), n: dirW(1, 0), len: z1 - z0, y0, y1, dressed: (faces & 4) !== 0, bit: 4, floor0: seg.f0 },
      { o: toWorld(x0, y0, z0), u: dirW(0, 1), n: dirW(-1, 0), len: z1 - z0, y0, y1, dressed: (faces & 8) !== 0, bit: 8, floor0: seg.f0 },
    ];
    for (const f of fl) {
      if (!f.dressed || lod >= 2) {
        paintedFace(out, f, wash, fh, rng);
        // (every face but a back: the ends of a run and its far faces show in the look-ups)
        if ((f.dressed || f.bit !== 2) && f.len > 5) farBands(em, f, fh, rng);
      }
      else dressFace(em, f, wash, fh, bayW, opt, street, rng.fork(f.bit * 31 + si * 7));
    }
    // the roof slab of this segment (a terrace if another segment stands on it)
    const cap = [toWorld(x0, y1, z1), toWorld(x1, y1, z1), toWorld(x1, y1, z0), toWorld(x0, y1, z0)] as const;
    out.shell.quad4(cap[0], cap[1], cap[2], cap[3], x1 - x0, z1 - z0, { wash: shade(wash, 0.82), line: 1.2 });
    // parapet round the edge
    parapet(out, fl, y1, wash);
    if (opt.roof !== false && lod < 2) roofClutter(em, x0, x1, z0, z1, y1, top, rng.fork(900 + si), toWorld, dirW);
  }
  return out;
}

/**
 * The clean room's walls are planes (towers.ts wallRun / facades.ts buildWall: a start point, an outward normal, a
 * length). dressWall is the drop-in: it stands a `depth`-deep tower behind the plane and dresses only its street face.
 * `p0` is the wall's start on the plane (its left end seen from outside; any y), `n` the outward normal.
 */
export function dressWall(d: Dressing, p0: Vector3, n: Vector3, length: number, y0: number, y1: number, seed: number,
  opt: DressOptions = {}, depth = 12, faces = 1): Dressing {
  const nn = new Vector3(n.x, 0, n.z).normalize();
  const u = new Vector3().crossVectors(up, nn);
  const c = p0.clone().addScaledVector(u, length / 2).addScaledVector(nn, -depth / 2);
  return dressTower({ x: c.x, z: c.z, w: length, d: depth, y0, h: y1 - y0, rot: Math.atan2(nn.x, nn.z), faces }, seed, opt, d);
}

/** a face with no pieces: one quad, floors ruled and a lit-window pattern painted (far towers, hidden backs) */
function paintedFace(out: Dressing, f: Face, wash: number, fh: number, rng: Rng): void {
  // (the face's pattern seed rides above the edge bits: vPat.w = edges + 16 × seed)
  out.shell.quad(f.o, f.u, up, f.len, f.y1 - f.y0, { wash, kind: K.painted, p1: fh, p2: rng.pick([1.8, 2.0, 2.2]), line: 1, edges: E.sides + 16 * rng.int(0, 63) });
}

/**
 * A far face's relief (E281): the painted faces read as flat slabs in every look-up, so every 2–4 floors a slab lip
 * or a glazed pent eave runs the face's length — instanced (unit box / eave), so it costs no geometry and culls.
 */
function farBands(em: Emit, f: Face, fh: number, rng: Rng): void {
  const floors = Math.round((f.y1 - f.y0) / fh);
  for (let fi = rng.int(1, 3); fi < floors - 1; fi += rng.int(2, 4)) {
    const y = f.y0 + fi * fh;
    if (rng.chance(0.32)) em.put('eave', f, f.len / 2, y - 0.1, 0, f.len, 1.1, rng.range(0.9, 1.2), rng.chance(0.75) ? PAL.malachite : PAL.azurite);
    else em.put('box', f, f.len / 2, y - 0.16, 0, f.len + 0.3, 0.16, rng.range(0.55, 1.1), rng.chance(0.2) ? PAL.timber : shade(PAL.slab, rng.range(0.85, 1.05)));
  }
}

function parapet(out: Dressing, fl: Face[], y: number, wash: number): void {
  const pw: Look = { wash: shade(wash, 1.03), kind: K.panel, line: 1 };
  for (const f of fl) {
    const c = f.o.clone().addScaledVector(f.u, f.len / 2).addScaledVector(f.n, -0.1).setY(y + 0.45);
    out.shell.boxAxes(c, f.u, up, f.n, f.len / 2, 0.45, 0.1, pw, { top: { wash: shade(wash, 0.9), line: 1.2 }, bottom: null });
  }
}

function dressFace(em: Emit, f: Face, wash: number, fh: number, bayW: number, opt: DressOptions, street: number, rng: Rng): void {
  const out = em.out;
  const dens = em.dens;
  em.rx = rng.fork(4099);
  const band = opt.detailY ?? [-1e9, 1e9];
  const smallAt = (y: number): boolean => em.lod === 0 && y >= band[0] && y <= band[1];
  const bays = Math.max(1, Math.round(f.len / bayW));
  const bw = f.len / bays;
  const floors = Math.max(1, Math.round((f.y1 - f.y0) / fh));
  const gal = opt.gallery ?? 0;

  // ── 2. column programs, then per-floor mutations ──
  const cols: Mod[] = [];
  for (let b = 0; b < bays; b++) cols.push(rng.weighted(COLUMN_WEIGHTS));
  // timber-clad columns (E281, the targets' Chongqing fronts): dark boarded cells, lattice windows, timber balconies,
  // a glazed eave over most floors; no cages or bare AC stacks on them
  const timberCol: boolean[] = [];
  for (let b = 0; b < bays; b++) timberCol.push(rng.chance(em.timber * 0.45));
  const TIMBER_MOD: Partial<Record<Mod, Mod>> = { cage1: 'win1', cage2: 'win2', ac: 'win2', balconySolid: 'balcony', blank: 'win1' };
  const galleryFloor: boolean[] = [];
  // a run's open end (a side face, bit ≠ 1) faces a side street: no veranda or hung room juts over it (the stair lane,
  // E281: the square's corner towers hid mockup C's 牙科); the rolls stay, so the street faces are unchanged
  const side = f.bit !== 1;
  for (let fi = 0; fi < floors; fi++) galleryFloor.push(gal > 0 && fi > 0 && rng.chance(gal) && !side);
  // E281 pass 9, the lumpy outline: a near face's bay columns step out 0.5–1.6 m from floor 1 up (never on a gallery
  // floor), from the clutter stream; everything on a stepped cell moves out with it (em.zOff) and the steps get their
  // sides, tops and soffits in the shell. Neighbours often share a step (a wider block)
  const cz: number[] = [];
  for (let b = 0; b < bays; b++) {
    const prev = cz[b - 1] ?? 0;
    cz.push(em.lod !== 0 || side || bays < 2 ? 0 : b > 0 && prev > 0 && em.rx.chance(0.35) ? prev : em.rx.chance(0.5) ? em.rx.pick([0.5, 0.8, 1.2, 1.6]) : 0);
  }
  const off = (fi: number, b: number): number => (fi >= 1 && fi < floors && b >= 0 && b < bays && galleryFloor[fi] !== true ? cz[b] ?? 0 : 0);
  const maxOff = (f0: number, f1: number, b0: number, b1: number): number => {
    let m = 0;
    for (let fi = f0; fi < f1; fi++) for (let b = b0; b < b1; b++) m = Math.max(m, off(fi, b));
    return m;
  };
  const plan: Cell[][] = [];
  for (let fi = 0; fi < floors; fi++) {
    const row: Cell[] = [];
    const y = f.y0 + fi * fh;
    const isShop = opt.shops === true && Math.abs(y - street) < 0.5;
    for (let b = 0; b < bays; b++) {
      let mod: Mod = cols[b] ?? 'win2';
      if (rng.chance(0.26)) mod = rng.weighted(COLUMN_WEIGHTS);
      // a timber column's window cell is a timber balcony half the time (the stilt-house verandas)
      if (timberCol[b] === true) mod = (mod === 'win1' || mod === 'win2' || mod === 'win3' || mod === 'cage1' || mod === 'cage2') && rng.chance(0.5) ? 'balcony' : TIMBER_MOD[mod] ?? mod;
      if (galleryFloor[fi] === true) mod = 'gallery';
      if (isShop) mod = 'shop';
      row.push({ mod, aoTop: 1, aoAll: 1, stainX: 0, stain: 0, spill: 0, spillC: 0 });
    }
    plan.push(row);
  }
  // stacked add-ons: rooms cantilevered off the face, 1–2 bays × 1–3 floors, 0.9–1.7 m deep (the lumpy KWC outline)
  const nAdd = Math.round(bays * floors * 0.045 * dens);
  for (let i = 0; i < (floors > 3 ? nAdd : 0); i++) {
    const bs = rng.int(1, Math.min(2, bays)), fs = rng.int(1, 3);
    const b0 = rng.int(0, bays - bs), f0 = rng.int(1, Math.max(1, floors - fs - 1));
    let free = true;
    for (let fi = f0; fi < f0 + fs; fi++) for (let b = b0; b < b0 + bs; b++) {
      const m = plan[fi]?.[b]?.mod;
      if (m === undefined || m === 'addon' || m === 'gallery' || m === 'shop') free = false;
    }
    if (!free || side) continue;
    for (let fi = f0; fi < f0 + fs; fi++) for (let b = b0; b < b0 + bs; b++) { const c = plan[fi]?.[b]; if (c !== undefined) c.mod = 'addon'; }
    em.zOff = maxOff(f0, f0 + fs, b0, b0 + bs);
    addon(em, f, b0 * bw, bs * bw, f.y0 + f0 * fh, fs, fh, rng.range(0.9, 1.7), rng);
    em.zOff = 0;
  }
  // E281 round 2: more rooms hung off a near face's lower floors, from the clutter stream, as an overlay: the plan is
  // untouched (so every later roll of this face and tower, and every sign slot, stays as it was); a room covers plain
  // window cells only, and those cells skip the clutter pass
  const covered = new Set<number>();
  if (em.lod === 0 && floors > 3 && !side) {
    const rx = em.rx;
    const n2 = Math.round(bays * Math.min(floors, 9) * 0.05 * dens);
    for (let i = 0; i < n2; i++) {
      const bs = rx.int(1, Math.min(2, bays)), fs = rx.int(1, 2);
      const b0 = rx.int(0, bays - bs), f0 = rx.int(1, Math.max(1, Math.min(floors, 9) - fs - 1));
      if (f.y0 + f0 * fh - street > 24 || f.y0 + f0 * fh < band[0]) continue;
      let free = true;
      for (let fi = f0; fi < f0 + fs; fi++) for (let b = b0; b < b0 + bs; b++) {
        const m = plan[fi]?.[b]?.mod;
        if (m === undefined || !PLAIN.has(m) || covered.has(fi * bays + b)) free = false;
      }
      if (!free || galleryFloor.slice(f0, f0 + fs).some(Boolean)) continue;
      for (let fi = f0; fi < f0 + fs; fi++) for (let b = b0; b < b0 + bs; b++) covered.add(fi * bays + b);
      em.winR = rx;
      em.zOff = maxOff(f0, f0 + fs, b0, b0 + bs);
      addon(em, f, b0 * bw, bs * bw, f.y0 + f0 * fh, fs, fh, rx.range(1.1, 1.9), rx);
      em.zOff = 0;
      em.winR = null;
    }
  }
  // AO: a projection at floor fi darkens the top of the cell below it; a balcony / gallery darkens its own back wall
  const projects = (m: Mod): number => (m === 'gallery' ? 0.45 : m === 'balcony' || m === 'balconySolid' ? 0.55 : m === 'addon' ? 0.64 : m === 'enclosed' ? 0.7 : m === 'bay' ? 0.8 : m === 'cage1' || m === 'cage2' ? 0.86 : 1);
  for (let fi = 0; fi < floors; fi++) for (let b = 0; b < bays; b++) {
    const cell = plan[fi]?.[b];
    if (cell === undefined) continue;
    const above = plan[fi + 1]?.[b];
    if (above !== undefined) cell.aoTop = projects(above.mod);
    if (cell.mod === 'balcony' || cell.mod === 'balconySolid' || cell.mod === 'gallery') cell.aoAll = 0.9;
  }

  // glazed pent-eave bands (腰檐): every 4–7 floors a whole floor gets a malachite / azurite eave across its bays
  let nextEave = rng.int(2, 4);
  for (let fi = 1; fi < floors - 1; fi++) {
    // a timber column carries its own eave over most floors (the stacked verandas of the targets)
    if (fi < nextEave) {
      for (let b = 0; b < bays; b++) {
        const c = plan[fi]?.[b];
        if (timberCol[b] !== true || c === undefined || c.mod === 'addon' || c.mod === 'gallery' || !rng.chance(0.85)) continue;
        em.zOff = off(fi, b);
        em.put('eave', f, (b + 0.5) * bw, f.y0 + (fi + 1) * fh - 0.08, 0, bw, 0.8, rng.range(0.7, 0.85), rng.chance(0.8) ? PAL.malachite : PAL.azurite);
        em.zOff = 0;
        c.aoTop = Math.min(c.aoTop, 0.7);
      }
      continue;
    }
    nextEave = fi + rng.int(3, 6) - Math.round(em.timber * 1.5);
    const tile = rng.chance(0.75) ? PAL.malachite : PAL.azurite;
    for (let b = 0; b < bays; b++) {
      const c = plan[fi]?.[b];
      if (c === undefined || c.mod === 'addon') continue;
      em.zOff = off(fi, b);
      em.put('eave', f, (b + 0.5) * bw, f.y0 + (fi + 1) * fh - 0.08, 0, bw, 1, rng.range(0.85, 1.05), tile);
      em.zOff = 0;
      c.aoTop = Math.min(c.aoTop, 0.66);
    }
  }
  // ── 3 + 4. modules and extras ──
  for (let fi = 0; fi < floors; fi++) {
    const y = f.y0 + fi * fh;
    for (let b = 0; b < bays; b++) {
      const cell = plan[fi]?.[b];
      if (cell === undefined) continue;
      const sc = (b + 0.5) * bw;
      em.lattice = timberCol[b] === true || (cell.mod === 'gallery' && rng.chance(0.5 + 0.4 * em.timber));
      em.zOff = off(fi, b);
      const wins = module(em, f, cell, sc, y, bw, fh, wash, smallAt(y), rng, street);
      em.lattice = false;
      if (smallAt(y) && y - street < 36 && !covered.has(fi * bays + b)) clutter(em, f, cell, wins, sc, y, bw, fh, fi, timberCol[b] === true);
      em.zOff = 0;
    }
    // a gallery: one slab along the face, real bars, posts at the seams, a glazed pent eave over it on some floors
    if (galleryFloor[fi] === true) gallery(em, f, y, fh, bays, bw, wash, rng, smallAt(y));
  }
  // tall neon (E281, the targets' stacked vertical signs), 2–14 floors over the street: flat on a window cell (in front
  // of its cage / bay box), or a blade hung out at a bay seam, where the balconies either side leave a gap
  // (only on a wall's street face: a run's open end faces a side street — the stair lane asked for its ends clear)
  if (em.lod < 2 && f.bit === 1) tallSigns(em, f, plan, bays, bw, floors, fh, street, galleryFloor, rng, off);
  // pipes at the bay seams: runs of 1–3 from the segment base to its top
  for (let k = 0; k <= bays; k++) {
    if (!rng.chance(0.7 * dens)) continue;
    const n = rng.weighted<number>([[1, 0.35], [2, 0.35], [3, 0.2], [4, 0.1]]);
    const rust = rng.chance(0.3);
    const s0 = k * bw + (k === 0 ? 0.3 : k === bays ? -0.3 - (n - 1) * 0.2 : rng.range(-0.3, 0.1));
    const yA = Math.max(f.y0, street);
    const r = rng.chance(0.35) ? rng.range(1.7, 2.3) : rng.range(1.0, 1.4);
    // (not down a seam beside a stepped column: it would stand off the floors below the step)
    const stepped = (cz[k - 1] ?? 0) > 0 || (cz[k] ?? 0) > 0;
    for (let i = 0; i < n; i++) {
      const pc = rust ? PAL.rust : shade(PAL.pipe, rng.range(0.9, 1.1));
      if (!stepped) em.put('pipe', f, s0 + i * 0.2 * r, yA, 0, r, f.y1 - yA, r * (1 + i * 0.3), pc);
    }
  }
  // cable bundles sagging across the face under the slab lips
  const nCab = Math.round(floors * 0.2 * dens);
  for (let i = 0; i < nCab; i++) {
    const fi = rng.int(1, floors - 1);
    const b0 = rng.int(0, bays - 1), b1 = Math.min(bays, b0 + rng.int(1, 3));
    const yy = f.y0 + fi * fh - rng.range(0.35, 0.6);
    const count = rng.int(2, 4);
    const zc = maxOff(fi - 1, fi, b0, b1);
    for (let j = 0; j < count; j++) {
      const a = f.o.clone().addScaledVector(f.u, b0 * bw + 0.2).addScaledVector(f.n, 0.12 + j * 0.05 + zc).setY(yy - j * 0.07);
      const bb = f.o.clone().addScaledVector(f.u, b1 * bw - 0.2).addScaledVector(f.n, 0.12 + j * 0.05 + zc).setY(yy - j * 0.07 + rng.range(-0.2, 0.2));
      sag(out.shell, a, bb, rng.range(0.25, 0.7), f.n, 0.035);
    }
  }
  // ── 6. the shell: one quad per bay-floor, washes baked per vertex ──
  const colFinish: number[] = [];
  for (let b = 0; b < bays; b++) colFinish.push(rng.weighted<number>([[0, 0.55], [1, 0.3], [2, 0.15]]));
  for (let fi = 0; fi < floors; fi++) for (let b = 0; b < bays; b++) {
    const cell = plan[fi]?.[b];
    if (cell === undefined) continue;
    const y = f.y0 + fi * fh;
    const tcell = timberCol[b] === true && cell.mod !== 'shop';
    let w = shade(tcell ? rng.pick(TIMBER) : wash, rng.range(0.955, 1.045) * cell.aoAll);
    // a repaired bay: now and then a whole cell in another wash
    if (rng.chance(0.06)) w = shade(rng.pick(WALLS), 0.98);
    let wt = shade(w, cell.aoTop);
    if (cell.spill > 0) {
      w = mixHex(w, cell.spillC, cell.spill * 0.35);
      wt = mixHex(wt, cell.spillC, cell.spill * 0.55);
    }
    const d = off(fi, b);
    const edges = (b === 0 || d !== off(fi, b - 1) ? E.u0 : 0) | (b === bays - 1 || d !== off(fi, b + 1) ? E.u1 : 0) | (fi === floors - 1 || d !== off(fi + 1, b) ? E.v1 : 0) | (d !== off(fi - 1, b) ? E.v0 : 0);
    const p0 = f.o.clone().addScaledVector(f.u, b * bw).addScaledVector(f.n, d).setY(y);
    // the finish runs in vertical strips (a column retiled, a column boarded), with the odd cell patched
    const fin = colFinish[b] ?? 0;
    // (finish 3: timber planks, the timber columns)
    const finish = tcell ? 3 : rng.chance(0.12) ? rng.int(0, 2) : fin;
    out.shell.quad(p0, f.u, up, bw, fh, { wash: w, washTop: wt, kind: K.wall, p1: cell.stainX, p2: cell.stain * 0.999 + finish * 2, line: 1, edges });
  }
  // the steps (E281 pass 9): a side at each seam where two neighbours stand out differently, a top where a cell stands
  // out further than the one above it, a soffit where it stands out less
  if (cz.some((z) => z > 0)) for (let fi = 1; fi < floors; fi++) {
    const y = f.y0 + fi * fh, yt = y + fh;
    for (let k = 0; k <= bays; k++) {
      const dl = off(fi, k - 1), dr = off(fi, k);
      if (dl === dr) continue;
      const p = f.o.clone().addScaledVector(f.u, k * bw).addScaledVector(f.n, Math.min(dl, dr)).setY(y);
      const look: Look = { wash: shade(wash, 0.8), kind: K.wall, line: 1, edges: E.all };
      if (dl > dr) out.shell.quad(p, up, f.n, fh, dl - dr, look);
      else out.shell.quad(p, f.n, up, dr - dl, fh, look);
    }
    for (let b = 0; b < bays; b++) {
      const d = off(fi, b), da = off(fi + 1, b), db = off(fi - 1, b);
      const p = f.o.clone().addScaledVector(f.u, b * bw);
      if (d > da) out.shell.quad(p.clone().addScaledVector(f.n, da).setY(yt), f.n, f.u, d - da, bw, { wash: shade(wash, 0.86), line: 1.2 });
      if (d > db) out.shell.quad(p.clone().addScaledVector(f.n, db).setY(y), f.u, f.n, bw, d - db, { wash: shade(wash, 0.6), line: 1 });
    }
  }
}

/** a sagging cable from a to b (a shallow catenary in 4 segments; E281 round 2: 6 cost a third of the shell), `out`
 *  pushes it off the wall */
function sag(o: Builder, a: Vector3, b: Vector3, depth: number, out: Vector3, r: number): void {
  const N = 4;
  let prev = a.clone();
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const p = a.clone().lerp(b, t);
    p.y -= depth * 4 * t * (1 - t);
    p.addScaledVector(out, 0.1 * 4 * t * (1 - t));
    o.wire(prev, p, r * 0.55, { wash: 0x1d1e22, line: 0.5 });
    prev = p;
  }
}

/** a plain window a module emitted (the clutter pass hangs cages, AC units and poles off it) */
interface Win { s: number; w: number }

function module(em: Emit, f: Face, cell: Cell, sc: number, y: number, bw: number, fh: number, wash: number, small: boolean, rng: Rng, street: number): Win[] {
  const dens = em.dens;
  const sill = y + 0.85, wh = 1.62;
  const wins: { s: number; w: number }[] = [];
  const m = cell.mod;
  if (m === 'addon') return [];
  switch (m) {
    case 'win1': case 'ac': case 'cage1': {
      const w = Math.min(bw * 0.68, 2.8);
      wins.push({ s: sc + rng.range(-0.15, 0.15), w });
      break;
    }
    case 'win2': case 'cage2': {
      const w = Math.min(bw * 0.37, 1.55);
      wins.push({ s: sc - bw * 0.24, w }, { s: sc + bw * 0.24, w });
      break;
    }
    case 'win3': {
      const w = bw * 0.27;
      for (const k of [-1, 0, 1]) wins.push({ s: sc + k * bw * 0.31, w });
      break;
    }
    case 'blank': {
      em.win(f, sc + rng.range(-1, 1), y + 1.8, 0.6, 0.6, wash);
      if (rng.chance(0.6)) em.put('acBox', f, sc + rng.range(-1.2, 1.2), y + 0.4, 0, 1, 1, 1, shade(0xffffff, rng.range(0.85, 1)));
      break;
    }
    case 'shop': {
      if (rng.chance(0.3)) {
        em.put('shutter', f, sc, y + 0.02, 0, bw - 0.5, 2.55, 1, shade(0xffffff, rng.range(0.85, 1.05)));
      } else {
        em.win(f, sc, y + 0.08, bw - 0.7, 2.45, wash, 0, true, 0.55);
        em.put('ledge', f, sc, y + 2.6, 0, bw - 0.3, 1, 1.3);
      }
      if (rng.chance(0.5)) {
        // a timber canopy: a glazed pent roof over the shop, lanterns under its eave
        em.put('eave', f, sc, y + 3.25, 0, bw, 1, 1.5, rng.chance(0.7) ? PAL.malachite : PAL.azurite);
        for (const k of [-0.3, 0.3]) if (rng.chance(0.7)) em.put('lantern', f, sc + k * bw, y + 2.4, 1.6, 1, 1, 1);
      } else em.put('awning', f, sc, y + 2.95, 0, bw - 0.4, 1, 1.25, rng.pick(AWN));
      if (rng.chance(0.7)) {
        const col = rng.pick(NEONS);
        em.put('signFlat', f, sc, y + 3.12, 0.02, bw * 0.7, 0.72, 1, col);
        em.sign({ at: f.o.clone().addScaledVector(f.u, sc).addScaledVector(f.n, 0.14).setY(y + 3.48), normal: f.n.clone(), size: 0.62, color: col, blade: false });
      }
      return [];
    }
    case 'balcony': case 'balconySolid': {
      const sx = (bw - 0.3) / BALCONY_W;
      const piece: PieceId = m === 'balcony' && (em.lattice || rng.chance(Math.min(1, em.timber * 1.3))) ? 'balconyTimber' : m;
      em.put(piece, f, sc, y, 0, sx, 1, rng.range(0.95, 1.2) * (small ? em.rx.range(1.05, 1.45) : 1), shade(0xffffff, rng.range(0.94, 1.04)));
      em.win(f, sc - bw * 0.22, y + 0.05, 0.9, 2.15, wash, 0, true);
      em.win(f, sc + bw * 0.18, sill, 1.3, wh, wash);
      if (small && rng.chance(0.5 * dens)) em.put('laundryAlong', f, sc, y + 2.35, 0.1, (bw - 0.6) * 0.9, 1, 1);
      if (small && rng.chance(0.45 * dens)) {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) {
          if (m === 'balconySolid') em.put('plant', f, sc + rng.range(-bw * 0.4, bw * 0.4), y + 1.0, 0.72, rng.range(0.8, 1.2), rng.range(0.8, 1.3), 1);
          else em.put('plant', f, sc + rng.range(-bw * 0.4, bw * 0.4), y + 0.02, 0.62, rng.range(0.9, 1.3), rng.range(0.9, 1.5), 1);
        }
      }
      if (rng.chance(0.25 * dens)) em.put('awning', f, sc, y + 2.7, 1.1, bw - 0.3, 0.7, 0.55, rng.pick(AWN));
      // a red lantern at a timber balcony's edge (the targets' warm dots up the walls)
      if (piece === 'balconyTimber' && rng.chance(0.35)) em.put('lantern', f, sc + rng.range(-bw * 0.35, bw * 0.35), y + 2.75, 1.05, 1, 1, 1);
      if (rng.chance(0.3 * dens)) em.put('acUnit', f, sc + bw * 0.44 - 0.5, y + 2.0, 0, 1, 1, 1, shade(0xffffff, rng.range(0.88, 1.02)));
      return [];
    }
    case 'enclosed': {
      // an enclosed balcony: a box across the bay, a band of windows on its front, a ledge under it
      const d = rng.range(0.7, 0.95);
      em.put('bayBox', f, sc, y + 0.02, 0, bw - 0.3, fh - 0.3, d / 0.6, shade(wash, rng.range(0.94, 1.02)));
      const n = bw > 3.2 ? 3 : 2;
      const ww = (bw - 0.5) / n - 0.12;
      for (let i = 0; i < n; i++) em.win(f, sc - (bw - 0.5) / 2 + (i + 0.5) * ((bw - 0.5) / n), y + 0.9, ww, 1.4, wash, d);
      em.put('ledge', f, sc, y + 0.02, d - 0.1, bw - 0.2, 1, 0.8);
      if (small && rng.chance(0.3 * dens)) em.put('planter', f, sc + rng.range(-0.8, 0.8), y + 0.12, d - 0.05, 1.2, 1, 1);
      if (rng.chance(0.35 * dens)) em.put('acBox', f, sc + rng.range(-1, 1), y + 0.3, d, 1, 1, 1);
      return [];
    }
    case 'bay': {
      const w = Math.min(bw - 1.0, 2.6), d = 0.55;
      em.put('bayBox', f, sc, y + 0.72, 0, w + 0.3, 1.95, d / 0.6, shade(wash, 0.97));
      em.win(f, sc, sill, w, wh, wash, d);
      // side lights on the box's flanks
      for (const side of [-1, 1] as const) {
        const at = f.o.clone().addScaledVector(f.u, sc + side * (w + 0.3) / 2).addScaledVector(f.n, d / 2 + em.zOff).setY(sill);
        const n = f.u.clone().multiplyScalar(side);
        em.win(f, 0, sill, 0.34, wh, wash, 0.012, false, 0, n, new Vector3().crossVectors(up, n), at);
      }
      em.put('ledge', f, sc, y + 2.7, d - 0.15, w + 0.6, 1, 1.1);
      if (small && rng.chance(0.4 * dens)) em.put('plant', f, sc + rng.range(-w / 2, w / 2), y + 2.75, d - 0.1, 1, 1, 1);
      break;
    }
    case 'gallery': {
      // a veranda's back wall: a lit door between red couplets, a lattice window
      em.win(f, sc - bw * 0.2, y + 0.05, 1.0, 2.2, wash, 0, true, 0.25);
      em.win(f, sc + bw * 0.2, sill, 1.4, wh, wash, 0, false, 0.2);
      if (rng.chance(0.3 + 0.5 * em.timber)) for (const k of [-1, 1]) em.put('couplet', f, sc - bw * 0.2 + k * 0.72, y + 0.55, 0, 1, 1, 1);
      if (small && rng.chance(0.3)) em.put('plant', f, sc + rng.range(-0.4, 0.8), y + 0.02, 0.35, 1.1, 1.3, 1);
      return [];
    }
    default:
      break;
  }
  // the window modules: glass, hoods, sills, cages, the extras
  const caged = m === 'cage1' || m === 'cage2';
  for (const wi of wins) {
    em.win(f, wi.s, sill, wi.w, wh, wash);
    if (caged) {
      const wide = wi.w > 1.6;
      em.put(wide ? 'cageW' : 'cageS', f, wi.s, sill - 0.12, 0, (wi.w + 0.25) / (wide ? CAGE_W[1] : CAGE_W[0]), rng.range(0.95, 1.05), rng.range(0.9, 1.25), shade(0xffffff, rng.range(0.8, 1.1)));
      if (small && rng.chance(0.65 * dens)) em.put('plant', f, wi.s + rng.range(-0.3, 0.3), sill - 0.06, 0.1, 0.8, 0.8, 0.8);
      if (small && rng.chance(0.18 * dens)) em.put('laundryOut', f, wi.s + wi.w / 2 - 0.1, sill + 1.72, 0.5, 1, 1, 1);
      continue;
    }
    if (m !== 'bay') {
      if (rng.chance(0.4)) em.put('ledge', f, wi.s, sill - 0.1, 0, wi.w + 0.3, 1, 0.7);
      if (rng.chance(0.3)) em.put('ledge', f, wi.s, sill + wh + 0.12, 0, wi.w + 0.4, 1, 1.2);
      if (small && rng.chance(0.14 * dens)) {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) em.put('plant', f, wi.s + rng.range(-wi.w / 2, wi.w / 2), sill - 0.02, 0.05, 0.75, rng.range(0.7, 1.1), 0.75);
      }
      if (rng.chance(0.12 * dens)) em.put('awning', f, wi.s, sill + wh + 0.35, 0, wi.w + 0.3, 0.8, 0.8, rng.pick(AWN));
      // a little glazed hood over the window now and then (the targets' tiled eaves on every storey)
      else if (rng.chance(0.14)) em.put('eave', f, wi.s, sill + wh + 0.5, 0, wi.w + 0.6, 0.55, 0.5, rng.chance(0.75) ? PAL.malachite : PAL.azurite);
      if (small && rng.chance(0.16 * dens)) em.put('laundryOut', f, wi.s + (rng.chance(0.5) ? -1 : 1) * (wi.w / 2 + 0.1), sill + wh + 0.2, 0, 1, 1, 1);
    }
  }
  // AC units: under a window, beside it, or high up; the ones high on the cell leave a drip stain under them
  const acN = m === 'ac' ? 2 : rng.chance(0.42 * dens) ? 1 : 0;
  for (let i = 0; i < acN; i++) {
    const wi = wins[i % Math.max(1, wins.length)];
    const ws = wi?.s ?? sc, ww = wi?.w ?? 1.2;
    const where = rng.int(0, 2);
    let s: number, yy: number;
    if (where === 0) { s = ws + rng.range(-ww / 2 + 0.45, ww / 2 - 0.45); yy = y + 0.28; }
    else if (where === 1) { s = ws + (rng.chance(0.5) ? -1 : 1) * (ww / 2 + 0.6); yy = y + rng.range(1.1, 1.8); }
    else { s = ws + rng.range(-ww / 2, ww / 2); yy = y + 2.5; }
    if (m === 'bay' && where === 0) yy = y + 0.1;
    s = Math.max(0.5, Math.min(sc + bw / 2 - 0.5, s));
    em.put('acUnit', f, s, yy, caged && where !== 1 ? 0.52 : 0, 1, 1, 1, shade(0xffffff, rng.range(0.86, 1.03)));
    if (yy > y + 1) { cell.stainX = s - (sc - bw / 2); cell.stain = rng.range(0.5, 1); }
  }
  if (small && rng.chance(0.05 * dens)) em.put('dish', f, sc + rng.range(-1.5, 1.5), y + 2.3, 0, 1, 1, 1);
  // lit sign boxes on the low floors (blade signs out from the wall; the lead fills the slots with real calligraphy)
  const lowFloor = y - street;
  if (lowFloor >= fh && lowFloor <= fh * 5 && rng.chance(0.14 * dens)) {
    const col = rng.pick(NEONS);
    const s = sc + rng.range(-bw / 2 + 0.4, bw / 2 - 0.4);
    const yy = y + rng.range(0.4, 1.2);
    em.put('signBox', f, s, yy, 0, 1, rng.range(0.9, 1.5), 1, col);
    em.sign({ at: f.o.clone().addScaledVector(f.u, s).addScaledVector(f.n, 0.62).setY(yy + 0.6), normal: f.u.clone(), size: 0.5, color: col, blade: true });
    cell.spill = 1;
    cell.spillC = col;
  }
  return wins;
}

/**
 * E281 round 2, the near faces' depth: what projects off a cell of the lower floors, from the clutter stream. On a
 * window: a security cage round it, an AC unit or two (stacked, on brackets), a bamboo laundry pole straight out, an
 * awning; now and then a shallow hung balcony across the cell with the wash on it. On a balcony: the wash along it,
 * pot plants, an AC on its side wall. A drain pipe down the middle of some cells.
 */
function clutter(em: Emit, f: Face, cell: Cell, wins: Win[], sc: number, y: number, bw: number, fh: number, fi: number, timber: boolean): void {
  const rx = em.rx;
  const m = cell.mod;
  const sill = y + 0.85;
  if (m === 'balcony' || m === 'balconySolid') {
    if (rx.chance(0.45)) em.put('laundryAlong', f, sc + rx.range(-0.3, 0.3), y + 2.3, 0.35, (bw - 0.8) * 0.8, 1, 1.25);
    for (let i = rx.int(0, 2); i > 0; i--) em.put('plant', f, sc + rx.range(-bw * 0.4, bw * 0.4), y + 0.02, rx.range(0.7, 1.15), rx.range(0.9, 1.3), rx.range(0.9, 1.5), 1);
    if (rx.chance(0.3)) em.put('acUnit', f, sc - bw * 0.46 + 0.5, y + rx.range(1.6, 2.1), 0.05, 1, 1, 1, shade(0xffffff, rx.range(0.86, 1.02)));
    return;
  }
  if (!(m === 'win1' || m === 'win2' || m === 'win3' || m === 'blank' || m === 'ac' || m === 'bay')) return;
  // a shallow balcony hung across the whole cell (not on the ground floor), its rail and the wash
  if (fi > 0 && m !== 'bay' && rx.chance(0.18)) {
    em.put(timber ? 'balconyTimber' : 'balcony', f, sc, y + 0.02, 0, (bw - 0.3) / BALCONY_W, 1, rx.range(0.9, 1.35), shade(0xffffff, rx.range(0.92, 1.04)));
    if (rx.chance(0.6)) em.put('laundryAlong', f, sc, y + 2.3, 0.4, (bw - 0.8) * 0.85, 1, 1.2);
    if (rx.chance(0.5)) em.put('plant', f, sc + rx.range(-bw * 0.35, bw * 0.35), y + 0.02, rx.range(0.7, 1.1), 1, rx.range(0.9, 1.4), 1);
    return;
  }
  for (const wi of wins) {
    const caged = m === 'bay' ? true : rx.chance(0.45);
    if (caged && m !== 'bay') {
      const wide = wi.w > 1.6;
      em.put(wide ? 'cageW' : 'cageS', f, wi.s, sill - 0.12, 0, (wi.w + 0.25) / (wide ? CAGE_W[1] : CAGE_W[0]), rx.range(0.95, 1.08), rx.range(1.0, 1.5), shade(0xffffff, rx.range(0.8, 1.1)));
      if (rx.chance(0.6)) em.put('plant', f, wi.s + rx.range(-0.3, 0.3), sill - 0.06, 0.15, 0.8, 0.8, 0.8);
    }
    const out = caged && m !== 'bay' ? 0.62 : 0;
    // AC units: one under the window or two stacked beside it
    const acR = rx.next();
    if (acR < 0.34) em.put('acUnit', f, wi.s + rx.range(-0.2, 0.2), y + 0.25, out, 1, 1, 1, shade(0xffffff, rx.range(0.86, 1.03)));
    else if (acR < 0.54) {
      const sgn = rx.chance(0.5) ? -1 : 1;
      const s = wi.s + sgn * (wi.w / 2 + 0.55);
      if (Math.abs(s - sc) < bw / 2 - 0.4) for (const dy of [0.5, 1.35]) em.put('acUnit', f, s, y + dy, 0, 1, 1, 1, shade(0xffffff, rx.range(0.86, 1.03)));
    }
    // a bamboo pole straight out with the wash on it
    if (rx.chance(0.26)) em.put('laundryOut', f, wi.s + (rx.chance(0.5) ? -1 : 1) * (wi.w / 2 + 0.05), sill + 1.75, out, 1, 1, rx.range(0.9, 1.25));
    // a striped awning over it
    if (!caged && rx.chance(0.14)) em.put('awning', f, wi.s, sill + 1.95, 0, wi.w + 0.35, 0.85, rx.range(0.8, 1.1), rx.pick(AWN));
  }
  // a drain pipe down the middle of the cell
  if (rx.chance(0.12)) em.put('pipe', f, sc + rx.range(-0.2, 0.2), y, 0, 1, fh, 1, rx.chance(0.3) ? PAL.rust : PAL.pipe);
}

/** the cell mods a flat sign may cover (nothing standing out past its 0.65 m) */
const FLAT_OK = new Set<Mod>(['win1', 'win2', 'win3', 'blank', 'ac', 'cage1', 'cage2', 'bay']);
/** the cell mods a blade may stand out between (no gallery, add-on room or shop canopy in its way) */
const BLADE_BAD = new Set<Mod>(['gallery', 'addon', 'shop', 'enclosed']);

function tallSigns(em: Emit, f: Face, plan: Cell[][], bays: number, bw: number, floors: number, fh: number, street: number,
  galleryFloor: boolean[], rng: Rng, off: (fi: number, b: number) => number): void {
  const dens = em.dens;
  for (let fi = 0; fi < floors - 1; fi++) {
    const y = f.y0 + fi * fh;
    const over = (y - street) / fh;
    if (over < 1.5 || over > 14) continue;
    for (let b = 0; b <= bays; b++) {
      const r = rng.next();
      if (r < 0.028 * dens && b < bays) {
        // flat on the wall over this cell and the one above
        const m0 = plan[fi]?.[b]?.mod, m1 = plan[fi + 1]?.[b]?.mod;
        if (m0 === undefined || m1 === undefined || !FLAT_OK.has(m0) || !FLAT_OK.has(m1)) continue;
        const col = rng.pick(NEONS);
        em.sign({ at: f.o.clone().addScaledVector(f.u, (b + 0.5) * bw + rng.range(-0.4, 0.4)).addScaledVector(f.n, 0.66 + Math.max(off(fi, b), off(fi + 1, b))).setY(y + fh * rng.range(0.9, 1.2)),
          normal: f.n.clone(), size: rng.range(0.95, 1.2), color: col, blade: true });
      } else if (r < 0.052 * dens && b > 0 && b < bays) {
        // a blade at the seam of bays b-1 | b, out from the wall on two arms
        if (galleryFloor[fi] === true || galleryFloor[fi + 1] === true) continue;
        const ms = [plan[fi]?.[b - 1]?.mod, plan[fi]?.[b]?.mod, plan[fi + 1]?.[b - 1]?.mod, plan[fi + 1]?.[b]?.mod];
        if (ms.some((m) => m === undefined || BLADE_BAD.has(m))) continue;
        const col = rng.pick(NEONS);
        const size = rng.range(0.8, 1.2);
        const out = 0.95 + size * 0.68;
        const yc = y + fh * rng.range(0.8, 1.3);
        const ext = Math.max(off(fi, b - 1), off(fi, b), off(fi + 1, b - 1), off(fi + 1, b));
        em.sign({ at: f.o.clone().addScaledVector(f.u, b * bw).addScaledVector(f.n, out + ext).setY(yc), normal: f.u.clone(), size, color: col, blade: true });
        for (const dy of [0.7, -0.7]) em.put('box', f, b * bw, yc + dy * size, 0, 0.06, 0.06, out + ext - size * 0.6, 0x3a3d44);
      }
    }
  }
}

/** a room hung off the wall: a box `bs` bays wide and `fs` floors tall, its own windows, AC units and a tin lean-to */
function addon(em: Emit, f: Face, s0: number, w: number, y: number, fs: number, fh: number, depth: number, rng: Rng): void {
  const o = em.out.shell;
  const h = fs * fh - 0.2;
  const tin = rng.chance(0.5);
  const aw = tin ? rng.pick([0x9ea3a6, 0x8f9aa0, 0xa8a196, 0x9a8f80]) : shade(rng.pick(WALLS), rng.range(0.92, 1.02));
  const look: Look = tin ? { wash: aw, kind: K.slats, p1: rng.pick([0.2, 0.32]), line: 1 } : { wash: aw, kind: K.tiles, line: 1 };
  const c = f.o.clone().addScaledVector(f.u, s0 + w / 2).addScaledVector(f.n, depth / 2 + em.zOff).setY(y + 0.1 + h / 2);
  o.boxAxes(c, f.u, up, f.n, w / 2 - 0.12, h / 2, depth / 2, look, { sides: 1 | 2 | 4, top: { wash: shade(aw, 0.9), line: 1.2 }, bottom: { wash: shade(aw, 0.62), line: 1.2 } });
  // a lean-to tin roof over it
  const r0 = f.o.clone().addScaledVector(f.u, s0 + 0.02).addScaledVector(f.n, em.zOff).setY(y + 0.1 + h + 0.35);
  const r1 = r0.clone().addScaledVector(f.u, w - 0.04);
  const r2 = r1.clone().addScaledVector(f.n, depth + 0.3).setY(y + 0.1 + h + 0.02);
  const r3 = r0.clone().addScaledVector(f.n, depth + 0.3).setY(y + 0.1 + h + 0.02);
  o.quad4(r3, r2, r1, r0, w - 0.04, Math.hypot(depth + 0.3, 0.33), { wash: rng.chance(0.3) ? PAL.malachite : 0x8a8f94, kind: rng.chance(0.3) ? K.tiles : K.slats, p1: 0.2, line: 1 });
  o.quad4(r0, r1, r2, r3, w - 0.04, Math.hypot(depth + 0.3, 0.33), { wash: 0x5a5f66, line: 0.8 });
  for (let fi = 0; fi < fs; fi++) {
    const yy = y + fi * fh;
    const n = Math.max(1, Math.floor(w / 1.7));
    for (let i = 0; i < n; i++) {
      const sc = s0 + ((i + 0.5) * w) / n;
      em.win(f, sc, yy + 0.85, Math.min(1.5, w / n - 0.3), 1.5, aw, depth, false, 0.05);
      if (rng.chance(0.3 * em.dens)) em.put('acUnit', f, sc + rng.range(-0.3, 0.3), yy + 0.25, depth, 1, 1, 1, shade(0xffffff, rng.range(0.86, 1)));
      if (em.lod === 0 && rng.chance(0.15 * em.dens)) em.put('laundryOut', f, sc + 0.6, yy + 2.5, depth, 1, 1, 1);
    }
  }
}

function gallery(em: Emit, f: Face, y: number, fh: number, bays: number, bw: number, wash: number, rng: Rng, small: boolean): void {
  const o = em.out.shell;
  const D = rng.range(1.8, 2.4);
  const c = f.o.clone().addScaledVector(f.u, f.len / 2).addScaledVector(f.n, D / 2).setY(y - 0.1);
  o.boxAxes(c, f.u, up, f.n, f.len / 2, 0.1, D / 2, { wash: shade(wash, 0.98), line: 1.8 }, { bottom: { wash: shade(wash, 0.7), line: 1 } });
  // a lattice railing of real bars along the edge (instanced, a metre a piece so the lattice keeps its pitch), posts
  // at every seam
  const timber = rng.chance(em.timber);
  const nR = Math.max(1, Math.round(f.len));
  for (let i = 0; i < nR; i++) em.put('rail', f, ((i + 0.5) * f.len) / nR, y, D - 0.05, f.len / nR, 1, 1, timber ? PAL.timber : PAL.rail);
  const red = timber || rng.chance(0.4);
  for (let k = 0; k <= bays; k++) em.put('post', f, Math.min(f.len - 0.12, Math.max(0.12, k * bw)), y, D - 0.15, 1, fh - 0.1, 1, red ? 0xffffff : 0x9a9a92);
  if (rng.chance(0.6 + 0.4 * em.timber)) for (let k = 0; k < bays; k++) em.put('eave', f, (k + 0.5) * bw, y + fh - 0.12, 0, bw, 1, 1, rng.chance(0.8) ? PAL.malachite : PAL.azurite);
  // red lanterns hung along the veranda's edge, a lamp by some doors
  for (let k = 0; k < bays; k++) {
    if (rng.chance(0.4 + 0.5 * em.timber)) em.put('lantern', f, (k + rng.range(0.3, 0.7)) * bw, y + fh - 0.3, D - 0.35, 1, 1, 1);
    if (small && rng.chance(0.45)) em.put('laundryAlong', f, (k + 0.5) * bw, y + 2.3, D - 1.1, bw * 0.7, 1, 1);
  }
}

function roofClutter(em: Emit, x0: number, x1: number, z0: number, z1: number, y: number, top: boolean, rng: Rng,
  toWorld: (x: number, y: number, z: number) => Vector3, dirW: (x: number, z: number) => Vector3): void {
  const put = (piece: PieceId, lx: number, lz: number, s: Vector3, c: number, turn = 0): void => {
    const nn = dirW(Math.sin(turn), Math.cos(turn)), uu = new Vector3().crossVectors(up, nn);
    const m = new Matrix4().makeBasis(uu, up, nn).scale(s).setPosition(toWorld(lx, y, lz));
    em.out.pieces.push({ piece, m, c: new Color(c) });
  };
  const w = x1 - x0, d = z1 - z0;
  const rx = (): number => rng.range(x0 + 2, x1 - 2), rz = (): number => rng.range(z0 + 2, z1 - 2);
  if (!top) {
    // a terrace: planters along the edge and a tank
    if (em.lod === 0) for (let i = 0; i < rng.int(1, 3); i++) put('planter', rx(), z1 - 0.6, new Vector3(1.4, 1, 1), 0xffffff, Math.PI);
    if (rng.chance(0.6)) put('tank', rx(), rz(), new Vector3(1, 1, 1), rng.pick([0xffffff, PAL.tankBlue, PAL.tankGrey]));
    return;
  }
  // the roofscape: tanks, 1–3 shacks under glazed roofs, a forest of antennas, dishes (the skyline the street sees)
  const area = w * d;
  const nT = rng.int(1, 2 + Math.round(area / 110));
  for (let i = 0; i < nT; i++) put('tank', rx(), rz(), new Vector3(1, rng.range(0.9, 1.4), 1), rng.pick([0xffffff, PAL.tankBlue, PAL.tankGrey, 0xdcd6c8]));
  const nS = rng.int(1, area > 200 ? 3 : 2);
  for (let i = 0; i < nS; i++) put(rng.chance(0.65) ? 'shackG' : 'shackB', rx(), rz(), new Vector3(rng.range(0.9, 1.4), rng.range(0.9, 1.2), rng.range(0.9, 1.3)), 0xffffff, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
  const nA = rng.int(3, 9);
  for (let i = 0; i < nA; i++) put('antenna', rx(), rz(), new Vector3(1, rng.range(3, 12), 1), 0xffffff, rng.range(0, 3));
  for (let i = 0; i < rng.int(1, 4); i++) put('dish', rx(), rz(), new Vector3(1.6, 1.6, 1.6), 0xffffff, rng.range(0, 6));
  // a rooftop room on some: a box with lit windows under a glazed hip roof (a bigger shack)
  if (rng.chance(0.4)) put(rng.chance(0.5) ? 'shackG' : 'shackB', rx(), rz(), new Vector3(2.2, 1.3, 1.8), 0xffffff, rng.pick([0, Math.PI / 2]));
}

/**
 * What is strung ACROSS a street or a Well between two facing walls (the canyon's ceiling of clutter): a sagging
 * bundle of cables, a laundry line with the wash on it, or a string of red lanterns. a / b are the two anchor points.
 */
export function spanStreet(d: Dressing, a: Vector3, b: Vector3, seed: number): void {
  const rng = Rng.scrambled(seed);
  const kind = rng.weighted<'cables' | 'laundry' | 'lanterns'>([['cables', 0.62], ['laundry', 0.16], ['lanterns', 0.22]]);
  const dropM = a.distanceTo(b) * rng.range(0.04, 0.09);
  const side = new Vector3().subVectors(b, a).cross(up).normalize();
  if (kind === 'cables') {
    const n = rng.int(2, 6);
    for (let j = 0; j < n; j++) {
      const off = side.clone().multiplyScalar(rng.range(-0.4, 0.4));
      sag(d.shell, a.clone().add(off).add(new Vector3(0, j * 0.12, 0)), b.clone().add(off).add(new Vector3(0, rng.range(-0.5, 0.5), 0)), dropM * rng.range(0.8, 1.3), side, rng.range(0.025, 0.05));
    }
    return;
  }
  sag(d.shell, a, b, dropM, side, 0.03);
  const L = a.distanceTo(b);
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -dropM * 4 * t * (1 - t), 0));
  if (kind === 'lanterns') {
    for (let t = rng.range(0.05, 0.12); t < 0.95; t += rng.range(0.08, 0.14)) {
      const p = at(t);
      d.pieces.push({ piece: 'lantern', m: new Matrix4().makeBasis(side, up, new Vector3().crossVectors(side, up)).setPosition(p), c: new Color(0xffffff) });
    }
    return;
  }
  // laundry: the wash in ~1 m runs along the line, each dropped onto the curve
  const dir = new Vector3().subVectors(b, a).normalize();
  const nrm = new Vector3().crossVectors(dir, up).normalize();
  for (let x = 0.6; x < L - 0.6; x += rng.range(1.0, 2.6)) {
    if (rng.chance(0.3)) continue;
    const p = at(x / L);
    const m = new Matrix4().makeBasis(dir, up, nrm).scale(new Vector3(rng.range(0.9, 1.1), 1, 1)).setPosition(p);
    d.pieces.push({ piece: 'washLine', m, c: new Color(0xffffff) });
  }
}
