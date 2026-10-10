// The sizes and specs Nine Dragon's code-built models share with their build-time builders (G285): the models collide and
// stand by them at load (../models/), the builders (../generators/) draw by them, and the geometry is baked
// (world/specimens.ts), so the numbers live here, on the page's side.
import { PLAZA, Y0 } from '../layout';

/** a stall's footprint (x0 … x1 along its front, z0 its back, z1 its front) */
export interface StallRect { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }

/** a stall's footprint about the origin (the stall models' own space, ../models/stalls.ts) */
export const centred = (r: StallRect): StallRect => {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return { x0: r.x0 - cx, x1: r.x1 - cx, z0: r.z0 - cz, z1: r.z1 - cz };
};

/** a booth's footprint: `w` along its counter, `d` deep behind its front */
export const BOOTH = { w: 2.6, d: 1.7 } as const;

/** a dining pavilion's size: half its span between posts, its height to the eave (the dining pavilion model collides
 *  with its table and posts, ../models/market.ts) */
export const PAV = { half: 1.3, h: 2.4 } as const;

/** a landing planter's size (w along the landing, d out from its wall) */
export const PLANTER = { w: 1.1, d: 0.5 } as const;

/** where the Well's balustrade model stands: the corner where the square's run and the street's meet */
export const WELL_BALUSTRADE_AT = { x: PLAZA.x0, y: Y0, z: PLAZA.z0 } as const;

/**
 * (E283, Jake's pick: the distance LODs) the balustrade's carved panel past PANEL_LOD m:
 * its frame and medallion without the ruyi scrolls, strokes 2–5 cm wide, about half a pixel there on the phone frame
 */
export const PANEL_LOD = 50;

/** which laundry the laundry line model's copy is (../models/laundry.ts): strung between gallery posts (`laundry`), along
 *  a lower-Well front (well-lower-life.ts `laundryLine`), a pole out from a wall (`laundryPole`) */
export type LaundryKind = 'gallery' | 'lower' | 'pole';

/** a paifang (../generators/gate.ts `buildGate`; the paifang model's three gates, ../models/paifang.ts) */
export interface GateSpec {
  x: number;
  y: number;
  z: number;
  posts: readonly [number, number, number, number];
  s: number;
  plaque: string;
  /** the paper couplets on the inner posts (null: none — E281, style-A's and the A2 targets' posts are bare lacquer) */
  couplets: readonly [string, string] | null;
  neonEaves: number | null;
  /** the lion pedestals before the centre bay (the organic lab's TRELLIS lions stand on them, props3d.ts) */
  lions: boolean;
  /**
   * E281 (the mockup pass): the elevation's scale. Every height and detail is built at s × k while the posts stay on
   * `posts` and the roofs keep their spans at s, so a k < 1 gate is lower and broader-roofed on the same footprint (style-A
   * and the A1 / A2 targets: a ~13 m gate whose roofs reach well past the centre bay; at k = 1 it stood 18 m).
   */
  k?: number;
  /** the paint: the hero lab's mineral blue-greens (the default) or style-A's cinnabar and gold (E281, Lantern Square) */
  paint?: 'mineral' | 'cinnabar';
}
