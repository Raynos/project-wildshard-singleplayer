/**
 * Signal Dunes' fires as rows (review R5 / TOP-15 #8, style bible FX) on the platform's fire effect
 * (`@wildshard/game/systems/looks/fireFx`): each fire's size, and the one look every fire shares, tuned against the mockups.
 */

/** A waymark's roaring log fire (mockup C: about one and a half bowls tall; round 9: taller, more embers). */
export const WAYMARK_FIRE = { flame: 3.4, glow: 1.7, smoke: 11, embers: 260 } as const;
/** A smouldering cookfire beside the caravan: no flame to speak of, a thin pale wisp that curls, widens and fades (mockup B, round 10). */
export const COOKFIRE = { flame: 0.35, glow: 0.6, smoke: 14, embers: 12, wisp: true } as const;
/** The keeper's lamp in the tower's top (mockup dusk-fire): a small open flame in its cage (round 12: readable at 145 m). */
export const KEEPER_LAMP = { flame: 2.6, glow: 1.2, smoke: 0.01, embers: 4 } as const;
/** The signal fire on the tower's deck. */
export const SIGNAL_FIRE = { flame: 3.6, glow: 5, smoke: 48, embers: 160 } as const;

/** The look every Signal fire shares (linear RGB). */
export const FIRE_STYLE = {
  // round 18b (mockup C's thin plume drifts LEFT with the sparks): a light dusk breeze from the south-east, not the dune-forming wind
  breeze: [-0.5, -0.866],
  // E407 row 6 ('real fire'): a Blender gas sim's burning log pile, 32 frames emission-only, 8 x 4 cells (art/sunscar-dunes/round-26-fire)
  book: { url: '/assets/sunscar-dunes/fx/fire-book.webp', columns: 8, rows: 4, fps: 16, name: 'sunscar.fire.book' },
  // mockup C: saturated orange tongues, white only in the core (round 21: the core gated by its place, not its brightness)
  bookGrade: { power: [1, 1.35, 1.9], tint: [1.2, 0.95, 0.75], core: 5 },
  // rounds 8-12 (mockup C: a ragged log fire, deep saturated orange licks, a white-hot core low over the logs pushed past 1 for AgX)
  flame: { drift: { lean: 0.06, widen: 0, sway: 0.15 }, low: [0.9, 0.1, 0], high: [1, 0.42, 0.02], gain: 0.85, core: [1, 0.82, 0.52], coreGain: 4.2 },
  // rounds 8-21 (mockup C: a grey-brown billow lit warm at its foot, dark against the night above; round 21: wider, leaning downwind)
  plume: { drift: { lean: 0.36, widen: 2.6, sway: 0.15 }, foot: [0.3, 0.14, 0.06], top: [0.024, 0.02, 0.022], fade: 0.18, alpha: 0.9 },
  // mockup B / round 21: the cookfire's pale wisp barely leans on the breeze, it curls
  wisp: { drift: { lean: 0.025, widen: 6, sway: 2.4 }, foot: [0.16, 0.11, 0.1], top: [0.09, 0.08, 0.12], fade: 0.5, alpha: 0.55 },
  // loop 5 / round 8: a halo, not a wash, dimmer and redder; round 9 / 11: a lamp's own brighter, depth-tested halo
  glow: { colour: [1, 0.32, 0.06], gain: 0.14, lampGain: 0.42 },
  // round 8 / 9 (mockup C: short orange-red streaks)
  embers: { hot: [1, 0.42, 0.06], cool: [0.8, 0.1, 0], gain: 1.5 },
  // loop 5 / E399 (mockup C): the fire floods the sand round it orange, hot near the brazier (round 8: redder; round 10: dimmer)
  pool: { colour: [1, 0.3, 0.04], wide: 0.1, hot: 0.24 },
} as const;
