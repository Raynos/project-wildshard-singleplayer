/**
 * The open plot's geometry (SHARD-PLATFORM G198 / G213 / G219), pure and Node-safe: everything `openPlot.ts` draws and
 * everything the platform collides with, as flat arrays in the plot's own frame (origin at the plot's centre, y up).
 *
 * A plot is a 500 × 500 m surveyed cell with no shard (G213 B: the cyan border line, four striped corner beacons with sky
 * beams). Each of its four entries is a showroom (G219, `art/grid/round-25-open-plot-demos/H-showroom.jpg`): the survey sign
 * across the end of the entry stub, a billboard picturing a shard idea on the left, a half-built demo corner of another
 * idea on the right (finished at the front, grey blockout in the middle, cyan wireframe at the back, scaffold between),
 * each entry a different idea. The middle holds the centrepiece: a stepped plinth under a slowly turning hologram of a
 * shard being built, ringed by floating picture cards of every idea.
 *
 * Draw classes (one draw each per plot): `solid` (vertex-coloured, shading baked in), `lines` (static cyan wireframe and
 * beams), `pictures` (billboard faces, atlas UVs), `text` (sign boards and demo labels, text-atlas UVs), and the turning
 * hologram's own `holoLines` / `holoCards`. The collider is `solid` plus the floor.
 */
import { CHUNK_HALF } from '@wildshard/engine/core/config';

/** The shard ideas the showrooms picture (`public/assets/grid/open-plot/<idea>.webp`, names in GAME_STRINGS.grid.plot.ideas). */
export const PLOT_IDEAS = ['sky-race', 'night-market', 'frozen-lighthouse', 'canyon-railway', 'coral-reef', 'alien-plain', 'desert-ruin', 'ink-valley'] as const;
export type PlotIdea = typeof PLOT_IDEAS[number];
export type PlotSide = 'north' | 'east' | 'south' | 'west';
export const PLOT_SIDES: readonly PlotSide[] = ['north', 'east', 'south', 'west'];
/** Where a region of an atlas sits, in canvas pixels. */
export interface AtlasRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** The picture atlas: one billboard face per idea (header band, 16:9 picture, caption band), two columns × four rows. */
export const FACE = { w: 640, h: 480, header: 60, picture: 360 } as const;
export const PICTURE_ATLAS = { w: FACE.w * 2, h: FACE.h * 4 } as const;
export function faceRect(idea: PlotIdea): AtlasRect { const i = PLOT_IDEAS.indexOf(idea); return { x: (i % 2) * FACE.w, y: Math.floor(i / 2) * FACE.h, w: FACE.w, h: FACE.h }; }
/** The text atlas: the survey sign (two lines), the centre plaque, then one demo label per idea. */
export const TEXT_ATLAS = { w: 1024, h: 768 } as const;
export const SIGN_RECT: AtlasRect = { x: 0, y: 0, w: 1024, h: 256 };
export const PLAQUE_RECT: AtlasRect = { x: 0, y: 256, w: 1024, h: 128 };
export function labelRect(idea: PlotIdea): AtlasRect { const i = PLOT_IDEAS.indexOf(idea); return { x: (i % 2) * 512, y: 384 + Math.floor(i / 2) * 96, w: 512, h: 96 }; }

/** Each plot shows four different ideas, one per entry; neighbouring plots in the catalogue's order mostly differ. */
export function plotIdeas(ordinal: number): Readonly<Record<PlotSide, { readonly billboard: PlotIdea; readonly demo: PlotIdea }>> {
  const at = (n: number): PlotIdea => PLOT_IDEAS[((n % PLOT_IDEAS.length) + PLOT_IDEAS.length) % PLOT_IDEAS.length] ?? 'desert-ruin';
  const base = 4 * ordinal + 2 * Math.floor(ordinal / 2);
  const entry = (i: number): { billboard: PlotIdea; demo: PlotIdea } => ({ billboard: at(base + i), demo: at(base + i + 5) });
  return { north: entry(0), east: entry(1), south: entry(2), west: entry(3) };
}

type V3 = readonly [number, number, number];
type Rgb = readonly [number, number, number];
/** The plot's buffers, all in plot-local metres. */
export interface OpenPlotGeometry {
  readonly solid: { readonly positions: Float32Array; readonly colours: Float32Array; readonly indices: Uint32Array };
  readonly lines: Float32Array;
  readonly pictures: { readonly positions: Float32Array; readonly uvs: Float32Array; readonly indices: Uint32Array };
  readonly text: { readonly positions: Float32Array; readonly uvs: Float32Array; readonly indices: Uint32Array };
  /** the hologram turns about the plot's y axis, so its parts are separate draws under one group */
  readonly holoLines: Float32Array;
  readonly holoCards: { readonly positions: Float32Array; readonly uvs: Float32Array; readonly indices: Uint32Array };
  /** the scan plane's square half size and the band it sweeps (y) */
  readonly scan: { readonly half: number; readonly low: number; readonly high: number };
  /** the collider: the floor and every solid, one trimesh (plot-local) */
  readonly collider: { readonly positions: Float32Array; readonly indices: Uint32Array };
  /** what each entry shows (for the readout and the captures) */
  readonly entries: Readonly<Record<PlotSide, { readonly billboard: PlotIdea; readonly demo: PlotIdea }>>;
}

const LIGHT: V3 = norm([0.45, 0.8, 0.35]);
function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function hex(n: number): Rgb { return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

/** Solid triangles with baked light (no scene lights needed, so it reads the same under every shard's frame). */
class Solid {
  readonly p: number[] = []; readonly c: number[] = []; readonly i: number[] = [];
  quad(corners: readonly V3[], normal: V3, colour: Rgb): void {
    const base = this.p.length / 3, n = norm(normal), lit = 0.6 + 0.32 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) + (n[1] < -0.5 ? -0.15 : 0);
    for (const v of corners) { this.p.push(v[0], v[1], v[2]); this.c.push(colour[0] * lit, colour[1] * lit, colour[2] * lit); }
    const [a, b, c] = corners;
    if (a === undefined || b === undefined || c === undefined) return;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [(e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0), (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0), (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0)];
    const facing = (cross[0] ?? 0) * n[0] + (cross[1] ?? 0) * n[1] + (cross[2] ?? 0) * n[2] >= 0;
    if (corners.length === 3) { if (facing) this.i.push(base, base + 1, base + 2); else this.i.push(base, base + 2, base + 1); return; }
    if (facing) this.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  /** An oriented box: centre (x, z), bottom y0, height h, half extents along `yaw`'s axes. */
  box(x: number, z: number, y0: number, hx: number, hz: number, h: number, yaw: number, colour: Rgb): void {
    const ux = Math.cos(yaw), uz = -Math.sin(yaw), vx = Math.sin(yaw), vz = Math.cos(yaw), y1 = y0 + h;
    const at = (a: number, b: number, y: number): V3 => [x + ux * a * hx + vx * b * hz, y, z + uz * a * hx + vz * b * hz];
    this.quad([at(-1, -1, y1), at(1, -1, y1), at(1, 1, y1), at(-1, 1, y1)], [0, 1, 0], colour);
    this.quad([at(-1, -1, y0), at(1, -1, y0), at(1, 1, y0), at(-1, 1, y0)], [0, -1, 0], colour);
    this.quad([at(1, -1, y0), at(1, 1, y0), at(1, 1, y1), at(1, -1, y1)], [ux, 0, uz], colour);
    this.quad([at(-1, -1, y0), at(-1, 1, y0), at(-1, 1, y1), at(-1, -1, y1)], [-ux, 0, -uz], colour);
    this.quad([at(-1, 1, y0), at(1, 1, y0), at(1, 1, y1), at(-1, 1, y1)], [vx, 0, vz], colour);
    this.quad([at(-1, -1, y0), at(1, -1, y0), at(1, -1, y1), at(-1, -1, y1)], [-vx, 0, -vz], colour);
  }
  /** A prism (cylinder, cone or frustum) of `sides` faces from y0, radius r0 at the bottom and r1 at the top. */
  prism(x: number, z: number, y0: number, r0: number, r1: number, h: number, sides: number, colour: Rgb, top = colour): void {
    const y1 = y0 + h, ring = (r: number, y: number, k: number): V3 => [x + Math.cos(k / sides * Math.PI * 2) * r, y, z + Math.sin(k / sides * Math.PI * 2) * r];
    for (let k = 0; k < sides; k++) {
      const a = (k + 0.5) / sides * Math.PI * 2, slope = (r0 - r1) / Math.max(h, 1e-3);
      this.quad([ring(r0, y0, k), ring(r0, y0, k + 1), ring(r1, y1, k + 1), ring(r1, y1, k)], [Math.cos(a), slope, Math.sin(a)], colour);
      if (r1 > 0.01) this.quad([[x, y1, z], ring(r1, y1, k), ring(r1, y1, k + 1)], [0, 1, 0], top);
      this.quad([[x, y0, z], ring(r0, y0, k + 1), ring(r0, y0, k)], [0, -1, 0], colour);
    }
  }
}
/** Line segments (pairs of points). */
class Lines {
  readonly p: number[] = [];
  seg(a: V3, b: V3): void { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
  box(x: number, z: number, y0: number, hx: number, hz: number, h: number, yaw: number): void {
    const ux = Math.cos(yaw), uz = -Math.sin(yaw), vx = Math.sin(yaw), vz = Math.cos(yaw);
    const at = (a: number, b: number, y: number): V3 => [x + ux * a * hx + vx * b * hz, y, z + uz * a * hx + vz * b * hz];
    const loop = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
    for (let k = 0; k < 4; k++) {
      const [a0, b0] = loop[k] ?? [0, 0], [a1, b1] = loop[(k + 1) % 4] ?? [0, 0];
      this.seg(at(a0, b0, y0), at(a1, b1, y0)); this.seg(at(a0, b0, y0 + h), at(a1, b1, y0 + h)); this.seg(at(a0, b0, y0), at(a0, b0, y0 + h));
    }
  }
  prism(x: number, z: number, y0: number, r0: number, r1: number, h: number, sides: number): void {
    const ring = (r: number, y: number, k: number): V3 => [x + Math.cos(k / sides * Math.PI * 2) * r, y, z + Math.sin(k / sides * Math.PI * 2) * r];
    for (let k = 0; k < sides; k++) { this.seg(ring(r0, y0, k), ring(r0, y0, k + 1)); this.seg(ring(r1, y0 + h, k), ring(r1, y0 + h, k + 1)); this.seg(ring(r0, y0, k), ring(r1, y0 + h, k)); }
  }
}
/** Textured quads into an atlas (front face toward `normal`, upright). */
class Quads {
  readonly p: number[] = []; readonly uv: number[] = []; readonly i: number[] = [];
  constructor(private readonly atlas: { readonly w: number; readonly h: number }) {}
  add(centre: V3, normal: { x: number; z: number }, w: number, h: number, rect: AtlasRect): void {
    const rx = normal.z, rz = -normal.x, base = this.p.length / 3; // the viewer's right, facing the quad from its front
    const u0 = rect.x / this.atlas.w, u1 = (rect.x + rect.w) / this.atlas.w, v1 = 1 - rect.y / this.atlas.h, v0 = 1 - (rect.y + rect.h) / this.atlas.h;
    const corner = (a: number, b: number): void => { this.p.push(centre[0] + rx * a * w / 2, centre[1] + b * h / 2, centre[2] + rz * a * w / 2); };
    corner(-1, -1); corner(1, -1); corner(1, 1); corner(-1, 1);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  out(): { positions: Float32Array; uvs: Float32Array; indices: Uint32Array } { return { positions: new Float32Array(this.p), uvs: new Float32Array(this.uv), indices: new Uint32Array(this.i) }; }
}

const C = {
  steel: hex(0x2b3540), steelLight: hex(0x55606b), white: hex(0xe9edf0), orange: hex(0xff7a1a), navy: hex(0x0d1b26), grey: hex(0x8d949b),
  greyDark: hex(0x6c737a), concrete: hex(0xb9bcbd), scaffold: hex(0xd8a23a), cyan: hex(0x38e6ff),
} as const;

/** One entry's frame: depth `s` inward from the plot edge, lateral `t` to the right of a traveller looking in. */
interface EntryFrame { readonly out: { x: number; z: number }; readonly at: (s: number, t: number) => { x: number; z: number }; readonly yaw: number }
function entryFrame(side: PlotSide): EntryFrame {
  const out = side === 'north' ? { x: 0, z: 1 } : side === 'south' ? { x: 0, z: -1 } : side === 'east' ? { x: 1, z: 0 } : { x: -1, z: 0 };
  const f = { x: -out.x, z: -out.z }, r = { x: -f.z, z: f.x };
  return { out, at: (s, t) => ({ x: out.x * CHUNK_HALF + f.x * s + r.x * t, z: out.z * CHUNK_HALF + f.z * s + r.z * t }),
    // yaw that turns local +x onto the lateral axis r (Solid.box's u axis is (cos yaw, −sin yaw))
    yaw: Math.atan2(-r.z, r.x) };
}

/** The demo corner's palette and pieces, per idea: finished at the front, then blockout, then wireframe. */
type Piece = { readonly kind: 'box'; readonly u: number; readonly w: number; readonly y: number; readonly hx: number; readonly hz: number; readonly h: number; readonly c: Rgb }
  | { readonly kind: 'prism'; readonly u: number; readonly w: number; readonly y: number; readonly r0: number; readonly r1: number; readonly h: number; readonly sides: number; readonly c: Rgb; readonly top?: Rgb };
const box = (u: number, w: number, y: number, hx: number, hz: number, h: number, c: number): Piece => ({ kind: 'box', u, w, y, hx, hz, h, c: hex(c) });
const prism = (u: number, w: number, y: number, r0: number, r1: number, h: number, sides: number, c: number, top?: number): Piece => ({ kind: 'prism', u, w, y, r0, r1, h, sides, c: hex(c), ...(top === undefined ? {} : { top: hex(top) }) });
/** `u` across (−14..14), `w` depth into the plot (−14 front .. 14 back), metres. */
const DEMOS: Readonly<Record<PlotIdea, (out: Piece[]) => number>> = {
  'desert-ruin': (out) => {
    for (const u of [-9, -3, 3, 9]) out.push(box(u, -8, 0, 1.2, 1.2, 9, 0xd9a86a), box(u, 2, 0, 1.2, 1.2, 9, 0xd9a86a), box(u, 11, 0, 1.2, 1.2, 9, 0xd9a86a));
    out.push(box(0, -8, 9, 11, 1.4, 2, 0xe2b77a), box(0, 2, 9, 11, 1.4, 2, 0xe2b77a), box(0, 11, 9, 11, 1.4, 2, 0xe2b77a));
    out.push(prism(-6, -12, 0, 2.6, 2.2, 3.4, 7, 0xc99a5e), box(8, -12, 0, 2.5, 1.6, 1.4, 0xc99a5e), prism(12, -4, 0, 1, 1, 6, 8, 0xe0b27a));
    return 0xe8c78e;
  },
  'night-market': (out) => {
    for (const u of [-9, 0, 9]) for (const w of [-9, 1, 10]) { out.push(box(u, w, 0, 3.4, 2.2, 2.6, 0x3a2a3e), box(u, w, 2.6, 3.8, 2.6, 0.5, [0xff3d8b, 0x2fe0ff, 0xffa53d][(u + 9) / 9] ?? 0xff3d8b)); }
    for (const u of [-13, 13]) for (const w of [-12, -2, 8]) out.push(prism(u, w, 0, 0.25, 0.25, 6, 6, 0x222a33), prism(u, w, 6, 0.9, 0.9, 1.2, 8, 0xff8a3d));
    return 0x2a2f3a;
  },
  'frozen-lighthouse': (out) => {
    out.push(prism(4, 0, 0, 7, 7.5, 2, 9, 0xb8c6d4, 0xf4f8fb));
    for (let k = 0; k < 6; k++) out.push(prism(4, 0, 2 + k * 4, 4.2 - k * 0.35, 3.85 - k * 0.35, 4, 10, k % 2 === 0 ? 0xd8323a : 0xf3f3f3));
    out.push(prism(4, 0, 26, 2.4, 2.4, 2.2, 10, 0xffe9a6), prism(4, 0, 28.2, 2.8, 0.4, 2.2, 10, 0x2b3540));
    out.push(box(-8, -10, 0, 3, 2, 1.5, 0xdfeaf2), box(-10, 2, 0, 2, 3, 2.4, 0xcfe3ef), prism(-5, 9, 0, 3, 0.5, 4, 5, 0xe8f2f8));
    return 0xe4eef4;
  },
  'canyon-railway': (out) => {
    out.push(box(-10, -6, 0, 3.5, 5, 10, 0xb5522e), box(-10, -6, 10, 2.8, 4, 4, 0xc9673d), box(10, 6, 0, 3.5, 6, 13, 0xa94a2a));
    for (let w = -13; w <= 13; w += 2) out.push(box(0, w, 4.6, 2.2, 0.35, 0.3, 0x6e4a2c));
    out.push(box(-1, 0, 4.9, 0.12, 14, 0.25, 0x8c949b), box(1, 0, 4.9, 0.12, 14, 0.25, 0x8c949b));
    for (const w of [-10, -2, 6, 13]) for (const u of [-1.8, 1.8]) out.push(box(u, w, 0, 0.3, 0.3, 4.6, 0x5a3a22));
    return 0xd28a5a;
  },
  'coral-reef': (out) => {
    for (const [u, w, r, h, c] of [[-9, -9, 2.2, 3, 0xff5f8f], [-3, -11, 1.4, 4.5, 0xffa040], [6, -8, 2.6, 2.4, 0x3ad6c8], [11, -2, 1.6, 5, 0xff5f8f], [-11, 3, 2, 3.4, 0x9a6bff], [2, 4, 3, 2, 0xffa040], [9, 10, 1.8, 4, 0x3ad6c8], [-6, 11, 2.4, 3, 0xff5f8f]] as const) {
      out.push(prism(u, w, 0, r, r * 0.4, h, 7, c), prism(u + r * 0.6, w, h * 0.6, r * 0.5, 0.2, h * 0.7, 6, c));
    }
    out.push(box(-2, 0, 0, 2.5, 7, 2.5, 0x5b4636), box(-2, 4, 2.5, 0.3, 0.3, 8, 0x4a382a));
    return 0xf0dca8;
  },
  'alien-plain': (out) => {
    for (const [u, w, s] of [[-8, -9, 1.2], [6, -10, 0.8], [-10, 2, 1], [8, 1, 1.4], [0, 10, 1.1], [-6, 11, 0.7]] as const) {
      out.push(prism(u, w, 0, 0.7 * s, 0.6 * s, 7 * s, 8, 0xf2e3ff), prism(u, w, 7 * s, 4.4 * s, 0.6 * s, 2.4 * s, 10, s > 1 ? 0xff7ab8 : 0xb98cff, 0xffc4e1));
    }
    out.push(prism(2, -3, 0, 1, 0.05, 6, 5, 0x9ff3ff), prism(-2, 5, 0, 0.8, 0.05, 4.5, 5, 0xc6a8ff));
    return 0xd9b8e8;
  },
  'ink-valley': (out) => {
    out.push(box(-4.5, -6, 0, 0.6, 0.6, 7, 0xc8322b), box(4.5, -6, 0, 0.6, 0.6, 7, 0xc8322b), box(0, -6, 7, 7, 0.8, 0.8, 0x1d1d22), box(0, -6, 5.6, 5.6, 0.4, 0.5, 0xc8322b));
    for (let w = -12; w <= 12; w += 3) out.push(box(Math.sin(w / 5) * 2, w, 0, 1.6, 1.2, 0.18, 0x9a9f9c));
    out.push(box(8, -10, 0, 1, 1, 1.4, 0x8e918d), box(8, -10, 1.4, 1.6, 1.6, 0.4, 0x6a6d69), box(8, -10, 1.8, 0.8, 0.8, 0.9, 0xfff0b8), prism(8, -10, 2.7, 1.8, 0.1, 1, 4, 0x4a4d49));
    out.push(prism(-10, 4, 0, 0.6, 0.5, 6, 6, 0x4a3426), prism(-10, 4, 5, 4.2, 0.4, 4, 7, 0x2f5a3a), prism(10, 8, 0, 0.6, 0.5, 5, 6, 0x4a3426), prism(10, 8, 4, 3.6, 0.4, 3.6, 7, 0x2f5a3a));
    return 0xcfd3c8;
  },
  'sky-race': (out) => {
    for (const [u, w, r, y] of [[-8, -9, 4.5, 3], [7, -4, 3.6, 7], [-5, 6, 4, 11], [8, 11, 3.2, 15]] as const) {
      out.push(prism(u, w, y - 4, 0.6, r, 4, 7, 0x8a7a66), prism(u, w, y, r, r, 0.7, 7, 0x6bc56a));
    }
    for (const [u, w, y] of [[0, -12, 2], [0, 0, 8], [0, 12, 14]] as const) {
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; out.push(box(u + Math.cos(a) * 3.2, w, y + 3.2 + Math.sin(a) * 3.2, 0.5, 0.25, 0.9, 0xffc23a)); }
    }
    return 0x9ad06f;
  },
};
function demoPieces(idea: PlotIdea): { ground: number; pieces: Piece[] } { const pieces: Piece[] = []; return { ground: DEMOS[idea](pieces), pieces }; }

/** The plot's whole geometry for its catalogue ordinal (which ideas it shows). */
export function openPlotGeometry(ordinal: number): OpenPlotGeometry {
  const solid = new Solid(), lines = new Lines(), holo = new Lines(), pictures = new Quads(PICTURE_ATLAS), text = new Quads(TEXT_ATLAS), cards = new Quads(PICTURE_ATLAS);
  const entries = plotIdeas(ordinal), H = CHUNK_HALF;
  // corner beacons (B): white-and-orange striped posts, a cyan beam to the sky
  for (const [x, z] of [[-H, -H], [H, -H], [H, H], [-H, H]] as const) {
    const cx = x - Math.sign(x) * 1.5, cz = z - Math.sign(z) * 1.5;
    solid.box(cx, cz, 0, 1.1, 1.1, 0.4, 0, C.steel);
    for (let k = 0; k < 6; k++) solid.box(cx, cz, 0.4 + k * 0.9, 0.45, 0.45, 0.9, 0, k % 2 === 0 ? C.white : C.orange);
    solid.prism(cx, cz, 5.8, 0.7, 0.7, 0.6, 8, C.cyan);
    lines.seg([cx, 6.4, cz], [cx, 220, cz]); lines.seg([cx + 0.3, 6.4, cz], [cx + 0.3, 160, cz]);
  }
  for (const side of PLOT_SIDES) {
    const frame = entryFrame(side), { billboard, demo } = entries[side], n = frame.out;
    const P = (s: number, t: number, y: number): V3 => { const p = frame.at(s, t); return [p.x, y, p.z]; };
    // the entry pad: the stub's asphalt carried in to the sign, half-laid at its end
    for (let s = 1; s < 18; s += 2) for (const t of [-3, -1, 1, 3]) {
      if (s > 13 && (s + t * 3) % 4 === 0) continue;
      const p = frame.at(s, t); solid.box(p.x, p.z, 0, 0.95, 0.95, 0.06, frame.yaw, s > 13 ? C.greyDark : C.concrete);
    }
    // the survey sign (B / H) on two striped posts across the end of the stub
    for (const t of [-5.2, 5.2]) { const p = frame.at(14, t); for (let k = 0; k < 4; k++) solid.box(p.x, p.z, k * 0.8, 0.2, 0.2, 0.8, frame.yaw, k % 2 === 0 ? C.white : C.orange); }
    { const p = frame.at(14.15, 0); solid.box(p.x, p.z, 2.0, 5.0, 0.08, 1.9, frame.yaw, C.navy); text.add(P(14, 0, 2.95), n, 9.6, 1.8, SIGN_RECT); }
    // the billboard on the left: steel legs, a frame, the picture facing the road
    { const c = frame.at(36, -30), w = 22, h = 16.5, bottom = 7;
      for (const t of [-8, 8]) { const p = frame.at(36.6, -30 + t); solid.box(p.x, p.z, 0, 0.35, 0.35, bottom, frame.yaw, C.steelLight); solid.box(p.x, p.z, 0, 1.1, 1.1, 0.5, frame.yaw, C.steel); }
      const back = frame.at(36.5, -30); solid.box(back.x, back.z, bottom - 0.6, w / 2 + 0.6, 0.35, h + 1.2, frame.yaw, C.steel);
      for (const t of [-7, 0, 7]) { const p = frame.at(35.4, -30 + t); solid.box(p.x, p.z, bottom + h + 0.6, 0.15, 0.6, 0.25, frame.yaw, C.steelLight); }
      pictures.add([c.x + n.x * 0.1, bottom + h / 2, c.z + n.z * 0.1], n, w, h, faceRect(billboard));
    }
    // the half-built demo corner on the right, its label on a post at the path
    const { ground, pieces } = demoPieces(demo), centre = { s: 40, t: 32 };
    const at = (u: number, w: number): { x: number; z: number } => frame.at(centre.s + w, centre.t + u);
    // half-laid ground tiles: full at the front, gaps toward the middle, none at the back (the wireframe grid shows there)
    for (let w = -14; w < 14; w += 2) for (let u = -14; u < 14; u += 2) {
      if (w > 4 || (w > -4 && ((u * 7 + w * 3) & 3) === 0)) continue;
      const p = at(u + 1, w + 1); solid.box(p.x, p.z, 0, 0.98, 0.98, 0.12, frame.yaw, w < -4 ? hex(ground) : C.grey);
    }
    for (const piece of pieces) {
      const stage = piece.w < -3 ? 'built' : piece.w < 5 ? 'blockout' : 'wire', p = at(piece.u, piece.w);
      if (piece.kind === 'box') {
        if (stage === 'built') solid.box(p.x, p.z, piece.y, piece.hx, piece.hz, piece.h, frame.yaw, piece.c);
        else if (stage === 'blockout') solid.box(p.x, p.z, piece.y, piece.hx, piece.hz, piece.h, frame.yaw, C.grey);
        else lines.box(p.x, p.z, piece.y, piece.hx, piece.hz, piece.h, frame.yaw);
      } else if (stage === 'built') solid.prism(p.x, p.z, piece.y, piece.r0, piece.r1, piece.h, piece.sides, piece.c, piece.top);
      else if (stage === 'blockout') { const r = Math.max(piece.r0, piece.r1) * 0.8; solid.box(p.x, p.z, piece.y, r, r, piece.h, frame.yaw, C.grey); }
      else lines.prism(p.x, p.z, piece.y, piece.r0, piece.r1, piece.h, piece.sides);
    }
    // scaffold along the built / blockout seam, and the wireframe lot outline at the back
    for (let u = -14; u <= 14; u += 4) for (const w of [-3.5, -2]) { const p = at(u, w); solid.box(p.x, p.z, 0, 0.09, 0.09, 12, frame.yaw, C.scaffold); }
    for (const y of [4, 8, 12]) { const a = at(0, -3.5), b = at(0, -2); solid.box(a.x, a.z, y - 0.1, 14, 0.08, 0.16, frame.yaw, C.scaffold); solid.box(b.x, b.z, y - 0.1, 14, 0.08, 0.16, frame.yaw, C.scaffold); }
    { const back = at(0, 9.5); lines.box(back.x, back.z, 0, 14.5, 4.5, 0.02, frame.yaw); for (let u = -14; u <= 14; u += 4) { const a = at(u, 5), b = at(u, 14); lines.seg([a.x, 0.1, a.z], [b.x, 0.1, b.z]); } }
    { const p = frame.at(20, 15); solid.box(p.x, p.z, 0, 0.12, 0.12, 4.6, frame.yaw, C.steelLight); const q = frame.at(19.9, 17.2); solid.box(q.x, q.z, 4.2, 2.6, 0.06, 0.8, frame.yaw, C.navy); text.add(P(19.8, 17.2, 4.6), n, 5.0, 0.94, labelRect(demo)); lines.seg([p.x, 4.6, p.z], [p.x, 9, p.z]); }
  }
  // the centrepiece: a stepped octagonal plinth, a hologram of a shard being built turning above it, cards of every idea
  solid.prism(0, 0, 0, 24, 24, 0.5, 8, C.steel, C.steelLight); solid.prism(0, 0, 0.5, 19, 19, 0.5, 8, C.steel, C.steelLight); solid.prism(0, 0, 1.0, 14, 13.5, 0.6, 8, C.navy, C.steel);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; solid.prism(Math.cos(a) * 21.5, Math.sin(a) * 21.5, 0.5, 0.45, 0.45, 1.6, 6, C.cyan); }
  for (const side of PLOT_SIDES) { const f = entryFrame(side), p = f.at(H - 25.5, 0), n = f.out; text.add([p.x + n.x * 0.06, 0.78, p.z + n.z * 0.06], n, 8.4, 1.05, PLAQUE_RECT); }
  for (let k = 0; k < 48; k++) { const a0 = k / 48 * Math.PI * 2, a1 = (k + 1) / 48 * Math.PI * 2; lines.seg([Math.cos(a0) * 34, 0.08, Math.sin(a0) * 34], [Math.cos(a1) * 34, 0.08, Math.sin(a1) * 34]); }
  // the hologram: a 30 m shard cube, its terrain as a wire height field, half its towers solid-edged, beams from the plinth
  const S = 15, base = 10;
  holo.box(0, 0, base, S, S, 2 * S, 0); holo.box(0, 0, base, S * 0.98, S * 0.98, 0.01, 0);
  const field = (x: number, z: number): number => base + 3 + 2.6 * Math.sin(x * 0.35) * Math.cos(z * 0.28) + 1.4 * Math.sin((x + z) * 0.6);
  for (let i = -6; i <= 6; i++) for (let j = -6; j < 6; j++) {
    const a = i * 2.4, b0 = j * 2.4, b1 = (j + 1) * 2.4;
    holo.seg([a, field(a, b0), b0], [a, field(a, b1), b1]); holo.seg([b0, field(b0, a), a], [b1, field(b1, a), a]);
  }
  for (const [x, z, h] of [[-8, -6, 11], [-3, -9, 7], [6, -7, 14], [9, 4, 9], [-7, 7, 12], [2, 8, 6], [0, 0, 18]] as const) holo.box(x, z, field(x, z), 1.6, 1.6, h, 0.3);
  for (const [x, z] of [[-S, -S], [S, -S], [S, S], [-S, S]] as const) holo.seg([x * 0.5, 1.6, z * 0.5], [x, base, z]);
  PLOT_IDEAS.forEach((idea, k) => {
    const a = k / PLOT_IDEAS.length * Math.PI * 2, r = 30, n = { x: Math.cos(a), z: Math.sin(a) };
    cards.add([n.x * r, 26, n.z * r], n, 12, 9, faceRect(idea)); cards.add([n.x * (r - 0.05), 26, n.z * (r - 0.05)], { x: -n.x, z: -n.z }, 12, 9, faceRect(idea));
  });
  const floor = [-H, 0, -H, H, 0, -H, H, 0, H, -H, 0, H], solidPositions = new Float32Array(solid.p), solidIndices = new Uint32Array(solid.i);
  const colliderPositions = new Float32Array(floor.length + solidPositions.length); colliderPositions.set(floor); colliderPositions.set(solidPositions, floor.length);
  const colliderIndices = new Uint32Array(6 + solidIndices.length); colliderIndices.set([0, 2, 1, 0, 3, 2]); for (let k = 0; k < solidIndices.length; k++) colliderIndices[6 + k] = (solidIndices[k] ?? 0) + 4;
  return {
    solid: { positions: solidPositions, colours: new Float32Array(solid.c), indices: solidIndices },
    lines: new Float32Array(lines.p), pictures: pictures.out(), text: text.out(), holoLines: new Float32Array(holo.p), holoCards: cards.out(),
    scan: { half: S * 0.97, low: base + 0.5, high: base + 2 * S - 0.5 },
    collider: { positions: colliderPositions, indices: colliderIndices }, entries,
  };
}

/** Bytes a plot's buffers retain (each is uploaded once: counted as JS + GPU by the caller). */
export function openPlotBytes(g: OpenPlotGeometry): number {
  const arrays = [g.solid.positions, g.solid.colours, g.solid.indices, g.lines, g.pictures.positions, g.pictures.uvs, g.pictures.indices, g.text.positions, g.text.uvs, g.text.indices, g.holoLines, g.holoCards.positions, g.holoCards.uvs, g.holoCards.indices];
  return arrays.reduce((sum, a) => sum + a.byteLength, 0);
}
