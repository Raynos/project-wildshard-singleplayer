// The Yamen Well's galleries (dome C, E169): the stacked timber verandas and concrete walkways that line the shaft, so
// the open gap between the two long walls reads as a narrow canyon (round-6 mockups B and D). A wall is cut into
// stacks 5–11 m long; each stack keeps its own depth down the floors (with a step in or out now and then, and a deeper
// "street" floor every 15 m), so the canyon's walls are jagged, never sheer. Every gallery is real geometry in the kit:
// a deck with a heavy ground line on its lip, a dark beam under it, a lattice or barred railing, cinnabar posts, a
// glazed pent roof where the floor above steps back, the back wall with its doors and windows (interior-mapped near the
// rim, the kit's procedural facade deeper down), and its life — lanterns, people at the rail, laundry, plants, air-con
// units, neon blade signs hung out into the canyon so they read along it.
import { Color, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { SURF } from '../look/paint';
import { laundry, stool } from './props';
import { NEONS, WORDS } from './towers';
import { Y0 } from '../layout';
import { Rng } from '../util';

export const FLOOR_H = 3;
const UP = new Vector3(0, 1, 0);
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** one run of wall that carries galleries */
export interface GalleryWall {
  name: string;
  /** the wall's start on its plane (its left end seen from the void); y is ignored */
  p0: Vector3;
  /** outward normal (into the void) */
  n: Vector3;
  len: number;
  /** the topmost and lowest gallery floors (deck tops); the back wall runs from `wallBottom` to `wallTop` */
  yTop: number;
  yBottom: number;
  wallTop: number;
  wallBottom: number;
  /** stack depth range (m) */
  dMin: number;
  dMax: number;
  /** 0..1: the timber share (brown decks, lattice rails, red posts, glazed roofs) vs concrete and steel */
  timber: number;
  seed: number;
  /** where floors are forced to carry a gallery at least `d` deep (a bridge lands) */
  landings?: readonly { y: number; u0: number; u1: number; d: number }[];
  /** where no gallery is built (a station, the rim ledge above) */
  voids?: readonly { y0: number; y1: number; u0: number; u1: number }[];
  /** the wall's own wash */
  wash: number;
  /** the wall's fronts step out going down: + `rate` m per floor below `from`, up to `cap` (a cascade seen from above) */
  cascade?: { rate: number; from: number; cap: number };
  /** eaves in grey tin (≤ 1 m, the lower bands) instead of glazed tiles */
  tin?: boolean;
  /** the depth of the every-15-m street floors (default dMax + 0.6) */
  street?: number;
  /** stair flights zig-zagging down the fronts between floors (how many) */
  stairs?: number;
  /** galleries only over [g0, len - g1] (a corner another wall's galleries take) */
  g0?: number;
  g1?: number;
}

/** what a wall built: its front edge (depth) at each floor and stack, for the bridges and nets to tie into */
export interface GalleryProfile {
  wall: GalleryWall;
  u: Vector3;
  floors: number[];
  stacks: { u0: number; u1: number }[];
  /** depth[floor][stack] (0 = no gallery) */
  depth: number[][];
  /** the front depth at (u, floor y), 0 where none */
  at: (u: number, y: number) => number;
  /** the deepest front over [u0, u1] across floors in [y0, y1] */
  maxIn: (u0: number, u1: number, y0: number, y1: number) => number;
  world: (u: number, y: number, d: number) => Vector3;
}

export interface GalleryKits {
  /** the opaque kit for a spot (altitude bands, so the deep ones cull) */
  kit: (y: number) => Kit;
  /** the alpha-cut kit (barred railings) */
  alpha: (y: number) => Kit;
}

const TILE = [0x2b6b55, 0x2b6b55, 0x2c4f82, 0x464d55] as const;
/** corrugated tin (the lower bands' eaves) */
const TIN = [0x6a7078, 0x5f656c, 0x747a80, 0x656058] as const;
const TIMBER_DECK: Look = { wash: 0x564a40, line: 1.8, surf: SURF.wood };
const TIMBER_TOP: Look = { wash: 0x4a4038, line: 0, wet: 0.25, surf: SURF.wood };
const CONC_DECK: Look = { wash: 0x8a8f97, line: 1.8, surf: SURF.concrete };
const CONC_TOP: Look = { wash: 0x43454b, kind: K.flag, line: 0, wet: 0.3 };
const BEAM: Look = { wash: 0x33291f, line: 1 };
const RAIL_TOP: Look = { wash: 0x2a2320, line: 0.8 };
const STEEL: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.13, line: 1 };
const POST_RED: Look = { wash: 0x9c3627, line: 1, accent: true, surf: SURF.lacquer };
const POST_GREY: Look = { wash: 0x767a82, line: 1 };
const WARM = [0xffc98a, 0xffbf78, 0xffd6a2, 0xf6b070, 0xffcd96] as const;
/** the washes of the rooms closed in over the drop (plaster, tile, tin) */
const ROOM = [0x9a958b, 0xa39c8e, 0x8c9096, 0xb0a894, 0x8a8478] as const;

/** an interior-mapped window or door in the facade batch (the facade grammar's windows: lit rooms, curtains, frames) */
export function win(ctx: Ctx, rng: Rng, at: Vector3, u: Vector3, n: Vector3, w: number, h: number, wall: number, door: boolean, litP: number): void {
  const m = new Matrix4().makeBasis(u, UP, n).scale(new Vector3(w, h, 1)).setPosition(at.clone().addScaledVector(n, 0.02));
  const lit = rng.chance(litP) ? rng.range(0.8, 1.15) : 0;
  const style = rng.int(0, 3) + (rng.chance(0.4) ? 4 : 0) + (door ? 16 : 0);
  ctx.fd.windows.push({ m, win: new Vector4(rng.range(0, 97), lit, rng.chance(0.4) ? rng.range(0.25, 0.7) : 0, style), wall: new Color(wall), light: new Color(rng.pick(WARM)) });
}

/** a person at a spot, facing `face` (a TRELLIS walker, instanced by build.ts) */
export function stand(ctx: Ctx, p: Vector3, face: Vector3, s = 1): void {
  const yaw = Math.atan2(face.x, face.z);
  ctx.walkers.push(new Matrix4().compose(p, new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(s, s, s)));
}

/** a lattice (timber) or barred (steel) railing from a to b on a deck at a.y, facing `side` */
function railing(k: Kit, ka: Kit, a: Vector3, b: Vector3, timber: boolean, red: boolean): void {
  const d = new Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 0.2) return;
  d.divideScalar(len);
  // (d, up, side) right-handed: the box faces point out
  const side = new Vector3().crossVectors(d, UP).normalize();
  const c = a.clone().add(b).multiplyScalar(0.5);
  if (timber) {
    k.boxAxes(c.clone().setY(a.y + 0.55), d, UP, side, len / 2, 0.42, 0.035,
      { wash: red ? 0x7e2a1e : 0x40352d, kind: K.panel, line: 1, accent: red, surf: red ? SURF.lacquer : SURF.wood });
  } else {
    ka.quad(a.clone().addScaledVector(side, -0.01).addScaledVector(d, 0), d, UP, len, 1.02, STEEL);
  }
  k.boxAxes(c.clone().setY(a.y + 1.04), d, UP, side, len / 2 + 0.04, 0.05, 0.07, RAIL_TOP);
}

/** a glazed pent roof along [a, b] (on the wall side) sloping out over the front */
export function pentRoof(k: Kit, a: Vector3, b: Vector3, out: Vector3, reach: number, drop: number, tile: number): void {
  const len = a.distanceTo(b);
  const a2 = a.clone().addScaledVector(out, reach).add(new Vector3(0, -drop, 0));
  const b2 = b.clone().addScaledVector(out, reach).add(new Vector3(0, -drop, 0));
  const slant = Math.hypot(reach, drop);
  // tiles on top (normal up-and-out), a dark soffit under, a painted eave board on the lip
  k.quad4(a2, b2, b, a, len, slant, { wash: tile, kind: K.tiles, line: 1, accent: true }, 0, 0, E.v0 | E.u0 | E.u1);
  k.quad4(a, b, b2, a2, len, slant, { wash: 0x3a2e26, line: 0.6 });
  const d = new Vector3().subVectors(b, a).normalize();
  const c = a2.clone().add(b2).multiplyScalar(0.5).add(new Vector3(0, -0.07, 0));
  k.boxAxes(c, d, UP, out, len / 2 + 0.05, 0.08, 0.05, { wash: 0x6fae8c, line: 1, accent: true });
}

/** a stair flight hung outside a gallery front: from (u0, y) climbing one floor along u (dir ±1) over `run` m */
function stairFlight(k: Kit, world: (u: number, y: number, d: number) => Vector3, u: Vector3, u0: number, y: number, d: number, run: number, dir: number): void {
  const steps = 14, rise = FLOOR_H / steps, tread = run / steps;
  const look: Look = { wash: 0x6b6d72, line: 1.8, surf: SURF.concrete };
  const ud = u.clone().multiplyScalar(dir);
  const nd = new Vector3().crossVectors(ud, UP);
  for (let i = 0; i < steps; i++) {
    const uu = u0 + dir * (i + 0.5) * tread;
    k.boxAxes(world(uu, y + i * rise + rise / 2, d + 0.55), ud, UP, nd, tread / 2 + 0.01, rise / 2, 0.55, look, { top: { wash: 0x5d5f65, line: 0 } });
  }
  // a stringer under it, a railing on its open side, a landing at the top
  const a = world(u0, y - 0.25, d + 1.12), b = world(u0 + dir * run, y + FLOOR_H - 0.25, d + 1.12);
  k.beam(a, b, 0.12, 0.3, { wash: 0x3a3d44, line: 1 });
  k.beam(a.clone().add(new Vector3(0, 1.3, 0)), b.clone().add(new Vector3(0, 1.3, 0)), 0.06, 0.06, RAIL_TOP);
  for (let i = 0; i <= steps; i += 2) {
    const p = a.clone().lerp(b, i / steps);
    k.beam(p, p.clone().add(new Vector3(0, 1.3, 0)), 0.035, 0.035, RAIL_TOP);
  }
}

/** build one wall's galleries; returns its profile */
export function galleryWall(ctx: Ctx, W: GalleryWall, K2: GalleryKits): GalleryProfile {
  const rng = new Rng(W.seed);
  const n = W.n.clone().setY(0).normalize();
  const u = new Vector3().crossVectors(UP, n).normalize();
  const world = (uu: number, y: number, d: number): Vector3 => W.p0.clone().setY(y).addScaledVector(u, uu).addScaledVector(n, d);
  // stacks along the wall, 3.5–8 m: narrow enough that the canyon's walls read as many small buildings
  const stacks: { u0: number; u1: number }[] = [];
  const gEnd = W.len - (W.g1 ?? 0);
  for (let s = W.g0 ?? 0; s < gEnd - 0.5;) {
    let L = rng.range(3.5, 8);
    if (gEnd - s - L < 3) L = gEnd - s;
    stacks.push({ u0: s, u1: s + L });
    s += L;
  }
  const floors: number[] = [];
  for (let y = W.yTop; y >= W.yBottom - 0.01; y -= FLOOR_H) floors.push(y);
  // depths: each stack cycles OUT going down (every floor steps out 0.6–1.3 m over the one above, then the cycle
  // resets under a deep one), a quarter of them the other way (rooms cantilevered over a shallower floor). Seen from the
  // rim, every floor shows a strip of its deck, its railing and its people: layered, offset, never a flush wall. A
  // street floor every 15 m runs deep and continuous.
  const cyc = stacks.map(() => ({ len: rng.int(2, 4), step: rng.range(0.6, 1.3), phase: rng.int(0, 3), base: rng.range(W.dMin, W.dMax), inv: rng.chance(0.25) }));
  const depth: number[][] = floors.map(() => stacks.map(() => 0));
  const isStreet = (y: number): boolean => Math.abs(((Y0 - y) % 15 + 15) % 15) < 0.01;
  floors.forEach((y, fi) => {
    stacks.forEach((st, si) => {
      const c = cyc[si];
      if (c === undefined) return;
      const k = (fi + c.phase) % c.len;
      if (k === 0 && rng.chance(0.35)) c.base = rng.range(W.dMin, W.dMax);
      let d = c.base + ((c.inv ? c.len - 1 - k : k) - (c.len - 1) / 2) * c.step;
      if (W.cascade !== undefined) d = Math.min(W.cascade.cap, d + W.cascade.rate * Math.max(0, (W.cascade.from - y) / FLOOR_H));
      if (rng.chance(0.06)) d = 0;
      if (isStreet(y)) d = W.cascade === undefined ? W.street ?? W.dMax + 0.6 : W.cascade.cap;
      for (const l of W.landings ?? []) if (Math.abs(l.y - y) < 0.1 && l.u1 > st.u0 && l.u0 < st.u1) d = Math.max(d, l.d);
      for (const v of W.voids ?? []) if (y >= v.y0 - 0.01 && y <= v.y1 + 0.01 && v.u1 > st.u0 && v.u0 < st.u1) d = 0;
      const row = depth[fi];
      if (row !== undefined) row[si] = d <= 0 ? 0 : Math.min(W.cascade?.cap ?? W.dMax + 1.4, Math.max(1.2, d));
    });
  });
  const dAt = (fi: number, si: number): number => depth[fi]?.[si] ?? 0;

  // the kit's facade program rules a window row per `row` metres from the quad's v origin: start it at a floor
  const shell = (k: Kit, uu: number, y: number, L: number, H: number, look: Look, edges: number): void => {
    const a = world(uu, y, 0.01), b = world(uu + L, y, 0.01);
    const vo = ((y - (Y0 % FLOOR_H)) % FLOOR_H + FLOOR_H) % FLOOR_H;
    k.quad4(a, b, b.clone().setY(y + H), a.clone().setY(y + H), L, H, look, a.dot(u), vo, edges);
  };
  // the back wall: one quad per stack per floor (a window row for the kit's facade program below the near floors)
  const wallLook = (y: number, si: number): Look => ({ wash: W.wash, kind: K.facade, row: FLOOR_H, col: 2.6 + (si % 3) * 0.4, seed: (W.seed % 97) + si * 3.1 + y * 0.01, line: 1 });
  floors.forEach((y, fi) => {
    stacks.forEach((st, si) => {
      const k = K2.kit(y);
      const L = st.u1 - st.u0;
      const near = y >= Y0 - 27 && y <= Y0 + 30;
      const d = dAt(fi, si);
      const p = world(st.u0, y - 0.3, 0.01);
      if (near && d > 0) {
        // a plain plastered back wall with real doors and windows (interior-mapped, lit)
        k.quad(p, u, UP, L, FLOOR_H, { wash: W.wash, line: 1, surf: SURF.concrete, edges: E.v0 });
        const bays = Math.max(1, Math.round(L / 3.2));
        for (let b = 0; b < bays; b++) {
          const uc = st.u0 + (b + 0.5) * (L / bays);
          const door = rng.chance(0.55);
          if (door) win(ctx, rng, world(uc - 0.55, y + 0.02, 0.01), u, n, 1.0, 2.15, W.wash, true, 0.7);
          win(ctx, rng, world(uc + (door ? 0.7 : 0), y + 0.85, 0.01), u, n, door ? 1.1 : 1.8, 1.4, W.wash, false, 0.72);
          if (rng.chance(0.3)) ctx.signs.place({ at: world(uc - 0.55, y + 2.45, 0.08), normal: n.clone(), size: 0.26, spec: { text: rng.pick(WORDS), color: hex(rng.pick(NEONS)), vertical: false, style: 'box' } }, null);
        }
      } else {
        shell(k, st.u0, y - 0.3, L, FLOOR_H, wallLook(y, si), E.none);
      }
    });
  });
  // the corners without galleries, the wall above the top floor and below the lowest: the facade program's shell
  for (const [a, L] of [[0, W.g0 ?? 0], [gEnd, W.len - gEnd]] as const) {
    if (L > 0.05) shell(K2.kit(W.yTop), a, W.yBottom - 0.3, L, W.yTop - W.yBottom + FLOOR_H, wallLook(W.yTop, 2), E.none);
  }
  const k0 = K2.kit(W.yTop + 3);
  if (W.wallTop > W.yTop + FLOOR_H - 0.3) shell(k0, 0, W.yTop + FLOOR_H - 0.3, W.len, W.wallTop - (W.yTop + FLOOR_H - 0.3), wallLook(W.yTop + 3, 7), E.v1);
  if (W.wallBottom < W.yBottom - 0.3) shell(K2.kit(W.wallBottom), 0, W.wallBottom, W.len, W.yBottom - 0.3 - W.wallBottom, wallLook(W.wallBottom, 5), E.none);

  // the galleries
  floors.forEach((y, fi) => {
    const k = K2.kit(y), ka = K2.alpha(y);
    const life = y >= Y0 - 40 && y <= Y0 + 30;
    const lifeNear = y >= Y0 - 22 && y <= Y0 + 30;
    stacks.forEach((st, si) => {
      const d = dAt(fi, si);
      if (d <= 0) return;
      const L = st.u1 - st.u0;
      const timber = rng.chance(W.timber);
      const red = timber && rng.chance(0.12);
      const street = isStreet(y);
      // deck + its top + the beam under its lip
      const c = world((st.u0 + st.u1) / 2, y - 0.14, d / 2);
      k.boxAxes(c, u, UP, n, L / 2, 0.14, d / 2, timber ? TIMBER_DECK : CONC_DECK, { top: timber ? TIMBER_TOP : CONC_TOP, bottom: { wash: 0x4d4f55, line: 1 } });
      k.boxAxes(world((st.u0 + st.u1) / 2, y - 0.46, d - 0.12), u, UP, n, L / 2, 0.18, 0.12, BEAM);
      // now and then the floor is closed in: a lit room cantilevered over the drop (its front a band of windows, air-con
      // units under them, its tin roof showing where the floor above steps back)
      const landed = (W.landings ?? []).some((l) => Math.abs(l.y - y) < 0.1 && l.u1 > st.u0 && l.u0 < st.u1);
      if (!street && !landed && y >= Y0 - 30 && d >= 1.5 && L <= 7 && rng.chance(0.1)) {
        const wash = rng.pick(ROOM);
        const h = FLOOR_H - 0.46;
        const upD = fi > 0 ? dAt(fi - 1, si) : 0;
        k.boxAxes(world((st.u0 + st.u1) / 2, y + h / 2, d / 2 + 0.02), u, UP, n, L / 2 - 0.04, h / 2, d / 2 - 0.02, { wash, line: 1, surf: SURF.concrete },
          { sides: 1 | 2 | 4, bottom: null, top: upD < d - 0.3 ? { wash: rng.pick([0x5d636b, 0x686d72, 0x565d66]), kind: K.tiles, line: 1 } : null });
        const nw = Math.max(1, Math.floor(L / 1.6));
        for (let i = 0; i < nw; i++) {
          const uc = st.u0 + ((i + 0.5) * L) / nw;
          win(ctx, rng, world(uc, y + 0.95, d), u, n, Math.min(1.3, L / nw - 0.3), 1.35, wash, false, 0.85);
          if (rng.chance(0.35)) { const p = world(uc, y + 0.2, d + 0.3); ctx.ac(p.x, p.y, p.z, Math.atan2(n.x, n.z)); }
        }
        if (upD < d - 1 && rng.chance(0.4)) {
          const t = world((st.u0 + st.u1) / 2, y + h, Math.max(0.8, upD + (d - upD) / 2));
          k.cyl(t.x, t.y, t.z, 0.5, 0.5, 1.0, 10, { wash: rng.pick([0x8e969e, 0x6f8fb5]), line: 1 }, { edges: E.rims });
          k.cyl(t.x, t.y + 1.0, t.z, 0.5, 0.12, 0.18, 10, { wash: 0x7c848c, line: 1 });
        }
        return;
      }
      // the railing along the front, open where a bridge lands; side rails where the neighbour is shallower
      const gaps = (W.landings ?? []).filter((l) => Math.abs(l.y - y) < 0.1 && l.u1 > st.u0 && l.u0 < st.u1).map((l) => [l.u0, l.u1] as const);
      const runs: [number, number][] = [[st.u0 + 0.05, st.u1 - 0.05]];
      for (const [g0, g1] of gaps) {
        const r = runs.pop();
        if (r === undefined) break;
        if (g0 > r[0] + 0.3) runs.push([r[0], g0]);
        if (g1 < r[1] - 0.3) runs.push([g1, r[1]]);
      }
      for (const [a0, a1] of runs) railing(k, ka, world(a0, y, d - 0.06), world(a1, y, d - 0.06), timber, red);
      const left = si > 0 ? dAt(fi, si - 1) : 0, right = si < stacks.length - 1 ? dAt(fi, si + 1) : 0;
      if (left < d - 0.3) railing(k, ka, world(st.u0 + 0.05, y, d - 0.06), world(st.u0 + 0.05, y, left + 0.05), timber, red);
      if (right < d - 0.3) railing(k, ka, world(st.u1 - 0.05, y, right + 0.05), world(st.u1 - 0.05, y, d - 0.06), timber, red);
      // covered by the floor above: posts hold its deck. Stepped out beyond it: a glazed pent roof over the strip
      // (sometimes), else an open terrace in the rain. A top floor with nothing above (under the square's lip) stays open
      const above = fi > 0 ? dAt(fi - 1, si) : 0;
      const covered = above >= d - 0.3;
      const roofOk = fi > 0 || W.wallTop >= W.yTop + FLOOR_H - 0.4;
      const roofed = !covered && roofOk && rng.chance(d - above >= 1.8 ? 0.55 : 0.3);
      if (covered || roofed) {
        const nPost = Math.max(2, Math.round(L / 2.2));
        for (let i = 0; i <= nPost; i++) {
          const uu = st.u0 + 0.14 + (i / nPost) * (L - 0.28);
          const h = roofed ? 2.4 : FLOOR_H - 0.3 - 0.36;
          k.boxAxes(world(uu, y + h / 2, d - 0.14), u, UP, n, 0.1, h / 2, 0.1, timber ? POST_RED : POST_GREY);
        }
      }
      if (roofed) {
        // an eave along the front only (≤ 1 m of tiles from +2.95 down to ~2.4 m over the deck): seen from the rim the
        // deck behind it stays open, with its people and its clutter
        const from = Math.max(above, d - 1.0) + 0.02;
        const reach = d - from + 0.55;
        pentRoof(k, world(st.u0, y + 2.95, from), world(st.u1, y + 2.95, from), n, reach, 0.62 * reach / Math.max(reach - 0.55, 0.5), W.tin === true ? rng.pick(TIN) : timber ? rng.pick(TILE) : 0x51555c);
      }
      // a catch net slung under the lip where the floor below steps back (Hong Kong's 安全網 over a drop)
      const below = fi < floors.length - 1 ? dAt(fi + 1, si) : d;
      if (below < d - 1 && rng.chance(0.3)) {
        const a0 = world(st.u0 + 0.1, y - 0.55, d), a1 = world(st.u1 - 0.1, y - 0.55, d);
        const b0 = world(st.u0 + 0.1, y - 0.1, d + 1.5), b1 = world(st.u1 - 0.1, y - 0.1, d + 1.5);
        ka.quad4(a0, a1, b1, b0, L - 0.2, 1.56, { wash: 0x2e3036, kind: K.net, col: 0.3, line: 1, edges: E.none }, a0.dot(u), 0);
        ka.quad4(a1, a0, b0, b1, L - 0.2, 1.56, { wash: 0x2e3036, kind: K.net, col: 0.3, line: 1, edges: E.none }, a1.dot(u), 0);
        k.beam(b0, b1, 0.06, 0.06, RAIL_TOP);
        for (const [a, b] of [[a0, b0], [a1, b1]] as const) k.beam(a, b, 0.05, 0.05, RAIL_TOP);
      }
      // life: lanterns under the eave, people at the rail, laundry between posts, plants, air-con, blade signs
      if (life) {
        for (let uu = st.u0 + rng.range(0.8, 2.2); uu < st.u1 - 0.6; uu += rng.range(2.4, 4.2)) {
          if (rng.chance(street ? 0.6 : timber ? 0.35 : 0.15)) ctx.lantern(world(uu, 0, d - 0.3).x, y + (roofed ? 2.3 : 2.2), world(uu, 0, d - 0.3).z, 0.75);
        }
        // vines and trailing plants draped over the railing, hanging down the front toward the floor below
        if (rng.chance(lifeNear ? 0.45 : 0.25)) {
          for (let j = 0; j < rng.int(1, 2); j++) {
            const uu = rng.range(st.u0 + 0.6, st.u1 - 0.6), w = rng.range(0.8, 1.6), h = rng.range(0.9, 2.2);
            k.boxAxes(world(uu, y + 1.05 - h / 2, d + 0.06), u, UP, n, w / 2, h / 2, 0.12, { wash: rng.pick([0x3d6b45, 0x4a7a4c, 0x35603f]), kind: K.leaf, line: 0, accent: true }, { bottom: null });
          }
        }
        const nPeople = rng.chance((lifeNear ? (street ? 0.35 : 0.12) : 0.06) + (covered ? 0 : 0.22)) ? 1 : 0;
        for (let i = 0; i < nPeople; i++) {
          const uu = rng.range(st.u0 + 0.6, st.u1 - 0.6);
          const face = rng.chance(0.6) ? n : rng.chance(0.5) ? u : u.clone().negate();
          stand(ctx, world(uu, y, Math.max(0.5, d - rng.range(0.5, 1.3))), face, rng.range(0.94, 1.04));
        }
        if (lifeNear && rng.chance(0.55) && L > 3) {
          const a0 = rng.range(st.u0 + 0.3, st.u1 - 2.6);
          laundry(k, rng, world(a0, y + 2.3, d - 0.3), world(a0 + rng.range(1.8, 3.2), y + 2.25, d - 0.3));
        }
        if (lifeNear) for (let i = 0; i < rng.int(0, 2); i++) ctx.put('plant', world(rng.range(st.u0 + 0.4, st.u1 - 0.4), y, d - 0.35), n.clone().negate(), new Vector3(1, rng.range(0.9, 1.3), 1));
        if (rng.chance(0.45)) {
          const p = world(rng.range(st.u0 + 0.6, st.u1 - 0.6), y - 1.1, Math.max(0.4, d - 0.9));
          ctx.ac(p.x, p.y, p.z, Math.atan2(n.x, n.z));
        }
        if (street && rng.chance(0.5)) {
          // a striped cloth awning over a shop door (in the kit: no instanced piece of its own)
          const uu = rng.range(st.u0 + 1.2, st.u1 - 1.2), aw = rng.range(1.6, 2.6);
          const a0 = world(uu - aw / 2, y + 2.45, 0.05), a1 = world(uu + aw / 2, y + 2.45, 0.05);
          const b1 = world(uu + aw / 2, y + 1.95, 1.0), b0 = world(uu - aw / 2, y + 1.95, 1.0);
          const cloth: Look = { wash: rng.pick([0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441]), kind: K.cloth, row: 1, col: 0.22, line: 1, accent: true };
          k.quad4(b0, b1, a1, a0, aw, 1.07, cloth);
          k.quad4(a0, a1, b1, b0, aw, 1.07, cloth);
        }
        // a neon blade sign hung out from the front, facing along the canyon (toward the rim at the south)
        if (rng.chance(street ? 0.25 : 0.1)) {
          const word = rng.pick(WORDS);
          const size = rng.range(0.55, 0.95);
          const uu = rng.range(st.u0 + 0.5, st.u1 - 0.5);
          const w = size * 1.36;
          const face = u.z > 0 ? u.clone() : u.clone().negate();
          const at = world(uu, y + 1.35, d + 0.25 + w / 2);
          ctx.signs.place({ at, normal: face, size, spec: { text: word, color: hex(rng.pick(NEONS)), vertical: true, style: 'tube' }, blade: true, flicker: rng.chance(0.06) ? rng.next() : 0 }, null);
          k.beam(world(uu, y + 1.35 + size * (word.length + 0.62) / 2 + 0.15, d - 0.1), world(uu, y + 1.35 + size * (word.length + 0.62) / 2 + 0.15, d + 0.3 + w), 0.06, 0.06, BEAM);
        }
      }
    });
  });

  // drain pipes down the fronts: a run of 1–3 at a stack's edge from its first gallery floor to its last
  stacks.forEach((st, si) => {
    if (!rng.chance(0.8)) return;
    const fis = floors.map((_, fi) => fi).filter((fi) => dAt(fi, si) > 0);
    const f0 = fis[0], f1 = fis[fis.length - 1];
    if (f0 === undefined || f1 === undefined || f1 - f0 < 2) return;
    const yTop = (floors[f0] ?? 0) + FLOOR_H - 0.4, yBot = (floors[f1] ?? 0) - 0.6;
    const d = Math.min(...fis.map((fi) => dAt(fi, si))) - 0.35;
    const uu = rng.chance(0.5) ? st.u0 + 0.35 : st.u1 - 0.35;
    const nP = rng.int(1, 3);
    for (let i = 0; i < nP; i++) {
      const p = world(uu + i * 0.22, yBot, d - i * 0.05);
      const r = rng.range(0.07, 0.12);
      K2.kit((yTop + yBot) / 2).cyl(p.x, yBot, p.z, r, r, yTop - yBot, 6, { wash: rng.chance(0.3) ? 0x6e4a3a : rng.pick([0x4e5157, 0x5d6168, 0x3f4247]), line: 0.9 }, { caps: false, edges: E.sides });
    }
  });
  // stair flights zig-zagging down the fronts, outside the railings
  for (let i = 0, tries = 0; i < (W.stairs ?? 0) && tries < 40; tries++) {
    const fi = rng.int(1, floors.length - 1), si = rng.int(0, stacks.length - 1);
    const st = stacks[si], y = floors[fi];
    if (st === undefined || y === undefined || st.u1 - st.u0 < 5.4) continue;
    const d = Math.min(dAt(fi, si), dAt(fi - 1, si));
    if (d < 1.5) continue;
    const dir = rng.chance(0.5) ? 1 : -1;
    stairFlight(K2.kit(y), world, u, dir > 0 ? st.u0 + 0.4 : st.u1 - 0.4, y, d, 4.6, dir);
    i++;
  }
  // the near floors' clutter, seen from the rim above: stools round a low table, crates, a bird cage, big pot plants
  floors.forEach((y, fi) => {
    if (y < Y0 - 28) return;
    stacks.forEach((st, si) => {
      const d = dAt(fi, si);
      if (d < 2) return;
      const k = K2.kit(y);
      if (rng.chance(0.45)) {
        const c = world(rng.range(st.u0 + 1.2, st.u1 - 1.2), y, rng.range(1.0, d - 0.9));
        k.box(c.x, y, c.z, 0.7, 0.62, 0.7, { wash: 0x5a4636, line: 1, surf: SURF.wood });
        for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6]] as const) stool(k, c.x + dx, y, c.z + dz, rng.pick([0x2e5fa3, 0xc23b22, 0x3e5a4a]));
      }
      if (rng.chance(0.4)) {
        const c = world(rng.range(st.u0 + 0.5, st.u1 - 0.5), y, rng.range(0.4, 1.0));
        for (let j = 0; j < rng.int(1, 3); j++) k.box(c.x + j * 0.1, y + j * 0.42, c.z, 0.55, 0.42, 0.45, { wash: rng.pick([0x8a6a3a, 0x9a9690, 0x6f8fb5]), line: 1, accent: true });
      }
      if (rng.chance(0.25)) {
        const c = world(rng.range(st.u0 + 0.6, st.u1 - 0.6), y + 1.6, d - 0.5);
        k.cyl(c.x, c.y, c.z, 0.22, 0.2, 0.42, 8, { wash: 0x2a2c31, kind: K.bars, row: 0, col: 0.05, line: 0.8 });
        k.cyl(c.x, c.y + 0.42, c.z, 0.22, 0.02, 0.14, 8, { wash: 0x3a3d44, line: 0.8 });
      }
      for (let j = 0; j < rng.int(0, 2); j++) ctx.put('plant', world(rng.range(st.u0 + 0.4, st.u1 - 0.4), y, rng.chance(0.5) ? d - 0.35 : 0.35), n.clone().negate(), new Vector3(1.4, rng.range(1.2, 1.8), 1.4));
    });
  });

  const at = (uu: number, y: number): number => {
    const fi = floors.findIndex((f) => Math.abs(f - y) < 0.1);
    const si = stacks.findIndex((s) => uu >= s.u0 && uu <= s.u1);
    return fi === -1 || si === -1 ? 0 : dAt(fi, si);
  };
  const maxIn = (u0: number, u1: number, y0: number, y1: number): number => {
    let m = 0;
    floors.forEach((f, fi) => {
      if (f < y0 - 0.01 || f > y1 + 0.01) return;
      stacks.forEach((s, si) => { if (s.u1 > u0 && s.u0 < u1) m = Math.max(m, dAt(fi, si)); });
    });
    return m;
  };
  return { wall: W, u, floors, stacks, depth, at, maxIn, world };
}
