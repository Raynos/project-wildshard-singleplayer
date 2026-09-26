// The Yamen Well's lower levels, dressed (dome D2, E169): what makes the view down the shaft layered — on top of the
// gallery bands (well-galleries.ts via the plan) every floor below SPLIT gets its own projections and its life, so the
// canyon's walls never read as a stack of flat decks, and the open gap NARROWS with depth (mockup D):
//   blocks     whole rooms built out in front of the galleries over one to three floors, deeper the lower they sit
//              (1.5 m near the top, 5–6 m at the bottom): lit window rows on their faces (the kit's facade program,
//              plus a few interior-mapped rooms), a roof with a tank or an air-con, struts under the overhang,
//   pods       single rooms cantilevered past the gallery front on steel struts, lit windows, a tin or glazed roof,
//   verandas   red-railed timber platforms thrust further into the shaft, some half a floor up a short stair (the
//              odd heights that give the view down its depth cues), people and plants on them,
//   stairs     switchback stair towers hung on the fronts (real steps near the top, ruled slabs further down),
//   shops      the street floors (every 15 m) lined with lit shopfronts, awnings, box signs and a crowd,
//   life       lanterns under every deck lip, people at the rails, laundry, plants, cages and air-con on the bare
//              wall, neon blade signs facing the rim, thick drain pipes and horizontal service runs.
// TRIANGLE FREEZE: everything is merged into the band's own kits (one draw per band, culled with it); the people are
// ~60-tri kit figures, the lanterns ~40-tri kit ones (their light is a baked emitter, not the 348-tri paper mesh
// every view draws), plants / air-con / cages / tanks are kit boxes, not the always-drawn instanced pieces.
import { Color, IcosahedronGeometry, Matrix4, Vector3, Vector4 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import { NEONS, WORDS } from './towers';
import { Y0 } from '../layout';
import { Rng } from '../util';
import { FLOOR_H, type GalleryKits, type GalleryProfile } from './well-galleries';

const UP = new Vector3(0, 1, 0);
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const ICO = Array.from(new IcosahedronGeometry(1, 0).getAttribute('position').array);

const COATS = [0x1f2126, 0x2a2c31, 0x33363e, 0x3b3f4a, 0x283044, 0x4a4336, 0x5a3a33, 0x55585f, 0x6b6f78] as const;
const BROLLY = [0x1d1f25, 0x1d1f25, 0x2a2c31, 0x9a2e1c, 0xb07a34, 0x1d1f25, 0x2e3a4e] as const;
const WARM = [0xffc98a, 0xffbf78, 0xffd6a2, 0xf6b070, 0xffcd96] as const;
const POD_WALL = [0x8a8378, 0x7c7f86, 0x9a9690, 0x6f5a46, 0x7e8a86, 0x8e8272, 0x6d7a8c] as const;
const BLOCK_WALL = [0x8d96a3, 0x838c9b, 0x979b9e, 0x7f8794, 0x978d80, 0x8a9390, 0x9e9a92, 0x8f8478] as const;
const ROOF = [0x5c6168, 0x6f747c, 0x7c6a58, 0x5a5f66, 0x6a6e76, 0x2f8a6a, 0x7c6a58, 0x4f5a66] as const;
const CLOTHES = [0xeceae2, 0x6f9ccf, 0xc23b22, 0xd9a441, 0xe8dfc9, 0x2e5fa3, 0x7fbf9a] as const;
const STEEL: Look = { wash: 0x2a2c31, line: 0.9 };
const RED_RAIL: Look = { wash: 0x8e2c1f, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer };
const RED_POST: Look = { wash: 0x9c3627, line: 1, accent: true, surf: SURF.lacquer };
const RAIL_TOP: Look = { wash: 0x2a2320, line: 0.8 };
const DECK: Look = { wash: 0x564a40, line: 1.8, surf: SURF.wood };
const DECK_TOP: Look = { wash: 0x6b635b, line: 0, wet: 0.45, surf: SURF.wood };
const LANTERN: Look = { wash: 0xff5236, emit: 1.45, line: 0.6, accent: true };
const LEAF: Look = { wash: 0x3d7d4c, kind: K.leaf, line: 0, accent: true };

/** the level's share of the dressing: 1 at the top of the lower levels, thinning toward the bottom */
export function density(y: number, yTop: number, yLow: number): number {
  const t = Math.min(1, Math.max(0, (yTop - y) / Math.max(yTop - yLow, 1)));
  return 1 - 0.5 * t;
}

/** an interior-mapped window or door (the facade batch: lit rooms, curtains, frames) — `at` is its bottom centre */
export function lowWin(ctx: Ctx, rng: Rng, at: Vector3, u: Vector3, n: Vector3, w: number, h: number, wall: number, door: boolean, litP: number): void {
  const m = new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w, h, 1)).setPosition(at.clone().addScaledVector(n, 0.02));
  const lit = rng.chance(litP) ? rng.range(0.85, 1.2) : 0;
  const style = rng.int(0, 3) + (rng.chance(0.4) ? 4 : 0) + (door ? 16 : 0);
  ctx.fd.windows.push({ m, win: new Vector4(rng.range(0, 97), lit, rng.chance(0.35) ? rng.range(0.2, 0.6) : 0, style), wall: new Color(wall), light: new Color(rng.pick(WARM)) });
}

/** a low-poly figure (~60 tris) for the levels below the rim: coat, legs, head, often an umbrella; faces `face` */
export function figure(k: Kit, rng: Rng, p: Vector3, face: Vector3, s = 1): void {
  const coat: Look = { wash: rng.pick(COATS), line: 0 };
  const f = face.clone().setY(0).normalize();
  const rot = Math.atan2(f.x, f.z);
  k.box(p.x, p.y, p.z, 0.3 * s, 0.62 * s, 0.2 * s, { wash: 0x1b1c20, line: 0 }, { rotY: rot, top: null, bottom: null });
  k.cyl(p.x, p.y + 0.55 * s, p.z, 0.21 * s, 0.16 * s, 0.9 * s, 6, coat, { caps: false, edges: E.none });
  k.cyl(p.x, p.y + 1.45 * s, p.z, 0.1 * s, 0.085 * s, 0.22 * s, 5, { wash: rng.chance(0.25) ? 0xb89a62 : 0xc9a58a, line: 0 }, { edges: E.none });
  if (rng.chance(0.55)) {
    const hx = p.x + f.z * 0.18 * s, hz = p.z - f.x * 0.18 * s;
    k.cyl(hx, p.y + 1.78 * s, hz, 0.56 * s, 0.03, 0.26 * s, 7, { wash: rng.pick(BROLLY), kind: K.cloth, row: 0, col: 0.2, line: 0.8, accent: true }, { edges: E.v0 });
  } else if (rng.chance(0.3)) {
    k.cyl(p.x, p.y + 1.64 * s, p.z, 0.3 * s, 0.02, 0.13 * s, 7, { wash: 0xb89a62, line: 0.6, accent: true }, { edges: E.v0 });
  }
}

/** a paper lantern in the kit (~40 tris, emissive) hanging from y */
export function kitLantern(k: Kit, x: number, y: number, z: number, s = 1): void {
  k.cyl(x, y - 0.5 * s, z, 0.2 * s, 0.2 * s, 0.4 * s, 6, LANTERN, { edges: E.none });
  k.cyl(x, y - 0.1 * s, z, 0.08 * s, 0.08 * s, 0.1 * s, 4, { wash: 0xc9a24a, line: 0.5, accent: true }, { caps: false, edges: E.none });
}

/** a kit lantern that also lights its pool (a baked emitter: the light volume and the vertex spill, no mesh cost) */
export function litLantern(ctx: Ctx, k: Kit, p: Vector3, s: number, glow: boolean): void {
  kitLantern(k, p.x, p.y, p.z, s);
  if (glow) ctx.emitters.push({ at: new Vector3(p.x, p.y - 0.3 * s, p.z), color: new Color(0xff5a3a), w: 0.5, h: 0.5, power: 0.18, spill: 0.12 });
}

/** a potted plant in the kit (~30 tris) */
export function kitPlant(k: Kit, p: Vector3, s = 1): void {
  k.cyl(p.x, p.y, p.z, 0.17 * s, 0.21 * s, 0.3 * s, 5, { wash: 0xa4532e, line: 1, accent: true }, { caps: false });
  k.blob(ICO, null, p.x, p.y + 0.52 * s, p.z, 0.36 * s, 0.34 * s, 0.36 * s, LEAF, true);
}

/** an air-con unit in the kit (a box on the wall, its grille painted: 10 tris) */
function kitAC(k: Kit, P: GalleryProfile, uu: number, y: number, d: number): void {
  k.boxAxes(P.world(uu, y + 0.28, d + 0.17), P.u, UP, P.wall.n, 0.41, 0.28, 0.17, { wash: 0xb7bbc0, kind: K.panel, line: 1 }, { bottom: null, sides: 1 | 2 | 4 });
}

/** a window cage on the wall (bars painted on a box: 10 tris) */
function kitCage(k: Kit, P: GalleryProfile, uu: number, y: number, d: number): void {
  k.boxAxes(P.world(uu, y + 0.95, d + 0.28), P.u, UP, P.wall.n, 0.52, 0.95, 0.28, { wash: 0x3a3d44, kind: K.bars, row: 1, col: 0.1, line: 1 }, { bottom: null, sides: 1 | 2 | 4, top: { wash: 0x565a61, line: 1 } });
}

/** a laundry pole out from the wall with a few things pegged on (18 tris) */
function kitPole(k: Kit, rng: Rng, P: GalleryProfile, uu: number, y: number, d: number, len: number): void {
  const a = P.world(uu, y, d), b = P.world(uu, y + 0.05, d + len);
  k.beam(a, b, 0.035, 0.035, { wash: 0x8a7a55, line: 0.6 });
  for (let t = 0.2; t < 0.9; t += rng.range(0.25, 0.4)) {
    const p = a.clone().lerp(b, t);
    const h = rng.range(0.45, 0.9);
    k.quad(p.clone().add(new Vector3(0, -h, 0)), P.wall.n, UP, rng.range(0.3, 0.5), h, { wash: rng.pick(CLOTHES), kind: K.cloth, row: rng.chance(0.3) ? 1 : 0, col: 0.1, line: 0.6, accent: true });
  }
}

/** a laundry line strung along a front from a to b (a wire and 3–5 pieces) */
function kitLine(k: Kit, rng: Rng, a: Vector3, b: Vector3): void {
  const L = a.distanceTo(b);
  if (L < 0.8) return;
  const sag = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -L * 0.24 * t * (1 - t), 0));
  for (let i = 0; i < 3; i++) k.beam(sag(i / 3), sag((i + 1) / 3), 0.015, 0.015, { wash: 0x2a2c31, line: 0.4 });
  const d = new Vector3().subVectors(b, a).setY(0).normalize();
  for (let t = rng.range(0.05, 0.15); t < 0.88;) {
    const w = rng.range(0.4, 0.9), h = rng.range(0.5, 1.0);
    k.quad(sag(t).add(new Vector3(0, -h, 0)), d, UP, w, h, { wash: rng.pick(CLOTHES), kind: K.cloth, row: rng.chance(0.3) ? 1 : 0, col: 0.12, line: 0.7, accent: true });
    t += (w + rng.range(0.1, 0.35)) / L;
  }
}

/** a water tank on its stand (~40 tris) */
function kitTank(k: Kit, p: Vector3, s: number): void {
  k.box(p.x, p.y, p.z, 1.3 * s, 0.7 * s, 1.3 * s, { wash: 0x3a3d44, line: 1 }, { bottom: null });
  k.cyl(p.x, p.y + 0.7 * s, p.z, 0.8 * s, 0.8 * s, 1.5 * s, 8, { wash: 0x8e969e, line: 1 }, { edges: E.rims });
}

/** something on a roof: a tank, an air-con, a pot, junk */
function roofThing(k: Kit, rng: Rng, P: GalleryProfile, ua: number, ub: number, top: number, d0: number, d1: number): void {
  const W = ub - ua, r = rng.next();
  if (r < 0.3 && W > 2.2) kitTank(k, P.world(ua + rng.range(0.9, W - 0.9), top, (d0 + d1) / 2), rng.range(0.6, 0.85));
  else if (r < 0.55) kitAC(k, P, ua + rng.range(0.6, W - 0.6), top, d0 + 0.05);
  else if (r < 0.75) kitPlant(k, P.world(ua + rng.range(0.5, W - 0.5), top, d1 - 0.35), rng.range(1, 1.5));
  else if (r < 0.9) {
    const p = P.world(ua + rng.range(0.5, W - 0.5), top, (d0 + d1) / 2);
    k.box(p.x, p.y, p.z, 0.6, 0.45, 0.5, { wash: rng.pick([0x8a6a3a, 0x9a9690, 0x6f8fb5]), line: 1, accent: true }, { bottom: null });
  }
}

/** a red lacquered railing panel from a to b on a deck at a.y (posts at both ends) */
function redRail(k: Kit, a: Vector3, b: Vector3, posts = true): void {
  const d = new Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 0.2) return;
  d.divideScalar(len);
  const side = new Vector3().crossVectors(d, UP).normalize();
  const c = a.clone().add(b).multiplyScalar(0.5);
  k.boxAxes(c.clone().setY(a.y + 0.5), d, UP, side, len / 2, 0.36, 0.035, RED_RAIL, { bottom: null });
  k.boxAxes(c.clone().setY(a.y + 1.0), d, UP, side, len / 2 + 0.05, 0.05, 0.07, RAIL_TOP, { bottom: null });
  if (posts) for (const p of [a, b]) k.boxAxes(p.clone().setY(a.y + 0.55), d, UP, side, 0.07, 0.55, 0.07, RED_POST, { bottom: null });
}

/** one stair flight from (u0, y) climbing `rise` along u·dir over `run`, `w` wide, centred `dOut` off the wall: real
 *  steps (`steps` > 0) or a ruled slab (far down) */
function flight(k: Kit, P: GalleryProfile, u0: number, y: number, rise: number, run: number, dir: number, dOut: number, w: number, steps: number): void {
  const ud = P.u.clone().multiplyScalar(dir);
  const nd = new Vector3().crossVectors(ud, UP);
  if (steps > 0) {
    const sr = rise / steps, tr = run / steps;
    const look: Look = { wash: 0x6b6d72, line: 1.8, surf: SURF.concrete };
    for (let i = 0; i < steps; i++) {
      const c = P.world(u0 + dir * (i + 0.5) * tr, y + (i + 0.5) * sr, dOut);
      k.boxAxes(c, ud, UP, nd, tr / 2 + 0.01, sr / 2, w / 2, look, { top: { wash: 0x5d5f65, line: 0 }, bottom: null, sides: 2 | 4 | 8 });
    }
  } else {
    // one sloped slab ruled across like treads
    const a = P.world(u0, y, dOut), b = P.world(u0 + dir * run, y + rise, dOut);
    const along = new Vector3().subVectors(b, a);
    const len = along.length();
    along.divideScalar(len);
    const up2 = new Vector3().crossVectors(nd, along).normalize();
    k.boxAxes(a.clone().lerp(b, 0.5), along, up2, nd, len / 2, 0.1, w / 2, { wash: 0x5d5f65, kind: K.tiles, row: 0.3, col: 99, line: 1 }, { sides: 4 | 8 });
  }
  const side = dOut + w / 2 + 0.02;
  const a = P.world(u0, y - 0.2, side), b = P.world(u0 + dir * run, y + rise - 0.2, side);
  k.beam(a.clone().add(new Vector3(0, 1.2, 0)), b.clone().add(new Vector3(0, 1.2, 0)), 0.05, 0.05, RAIL_TOP);
  if (steps > 0) {
    k.beam(a, b, 0.1, 0.24, { wash: 0x3a3d44, line: 1 });
    const mid = a.clone().lerp(b, 0.5);
    k.beam(mid, mid.clone().add(new Vector3(0, 1.2, 0)), 0.035, 0.035, RAIL_TOP);
  }
}

/** a switchback stair tower on a wall's front over floors [fi0, fi1], starting at u0, hung from depth d */
function stairTower(kit: (y: number) => Kit, P: GalleryProfile, fi0: number, fi1: number, u0: number, d: number, yReal: number): void {
  const run = 2.2, w = 0.95;
  const yTop = P.floors[fi0] ?? 0, yBot = P.floors[fi1] ?? 0;
  for (let fi = fi0; fi < fi1; fi++) {
    const y = P.floors[fi + 1];
    if (y === undefined) continue;
    const k = kit(y);
    const steps = y >= yReal ? 7 : 0;
    flight(k, P, u0, y, FLOOR_H / 2, run, 1, d + 0.1 + w / 2, w, steps);
    k.boxAxes(P.world(u0 + run + 0.55, y + FLOOR_H / 2 - 0.08, d + 0.1 + w), P.u, UP, P.wall.n, 0.55, 0.08, w, { wash: 0x5f6166, line: 1.8, surf: SURF.concrete }, { top: { wash: 0x55575c, line: 0 } });
    flight(k, P, u0 + run, y + FLOOR_H / 2, FLOOR_H / 2, run, -1, d + 0.1 + w * 1.5, w, steps);
  }
  const k = kit((yTop + yBot) / 2);
  for (const [uu, dd] of [[u0 - 0.05, d + 0.12], [u0 - 0.05, d + 0.1 + 2 * w], [u0 + run + 1.1, d + 0.12], [u0 + run + 1.1, d + 0.1 + 2 * w]] as const) {
    k.beam(P.world(uu, yBot - 0.4, dd), P.world(uu, yTop + 1.2, dd), 0.09, 0.09, STEEL);
  }
}

/**
 * A room (or a stack of rooms) built out in front of a gallery: u span [ua, ub], from d0 out to d1, floors y0 … y0 +
 * floors·3. Its faces run the kit's facade program (window rows per floor: lit rooms for 2 tris a face) with a few
 * interior-mapped rooms on the front; a roof with something on it; struts under the overhang.
 */
function block(ctx: Ctx, k: Kit, rng: Rng, P: GalleryProfile, ua: number, ub: number, y0: number, floors: number, d0: number, d1: number, litP: number): void {
  const n = P.wall.n, u = P.u;
  const W = ub - ua, D = d1 - d0, H = floors * FLOOR_H - 0.35;
  const wash = rng.pick(BLOCK_WALL);
  const seed = rng.range(0, 90);
  const vo = ((y0 - 0.25 - (Y0 % FLOOR_H)) % FLOOR_H + FLOOR_H) % FLOOR_H;
  const face = (a: Vector3, b: Vector3, L: number): void => {
    k.quad4(a, b, b.clone().setY(a.y + H), a.clone().setY(a.y + H), L, H, { wash, kind: K.facade, row: FLOOR_H, col: rng.pick([2.2, 2.6, 3.0]), seed, line: 1 }, a.dot(u), vo, E.all);
  };
  const yb = y0 - 0.25;
  // front, the two ends (facing along the canyon), the underside
  face(P.world(ua, yb, d1), P.world(ub, yb, d1), W);
  face(P.world(ub, yb, d1), P.world(ub, yb, d0), D);
  face(P.world(ua, yb, d0), P.world(ua, yb, d1), D);
  k.quad4(P.world(ua, yb, d0), P.world(ub, yb, d0), P.world(ub, yb, d1), P.world(ua, yb, d1), W, D, { wash: 0x3f3a35, line: 1 }, 0, 0, E.none);
  // a parapet roof, ruled like tin or tile, and a thing or two on it
  const top = yb + H;
  k.boxAxes(P.world((ua + ub) / 2, top + 0.08, (d0 + d1) / 2 + 0.1), u, UP, n, W / 2 + 0.15, 0.08, D / 2 + 0.15,
    { wash: 0x3a3d44, line: 1 }, { top: { wash: rng.pick(ROOF), kind: K.tiles, line: 1 }, bottom: null });
  roofThing(k, rng, P, ua, ub, top + 0.16, d0, d1);
  if (W > 3.4 && rng.chance(0.5)) roofThing(k, rng, P, ua, ub, top + 0.16, d0, d1);
  // lit rooms on the front (one per floor or two), a lantern or an awning, a strut pair under
  for (let f = 0; f < floors; f++) {
    const yy = y0 + f * FLOOR_H;
    const nw = rng.int(1, Math.max(1, Math.floor(W / 2.4)));
    for (let i = 0; i < nw; i++) lowWin(ctx, rng, P.world(ua + (i + 0.5) * (W / nw), yy + 0.8, d1 + 0.005), u, n, Math.min(1.4, W / nw - 0.4), 1.3, wash, false, litP);
    if (rng.chance(0.2)) ctx.put('awning', P.world(ua + rng.range(1, Math.max(1.01, W - 1)), yy + 2.2, d1 + 0.02), n.clone(), new Vector3(1.8, 1, 0.8), new Color(rng.pick([0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441])));
  }
  if (D > 1.2) for (const uu of [ua + 0.2, ub - 0.2]) k.beam(P.world(uu, yb - 0.05, d1 - 0.2), P.world(uu, yb - 2.0, Math.max(0.2, d0 - 0.2)), 0.1, 0.12, STEEL);
}

/** a room cantilevered out past a gallery front: u span [ua, ub], out from d0 to d1, its floor at y */
function pod(ctx: Ctx, k: Kit, rng: Rng, P: GalleryProfile, ua: number, ub: number, y: number, d0: number, d1: number, glow: boolean): void {
  const n = P.wall.n, u = P.u;
  const W = ub - ua, D = d1 - d0, H = 2.5;
  const wall = rng.pick(POD_WALL);
  const timber = rng.chance(0.45);
  const wallLook: Look = timber ? { wash: 0x6e5238, kind: K.panel, line: 1, surf: SURF.wood } : { wash: wall, kind: K.panel, line: 1 };
  k.boxAxes(P.world((ua + ub) / 2, y + H / 2 - 0.18, (d0 + d1) / 2), u, UP, n, W / 2, H / 2 + 0.18, D / 2, wallLook, { top: null, bottom: { wash: 0x3f3a35, line: 1 }, sides: 1 | 2 | 4 });
  const roof = rng.pick(ROOF);
  k.boxAxes(P.world((ua + ub) / 2, y + H + 0.06, (d0 + d1) / 2 + 0.12), u, UP, n, W / 2 + 0.18, 0.08, D / 2 + 0.2,
    { wash: 0x3a3d44, line: 1 }, { top: { wash: roof, kind: K.tiles, line: 1, accent: roof === 0x2f8a6a }, bottom: null });
  const bays = Math.max(1, Math.round(W / 1.4));
  for (let b = 0; b < bays; b++) {
    const uc = ua + (b + 0.5) * (W / bays);
    lowWin(ctx, rng, P.world(uc, y + 0.85, d1 + 0.005), u, n, Math.min(1.15, W / bays - 0.25), 1.25, timber ? 0x6e5238 : wall, false, 0.8);
  }
  const side = u.z > 0 ? 1 : -1;
  const sideN = u.clone().multiplyScalar(side);
  const sideU = new Vector3().crossVectors(UP, sideN).normalize();
  if (D > 1.1) lowWin(ctx, rng, P.world(side > 0 ? ub + 0.005 : ua - 0.005, y + 0.9, (d0 + d1) / 2), sideU, sideN, Math.min(0.9, D - 0.4), 1.1, wall, false, 0.7);
  for (const uu of [ua + 0.15, ub - 0.15]) k.beam(P.world(uu, y - 0.32, d1 - 0.15), P.world(uu, y - 1.9, Math.max(0.2, d0 - 0.4)), 0.08, 0.1, STEEL);
  roofThing(k, rng, P, ua, ub, y + H + 0.14, d0, d1);
  if (rng.chance(0.25)) ctx.put('awning', P.world((ua + ub) / 2, y + 2.25, d1 + 0.02), n.clone(), new Vector3(Math.min(W - 0.3, 2.6), 1, 0.8), new Color(rng.pick([0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441])));
  else if (rng.chance(0.5)) litLantern(ctx, k, P.world(rng.chance(0.5) ? ua + 0.25 : ub - 0.25, y + 2.3, d1 + 0.3), 0.8, glow);
}

/** a red-railed timber platform thrust out past the front: u span [ua, ub], from d0 to d1, its deck at y */
function veranda(ctx: Ctx, k: Kit, rng: Rng, P: GalleryProfile, ua: number, ub: number, y: number, d0: number, d1: number, glow: boolean, people: number, green: boolean): void {
  const n = P.wall.n, u = P.u;
  const W = ub - ua, D = d1 - d0;
  k.boxAxes(P.world((ua + ub) / 2, y - 0.14, (d0 + d1) / 2), u, UP, n, W / 2, 0.14, D / 2, DECK, { top: DECK_TOP, bottom: { wash: 0x3f362f, line: 1 } });
  redRail(k, P.world(ua + 0.05, y, d1 - 0.06), P.world(ub - 0.05, y, d1 - 0.06));
  redRail(k, P.world(ua + 0.05, y, d0 + 0.05), P.world(ua + 0.05, y, d1 - 0.06), false);
  redRail(k, P.world(ub - 0.05, y, d1 - 0.06), P.world(ub - 0.05, y, d0 + 0.05), false);
  for (const uu of [ua + 0.2, ub - 0.2]) k.beam(P.world(uu, y - 0.3, d1 - 0.2), P.world(uu, y - 2.2, Math.max(0.2, d0 - 0.5)), 0.09, 0.11, { wash: 0x33291f, line: 1 });
  for (let i = 0; i < people; i++) figure(k, rng, P.world(rng.range(ua + 0.5, ub - 0.5), y, rng.range(d0 + 0.4, d1 - 0.5)), rng.chance(0.6) ? n : u.clone().multiplyScalar(rng.chance(0.5) ? 1 : -1), rng.range(0.95, 1.05));
  if (green && rng.chance(0.6)) kitPlant(k, P.world(rng.chance(0.5) ? ua + 0.4 : ub - 0.4, y, d1 - 0.35), rng.range(1.2, 1.6));
  if (rng.chance(0.7)) {
    const uu = rng.chance(0.5) ? ua + 0.05 : ub - 0.05;
    k.beam(P.world(uu, y + 1.0, d1 - 0.06), P.world(uu, y + 2.4, d1 - 0.06), 0.05, 0.05, RED_POST);
    litLantern(ctx, k, P.world(uu, y + 2.4, d1 + 0.1), 0.8, glow);
  }
  if (D > 1.6 && rng.chance(0.4)) kitLine(k, rng, P.world(ua + 0.2, y + 2.1, d1 - 0.25), P.world(Math.min(ub - 0.2, ua + rng.range(2, 3.2)), y + 2.05, d1 - 0.25));
}

/** a neon blade sign hung out from a front on a bracket, facing along the canyon toward the rim */
function blade(ctx: Ctx, k: Kit, rng: Rng, P: GalleryProfile, uu: number, y: number, d: number, size: number): void {
  const word = rng.pick(WORDS);
  const w = size * 1.36;
  const face = P.u.z > 0 ? P.u.clone() : P.u.clone().negate();
  ctx.signs.place({ at: P.world(uu, y, d + 0.25 + w / 2), normal: face, size, spec: { text: word, color: hex(rng.pick(NEONS)), vertical: true, style: 'tube' }, blade: true, flicker: rng.chance(0.05) ? rng.next() : 0 }, null);
  const top = y + (size * (Array.from(word).length + 0.62)) / 2 + 0.15;
  k.beam(P.world(uu, top, d - 0.1), P.world(uu, top, d + 0.3 + w), 0.06, 0.06, STEEL);
}

export interface LowerOptions {
  /** the band's top floor and its bottom (the dressing thins, the projections deepen between them) */
  yTop: number;
  yLow: number;
  /** the whole lower Well's span: projection depth grows over it (so two bands continue one taper) */
  taper: readonly [number, number];
  /** above this, lanterns light their pools and stairs have real steps */
  yNear: number;
  seed: number;
  /** 0…1: life (people, laundry, plants, signs, shops); the ghost band far down keeps only lanterns and rooms */
  life: number;
  /** where a crossing lands (wall u span, floors y0…y1): no projection, no stair tower there */
  keep?: readonly { y0: number; y1: number; u0: number; u1: number }[];
  /** the deepest front a projection may reach at (u, y) (the temple spur's clearance) */
  cap?: (u: number, y: number) => number;
}

/** dress one wall's lower gallery band (its profile from plan.band) */
export function dressLower(ctx: Ctx, P: GalleryProfile, K2: GalleryKits, O: LowerOptions): void {
  const rng = new Rng(O.seed);
  const n = P.wall.n, u = P.u;
  const isStreet = (y: number): boolean => O.life > 0.5 && Math.abs(((Y0 - y) % 15 + 15) % 15) < 0.01;
  const dAt = (fi: number, si: number): number => P.depth[fi]?.[si] ?? 0;
  const southWall = Math.abs(n.z) > 0.5;
  const kept = (u0: number, u1: number, y0: number, y1: number): boolean => (O.keep ?? []).some((q) => q.u1 > u0 && q.u0 < u1 && q.y1 >= y0 - 0.01 && q.y0 <= y1 + 0.01);
  const cap = (u0: number, u1: number, y: number): number => Math.min(O.cap?.(u0, y) ?? 99, O.cap?.(u1, y) ?? 99, O.cap?.((u0 + u1) / 2, y) ?? 99);
  const inBand = (y: number): boolean => y <= O.yTop + 0.01 && y >= O.yLow - 0.01;
  // the taper: 0 at the top of the lower Well, 1 at its bottom
  const tap = (y: number): number => Math.min(1, Math.max(0, (O.taper[0] - y) / Math.max(1, O.taper[0] - O.taper[1])));
  // the stacks that carry a stair tower (never two side by side)
  const towers = new Set<number>();
  const nTowers = O.life > 0.5 ? (southWall ? 1 : 2) : 0;
  for (let i = 0, tries = 0; i < nTowers && tries < 30; tries++) {
    const si = rng.int(0, P.stacks.length - 1);
    const st = P.stacks[si];
    if (st === undefined || st.u1 - st.u0 < 5.2 || towers.has(si) || towers.has(si - 1) || towers.has(si + 1) || kept(st.u0, st.u1, O.yLow, O.yTop)) continue;
    towers.add(si);
    i++;
  }
  // blocks claim floors of a stack: nothing else projects there
  const claimed = new Set<string>();

  P.floors.forEach((y, fi) => {
    if (!inBand(y)) return;
    const k = K2.kit(y);
    const dens = density(y, O.yTop, O.yLow) * O.life;
    const t = tap(y);
    const glow = y >= O.yNear - 0.01;
    const street = isStreet(y);
    P.stacks.forEach((st, si) => {
      const d = dAt(fi, si);
      const L = st.u1 - st.u0;
      const above = fi > 0 ? dAt(fi - 1, si) : 0;
      if (d <= 0) {
        // a bare stretch of wall: cages, air-con, a laundry pole, a lit window
        for (let uu = st.u0 + rng.range(0.8, 1.6); uu < st.u1 - 0.8; uu += rng.range(1.8, 2.8)) {
          const r = rng.next();
          if (r < 0.3) kitCage(k, P, uu, y + 0.3, 0.01);
          else if (r < 0.5) kitAC(k, P, uu, y + 1.1, 0.01);
          else if (r < 0.65 && O.life > 0.5) kitPole(k, rng, P, uu, y + 2.1, 0.01, 1.6);
          lowWin(ctx, rng, P.world(uu, y + 0.8, 0.01), u, n, 1.0, 1.35, P.wall.wash, false, 0.6);
        }
        return;
      }
      const free = !claimed.has(`${fi}:${si}`) && !towers.has(si) && !kept(st.u0, st.u1, y - FLOOR_H * 3, y + FLOOR_H) && L - 1.0 >= 2.2;
      // ── projections past the front, deeper with depth: blocks (1–3 floors), pods, verandas ──
      const room = L - 1.0;
      const r = free ? rng.next() : 1;
      const pBlock = 0.1 + 0.4 * t, pPod = 0.14 + 0.06 * t, pVer = O.life > 0.5 ? 0.14 : 0;
      if (r < pBlock) {
        const w = Math.min(room, rng.range(Math.min(3.2, room), Math.min(7.5, room)));
        const ua = rng.range(st.u0 + 0.5, st.u1 - 0.5 - w);
        let floors = rng.int(1, 3);
        while (floors > 1 && (fi + floors - 1 >= P.floors.length || !inBand(P.floors[fi + floors - 1] ?? -1e9) || claimed.has(`${fi + floors - 1}:${si}`))) floors--;
        // it stands on the lowest of its floors and fills the ones above it
        const yBase = P.floors[fi + floors - 1] ?? y;
        const out = rng.range(1.2, 2.2) + 4.2 * t;
        const d1 = Math.min(d + out, cap(ua, ua + w, yBase));
        if (d1 > d + 0.8) {
          block(ctx, k, rng, P, ua, ua + w, yBase, floors, d - 0.1, d1, 0.55 + 0.25 * (1 - t));
          for (let j = 0; j < floors; j++) claimed.add(`${fi + j}:${si}`);
        }
      } else if (r < pBlock + pPod) {
        const w = Math.min(room, rng.range(2.4, 4.4));
        const ua = rng.range(st.u0 + 0.5, st.u1 - 0.5 - w);
        const d1 = Math.min(d + rng.range(1.0, 2.1) + 2.5 * t, cap(ua, ua + w, y));
        if (d1 > d + 0.8) pod(ctx, k, rng, P, ua, ua + w, y, d - 0.08, d1, glow);
      } else if (r < pBlock + pPod + pVer) {
        const w = Math.min(room, rng.range(3.0, 5.2));
        const ua = rng.range(st.u0 + 0.5, st.u1 - 0.5 - w);
        const high = !street && above < d - 0.4 && rng.chance(0.35);
        const yv = high ? y + FLOOR_H / 2 : y;
        const d1 = Math.min(d + rng.range(1.4, 3.0) + 2.5 * t, cap(ua, ua + w, y));
        if (d1 > d + 1) {
          veranda(ctx, k, rng, P, ua, ua + w, yv, d - 0.08, d1, glow, rng.chance(0.75 * dens) ? rng.int(1, 3) : 0, dens > 0.5);
          if (high) flight(k, P, ua - 0.1, y, FLOOR_H / 2, 1.9, -1, d + 0.55, 0.9, glow ? 6 : 0);
        }
      }
      const busy = claimed.has(`${fi}:${si}`);
      // ── the street floors: lit shopfronts along the back wall, awnings, box signs, a crowd ──
      if (street && !busy) {
        const bays = Math.max(1, Math.round(L / 3.2));
        for (let b = 0; b < bays; b++) {
          const uc = st.u0 + (b + 0.5) * (L / bays);
          const bw = L / bays;
          lowWin(ctx, rng, P.world(uc, y + 0.04, 0.01), u, n, bw - 0.6, 2.3, P.wall.wash, true, 0.9);
          if (rng.chance(0.45)) ctx.put('awning', P.world(uc, y + 2.5, 0.02), n.clone(), new Vector3(bw - 0.5, 1, Math.min(1.1, d * 0.45)), new Color(rng.pick([0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441, 0x7e1e1a])));
          else if (rng.chance(0.7)) ctx.signs.place({ at: P.world(uc, y + 2.7, 0.05), normal: n.clone(), size: 0.32, spec: { text: rng.pick(WORDS), color: hex(rng.pick(NEONS)), vertical: false, style: 'box' } }, k);
          if (rng.chance(0.5)) litLantern(ctx, k, P.world(uc + rng.range(-0.8, 0.8), y + 2.45, d - 0.35), 0.8, glow || b % 2 === 0);
        }
        const crowd = rng.int(1, 3);
        for (let i = 0; i < crowd; i++) figure(k, rng, P.world(rng.range(st.u0 + 0.5, st.u1 - 0.5), y, rng.range(0.9, Math.max(1, d - 0.4))), rng.chance(0.5) ? n : u.clone().multiplyScalar(rng.chance(0.5) ? 1 : -1), rng.range(0.94, 1.04));
      } else if (!busy && rng.chance(0.4 * dens)) {
        figure(k, rng, P.world(rng.range(st.u0 + 0.6, st.u1 - 0.6), y, Math.max(0.5, d - rng.range(0.45, 0.9))), rng.chance(0.65) ? n : u, rng.range(0.94, 1.04));
      }
      if (!busy) {
        // lanterns under the deck lip above; laundry along the front; plants at the rail; a blade sign facing the rim
        for (let uu = st.u0 + rng.range(0.9, 2.2); uu < st.u1 - 0.6; uu += rng.range(2.6, 4.4)) {
          if (rng.chance(0.34 * (0.5 + 0.5 * dens))) litLantern(ctx, k, P.world(uu, y + 2.35, d - 0.3), 0.8, glow && rng.chance(0.6));
        }
        if (!street && L > 3 && rng.chance(0.28 * dens)) {
          const a0 = rng.range(st.u0 + 0.3, st.u1 - 2.6);
          kitLine(k, rng, P.world(a0, y + 2.25, d - 0.3), P.world(a0 + rng.range(1.8, 3.0), y + 2.2, d - 0.3));
        }
        if (rng.chance(0.35 * dens)) kitPlant(k, P.world(rng.range(st.u0 + 0.4, st.u1 - 0.4), y, d - 0.35), rng.range(1.0, 1.5));
        if (rng.chance(0.2 * dens)) kitAC(k, P, rng.range(st.u0 + 0.6, st.u1 - 0.6), y - 1.2, Math.max(0.3, d - 0.9));
        if (rng.chance((street ? 0.3 : 0.13) * dens)) blade(ctx, k, rng, P, rng.range(st.u0 + 0.6, st.u1 - 0.6), y + 1.35, d, rng.range(0.5, 0.85));
      }
    });
  });

  // the stair towers: a flight and a landing per floor down the band, on the stack's deepest front
  for (const si of towers) {
    const st = P.stacks[si];
    if (st === undefined) continue;
    const fis = P.floors.map((_, fi) => fi).filter((fi) => inBand(P.floors[fi] ?? -1e9) && dAt(fi, si) > 0);
    const f0 = fis[0], f1 = fis[fis.length - 1];
    if (f0 === undefined || f1 === undefined || f1 - f0 < 2) continue;
    const d = Math.max(...fis.map((fi) => dAt(fi, si)));
    stairTower(K2.kit, P, f0, f1, st.u0 + rng.range(0.4, Math.max(0.5, st.u1 - st.u0 - 3.8)), d, O.yNear);
  }

  // thick drain pipes down the fronts and horizontal service runs under the deck lips: the vertical lines
  const band = P.floors.filter(inBand);
  const yHi = (band[0] ?? O.yTop) + FLOOR_H - 0.4, yLo = (band[band.length - 1] ?? O.yLow) - 0.6;
  P.stacks.forEach((st, si) => {
    if (!rng.chance(0.4)) return;
    const uu = rng.chance(0.5) ? st.u0 + 0.25 : st.u1 - 0.25;
    const sgn = uu < (st.u0 + st.u1) / 2 ? 1 : -1;
    const ds = P.floors.map((f, fi) => (inBand(f) ? dAt(fi, si) : 0)).filter((x) => x > 0);
    const dd = ds.length === 0 ? 0.3 : Math.max(0.3, Math.min(...ds) - 0.25);
    const nP = rng.int(1, 3);
    const rust = rng.chance(0.3);
    for (let i = 0; i < nP; i++) {
      const p = P.world(uu + i * 0.3 * sgn, yLo, dd - i * 0.04);
      K2.kit((yHi + yLo) / 2).cyl(p.x, yLo, p.z, 0.13 + i * 0.03, 0.13 + i * 0.03, yHi - yLo, 6, { wash: rust ? 0x8a6650 : 0x6d7178, line: 0.8 }, { caps: false, edges: E.sides });
    }
  });
  P.floors.forEach((y, fi) => {
    if (!inBand(y) || fi % 3 !== 1 || !rng.chance(0.7)) return;
    const ds = P.stacks.map((_, si) => dAt(fi, si)).filter((x) => x > 0);
    if (ds.length === 0) return;
    const d0 = Math.max(0.25, Math.min(...ds) - 0.3);
    K2.kit(y).beam(P.world(0.3, y - 0.62, d0), P.world(P.wall.len - 0.3, y - 0.62, d0), 0.16, 0.16, { wash: rng.chance(0.4) ? 0x8a6650 : 0x6d7178, line: 0.8 });
  });
}
