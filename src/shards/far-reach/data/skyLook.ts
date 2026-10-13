/**
 * Sky Reach's painted light (review 2026-10-01 item 1; the engine's `painterLight`): the golden-hour key stays low and
 * behind the islands (the mockup's mood), and three painter's terms keep the camera-facing sides from going black: a warm
 * bounce from the anti-sun side, a sun-coloured rim (island lips, the windmill, the pines, creatures, the fan) and a warm
 * plum shade floor (the review's p10 L* ≥ 25). The sun never moves here (no day cycle), so its direction is baked in.
 */
export const SKY_PAINTER_LIGHT = {
  // E399 round 2 (seat C: 'front-lit, a strong warm fill from behind the camera'): less fill, more rim, warmer shade
  bounce: [0.32, 0.21, 0.15],
  bounceLift: 0.55,
  rim: [2.6, 1.7, 0.85],
  // (round 7: the middle band's shade lifted here rather than by a global gamma, which flattened the unlit meadow)
  floor: [0.56, 0.44, 0.4],
  prefix: 'far', optOut: 'FAR_NO_PAINT',
} as const;

/**
 * Sky Reach's haze (the engine's `headingHaze`): the painted horizon's colour in the direction you look (gold toward the
 * sun, rose-lavender away), from the panorama's haze strip (look/panoramaData.ts) warmed to gold (E392: the targets sink
 * far islands into warm gold); E399 (the council: 'no golden haze toward the sun'): the air toward the low sun goes only
 * a little gold over distance. Its near / far / max are look/sun.ts `FOG`.
 */
export const SKY_HAZE = { tint: [1.04, 0.98, 0.84], sunHaze: 0.12, name: 'far.rose-fog', prefix: 'far' } as const;
