import { bandSkin as platformBandSkin, loftedBandHull as platformLoftedBandHull, quadrupedHull as platformQuadrupedHull, quadrupedLook as platformQuadrupedLook, type BandSkinRow as PlatformBandSkinRow, type FittedHull as PlatformFittedHull, type HullBand as PlatformHullBand, type HullBone as PlatformHullBone, type HullTint as PlatformHullTint, type LoftedBandHullRow as PlatformLoftedBandHullRow, type QuadrupedHullRow as PlatformQuadrupedHullRow, type QuadrupedLookRow as PlatformQuadrupedLookRow } from '@wildshard/game/systems/looks/fittedHull';

/** One bone of a hull's skeleton (absolute bind space). */
export type HullBone = PlatformHullBone;
/** A four-legged generated hull as rows: its fit, legs and the shares that split it (SHARD-PLATFORM M3). */
export type QuadrupedHullRow = PlatformQuadrupedHullRow;
/** A fitted hull: its skeleton, its skinned geometry and its height. */
export type FittedHull = PlatformFittedHull;
/** A smooth band: 0 at `from`, 1 at `from + over`. */
export type HullBand = PlatformHullBand;
/** A winged generated hull as rows: its fit, its nose and its wing / tail / head bands. */
export type BandSkinRow = PlatformBandSkinRow;
/** A tint for a hull's painted facets: the back by a factor, the underside toward a belly colour. */
export type HullTint = PlatformHullTint;
/** A generated four-legged body fitted and rigidly skinned from its rows (an undrawn stand-in when the mesh is missing). */
export const quadrupedHull: typeof platformQuadrupedHull = platformQuadrupedHull;
/** A generated winged body fitted and band-skinned from its rows, tinted when a tint is given. */
export const bandSkin: typeof platformBandSkin = platformBandSkin;
/** A code-built winged body as rows: its mirrored outline, rim lift, centres, shades, bands and spine tail. */
export type LoftedBandHullRow = PlatformLoftedBandHullRow;
/** A four-legged hull's species look as rows: ids, rig contract and dims. */
export type QuadrupedLookRow = PlatformQuadrupedLookRow;
/** A code-built winged body lofted and band-skinned from its rows (the stand-in for a generated one). */
export const loftedBandHull: typeof platformLoftedBandHull = platformLoftedBandHull;
/** A species look on a fitted four-legged hull, animated by its clip rows. */
export const quadrupedLook: typeof platformQuadrupedLook = platformQuadrupedLook;
