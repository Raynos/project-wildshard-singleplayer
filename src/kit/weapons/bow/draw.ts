import { BowDraw as PlatformBowDraw, DRAW_TIME as PlatformDRAW_TIME, LETDOWN_TIME as PlatformLETDOWN_TIME, RENOCK_TIME as PlatformRENOCK_TIME, RN_EARLY as PlatformRN_EARLY, HOLD_STEADY as PlatformHOLD_STEADY, HOLD_TIRE as PlatformHOLD_TIRE, TIRED_TIME as PlatformTIRED_TIME, type DrawEvent as PlatformDrawEvent } from '@wildshard/engine/combat/bowDraw';

/** Transitional kit name for the pure platform draw event. */
export type DrawEvent = PlatformDrawEvent;
/** Transitional constructor inherits the platform clock; no state-machine implementation remains in the kit. */
export class BowDraw extends PlatformBowDraw {}
/** Compatibility alias of the defining platform DRAW_TIME. */
export const DRAW_TIME: typeof PlatformDRAW_TIME = PlatformDRAW_TIME;
/** Compatibility alias of the defining platform LETDOWN_TIME. */
export const LETDOWN_TIME: typeof PlatformLETDOWN_TIME = PlatformLETDOWN_TIME;
/** Compatibility alias of the defining platform RENOCK_TIME. */
export const RENOCK_TIME: typeof PlatformRENOCK_TIME = PlatformRENOCK_TIME;
/** Compatibility alias of the defining platform RN_EARLY. */
export const RN_EARLY: typeof PlatformRN_EARLY = PlatformRN_EARLY;
/** Compatibility alias of the defining platform HOLD_STEADY. */
export const HOLD_STEADY: typeof PlatformHOLD_STEADY = PlatformHOLD_STEADY;
/** Compatibility alias of the defining platform HOLD_TIRE. */
export const HOLD_TIRE: typeof PlatformHOLD_TIRE = PlatformHOLD_TIRE;
/** Compatibility alias of the defining platform TIRED_TIME. */
export const TIRED_TIME: typeof PlatformTIRED_TIME = PlatformTIRED_TIME;
