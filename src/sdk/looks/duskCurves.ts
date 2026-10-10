import { curveAt as platformCurveAt, duskRow as platformDuskRow, type DuskCurve as PlatformDuskCurve, type DuskRow as PlatformDuskRow, type DuskTerm as PlatformDuskTerm } from '@wildshard/game/systems/looks/duskCurves';

/** One term of a dusk curve: a gain times a power of d, a smoothstep between edges, or a smoothstep / linear ramp over a width. */
export type DuskTerm = PlatformDuskTerm;
/** A curve of one 0 … 1 progress value: scale × (base + Σ terms) × times, or a two-point mix. */
export type DuskCurve = PlatformDuskCurve;
/** A nested row whose `{ curve }` leaves move with the progress value. */
export type DuskRow = PlatformDuskRow;
/** A curve's value at d. */
export const curveAt: typeof platformCurveAt = platformCurveAt;
/** Every curve leaf of a row evaluated at d: a parameter block for that progress value. */
export const duskRow: typeof platformDuskRow = platformDuskRow;
