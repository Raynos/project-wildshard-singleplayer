import { BOW_PROFILE } from '../data/bowProfile';
/** The longbow's arrow in flight, renderer-free (SF72): gravity (m/s²), drag and the wind's pull (an engine ProjectileFlight). The page's arrow kind
 *  (weapons/longbowView.ts `arrowKind`) and the headless longbow (runtime/weapons/headlessLongbow.ts) fly these numbers. */
export const ARROW_FLIGHT = BOW_PROFILE.flight;
/** Arrows in flight at once (the oldest is recycled). */
export const ARROW_MAX_FLYING = BOW_PROFILE.pool;
/** The longbow's loose: m/s at brace + m/s more at full draw, the damage scale on the damage model's blow, the quiver. */
export const LONGBOW_LOOSE = { speedBase: BOW_PROFILE.speedBase, speedDraw: BOW_PROFILE.speedDraw, damageScale: BOW_PROFILE.damageScale, quiver: BOW_PROFILE.quiver, aimSpread: BOW_PROFILE.spread.aimMultiplier };
