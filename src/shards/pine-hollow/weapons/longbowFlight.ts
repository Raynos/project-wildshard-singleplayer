/** The longbow's arrow in flight, renderer-free (SF72): gravity (m/s²), drag and the wind's pull (an engine ProjectileFlight). The page's arrow kind
 *  (weapons/longbowView.ts `arrowKind`) and the headless longbow (runtime/weapons/headlessLongbow.ts) fly these numbers. */
export const ARROW_FLIGHT = { gravity: 6, drag: 0.014, windCoupling: 0.25 } as const;
/** Arrows in flight at once (the oldest is recycled). */
export const ARROW_MAX_FLYING = 8;
/** The longbow's loose: m/s at brace + m/s more at full draw, the damage scale on the damage model's blow, the quiver. */
export const LONGBOW_LOOSE = { speedBase: 32, speedDraw: 30, damageScale: 1.35, quiver: 20 } as const;
