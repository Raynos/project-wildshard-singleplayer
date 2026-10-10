import { bandSkin as platformBandSkin, quadrupedHull as platformQuadrupedHull, type BandSkinRow as PlatformBandSkinRow, type FittedHull as PlatformFittedHull, type HullBand as PlatformHullBand, type HullBone as PlatformHullBone, type HullTint as PlatformHullTint, type QuadrupedHullRow as PlatformQuadrupedHullRow } from '@wildshard/game/systems/looks/fittedHull';

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
