import { KEY_DIR } from './sand';

/**
 * The style bible's rim and shade floor ("Last Light") as a row of the shared painted look's painter light (G406: the
 * engine's `PainterLightRow`, as Sky Reach's; look/light.ts applies it once per standard material at build): a prop or
 * creature keeps an orange edge where its silhouette meets the sky, and its shaded side a cool sky-lit floor (`lift`), so
 * nothing reads as a black cut-out against the afterglow (review R1, R6). Unlike Sky's, the rim is unshaped (the same
 * all round, `rimBack` / `rimSide` [1, 0]) and there is no bounce and no floor. `sun`: the dusk key's direction.
 */
export const LAST_LIGHT = {
  // round 1 (R1C-2): a stronger cool sky floor and rim; leather and wood in shade read brown-violet, never black;
  // round 2: the rim (1, 0.5, 0.22) stronger still, × 1.2
  lift: [0.24, 0.21, 0.36], rim: [1.2, 0.6, 0.264], rimBack: [1, 0], rimSide: [1, 0],
  bounce: [0, 0, 0], bounceLift: 0, floor: [0, 0, 0], prefix: 'sunscar', optOut: 'SUNSCAR_NO_RIM',
} as const;

/** The direction the painter light's rim is shaped by (unused by an unshaped rim): the dusk key's. */
export const LAST_LIGHT_SUN = { x: KEY_DIR[0], y: KEY_DIR[1], z: KEY_DIR[2] } as const;
