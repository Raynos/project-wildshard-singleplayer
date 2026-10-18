// Red paper lanterns, merged from the neon lab (the dev labs (deleted in E357 F7)): body, lacquer caps and tassel in one
// geometry, told apart by `aPart`. The paper glows hot orange where you look through it at the candle and deep cinnabar
// at the rim, with 16 antialiased bamboo ribs (procedural: the lathe's segment count only shapes the silhouette), dark
// trim bands and a slow sway. The pivot is the hook (the lantern's top), like ctx.lantern().
// Round 14 (the budget freeze, dome C2's find: ~1100 lanterns × 348 tris ≈ 390 k, all drawn always): two instanced draws
// — near (≤ LOD_NEAR m) an 8 × 6 lathe with caps and tassel (192 tris), far a 6 × 4 body alone (48 tris) — and each
// frame the visible lanterns (a sphere per lantern against the view frustum) are bucketed into them (`updateLanterns`,
// called by the render strategy before the draw). Before the first update every lantern is in the near draw (the dev page).
// (E306 M4) the lantern is a model (models/paperLantern.ts: these three lathes are its level and LODs); `Lanterns` hangs
// them (their placements, seeds and glow emitters) and culls them, handed the model's levels by `place`.
// SHARD-PLATFORM M3: the LOD switches and the hanging are LANTERN_ROW (the lathe, the drop, the glow, the near and dot
// switches, which E283 picked); the paper is the 'nine-lantern' look graph (data/lookGraphs.json: the candle,
// the 16 ribs, the trim bands and the sway, fogged by the silk); the lathe, the string, the hanging and the three-draw
// culling are the hanging lanterns (../runtime/looks/hangingLanterns).
import type { BufferGeometry } from 'three';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import {
  HangingLanterns, type HangingLanternRow, clearHangingLanterns, hangingLanternPositions, lanternLathe, lanternString as sdkLanternString, updateHangingLanterns,
} from '../runtime/looks/hangingLanterns';

/** the near / far switch (m) */
export const LOD_NEAR = 35;
/** (E283, Jake's pick: the distance LODs) past this a third draw, the 2 × 6 dot (24 tris, half the far one's) */
export const LOD_DOT = 80;
/** a 0.27 m × 0.48 m body hung 0.3 m under its hook, its red glow, the switches and its 0.5 m bound round a centre 0.1 m under the pivot */
const LANTERN_SHAPE = { radius: 0.27, halfHeight: 0.24 };

/** the lantern's lathe: `rings` bands down the body, `segs` around; caps + tassel only on the near one */
export function lanternGeometry(rings: number, segs: number, dressing: boolean): BufferGeometry { return lanternLathe(LANTERN_SHAPE, rings, segs, dressing); }

/**
 * A lantern string strung from `a` to `b` (E281, the fabric pass): one hook every `spacing` metres (a region's density: the
 * square asks for more, the stair for fewer), the cord dropping `sag` metres at mid-span; the caller hangs `ctx.lantern`
 * at each hook (so the lanterns are these paper ones, with their LOD, glow and light pools).
 */
export const lanternString: typeof sdkLanternString = sdkLanternString;
/** bucket every lantern set for this camera (the render strategy's frame hook, before the draw) */
export const updateLanterns: typeof updateHangingLanterns = updateHangingLanterns;
/** forget the built sets (the render strategy's dispose) */
export const clearLanterns: typeof clearHangingLanterns = clearHangingLanterns;
/** The audio slice uses the same built placements as the visible lanterns. */
export const lanternAudioPositions: typeof hangingLanternPositions = hangingLanternPositions;

/** the paper lanterns: their placements, seeds and glow emitters, culled into the model's near / far / dot draws */
export class Lanterns extends HangingLanterns {
  constructor(row: Pick<HangingLanternRow, 'glow' | 'drop'>) {
    super(lentLook('nine-lantern'), { ...LANTERN_SHAPE, ...row, near: LOD_NEAR, dot: LOD_DOT, bound: 0.5, boundDrop: 0.1,
      names: { near: 'lanterns-near', far: 'lanterns-far', dot: 'lanterns-dot' } });
  }
}
