import { CoverGrid as PlatformCoverGrid, coverJitter as platformCoverJitter, coverSample as platformCoverSample, coverSeenGlsl as platformCoverSeenGlsl, tintTerrain as platformTintTerrain, triAreas as platformTriAreas, type CoverSample as PlatformCoverSample, type CoverTintGlsl as PlatformCoverTintGlsl, type CoverTintRow as PlatformCoverTintRow, type CoverTri as PlatformCoverTri } from '@wildshard/game/systems/looks/coverGrid';

/** What the cover grid holds at a point: mean colour (linear), top / side packed as 1 − e^−τ (SHARD-PLATFORM M3). */
export type CoverSample = PlatformCoverSample;
/** One triangle of cover for CoverGrid.splat. */
export type CoverTri = PlatformCoverTri;
/** The terrain tint's GLSL as data. */
export type CoverTintGlsl = PlatformCoverTintGlsl;
/** The terrain tint as a row: GLSL, patch id, program key suffix. */
export type CoverTintRow = PlatformCoverTintRow;
/** An empty sample to fill. */
export const coverSample: typeof platformCoverSample = platformCoverSample;
/** A triangle's ground area and upright cross-section. */
export const triAreas: typeof platformTriAreas = platformTriAreas;
/** A chunk-wide grid of what the ground cover makes the ground look like. */
export const CoverGrid: typeof PlatformCoverGrid = PlatformCoverGrid;
/** A cover grid (the class's instances). */
export type CoverGridSet = PlatformCoverGrid;
/** ×0.88 … ×1.12 per point, a hash of where it is. */
export const coverJitter: typeof platformCoverJitter = platformCoverJitter;
/** `coverSeen` spliced as a shader fragment. */
export const coverSeenGlsl: typeof platformCoverSeenGlsl = platformCoverSeenGlsl;
/** Gives a terrain mesh the cover's look: `aCover` per vertex and the view-angle mix. */
export const tintTerrain: typeof platformTintTerrain = platformTintTerrain;
