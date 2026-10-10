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
// SHARD-PLATFORM M3: the LOD switches and the program's GLSL and row are data (data/lanterns.ts); the lathe, the string,
// the hanging and the three-draw culling are the SDK's hanging lanterns (@wildshard/sdk/looks/hangingLanterns) on
// data/lanterns.ts's LANTERN_ROW.
import type { BufferGeometry } from 'three';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { HangingLanterns, clearHangingLanterns, hangingLanternPositions, lanternLathe, lanternString as sdkLanternString, updateHangingLanterns } from '@wildshard/sdk/looks/hangingLanterns';
import { LANTERN_PROGRAMS, LANTERN_ROW, LOD_DOT as LANTERN_LOD_DOT, LOD_NEAR as LANTERN_LOD_NEAR } from '../data/lanterns';
import { LOOK_FRAGMENTS, type Shared } from './style';

const LANTERN_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, LANTERN_PROGRAMS);
/** the near / far switch (m) (data/lanterns.ts) */
export const LOD_NEAR: number = LANTERN_LOD_NEAR;
/** past this a third draw, the 2 × 6 dot (data/lanterns.ts) */
export const LOD_DOT: number = LANTERN_LOD_DOT;

/** the lantern's lathe: `rings` bands down the body, `segs` around; caps + tassel only on the near one */
export function lanternGeometry(rings: number, segs: number, dressing: boolean): BufferGeometry { return lanternLathe(LANTERN_ROW, rings, segs, dressing); }

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
  constructor(shared: Shared) {
    super(LANTERN_FAMILY.material('lantern', shared.u), LANTERN_ROW);
  }
}
