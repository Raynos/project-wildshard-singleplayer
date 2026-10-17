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

/** The fixed sun, toward the light (the panorama's sun at heading 352.16°, elevation 6.01°: data/panorama.json PANO_SUN). */
export const SKY_SUN = [-0.13565746816854515, 0.10470203849028618, -0.9852078635831522] as const;
/** The god rays' source (degrees, the engine compass): the painted sun. The engine compass faces (-sin az, cos az), the
 * panorama heading (sin h, -cos h), so az = h + 180 (E398; the panorama's sun: data/panorama.json PANO_SUN). */
export const SKY_RAYS = { azimuth: (352.16 + 180) % 360, elevation: 6.01 } as const;
/** The key light (its direction is `SKY_SUN`): colour (sRGB) and intensity. */
export const SKY_KEY = { colour: 0xffd2a2, intensity: 2 } as const;

/**
 * Golden hour, fixed: the sun sits low ahead of the spawn, just left of the windmill isle (the mockup's frame), so the
 * route looks into it: every island is back-lit, and the painted light keeps it readable. A fixed clock (Sky Reach runs no
 * day cycle: no `dayCycle` in `uses`), as the format's day clock row (`@wildshard/format/dayCycle` DayClockRow).
 */
export const SKY_DAY = { units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
  sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } } as const;

/** The painted sky (sRGB): a soft blue-lavender zenith, a peach-pink middle, a gold horizon; mauve cloud bellies, gold-pink
 * tops; the near cloud sea in the panorama's own palette (loop 4: lavender hollows, peach-gold tops). */
export const SKY = {
  zenith: 0x7f95d0, mid: 0xefb9ad, horizon: 0xffd89c, below: 0xf6e3d6, sun: 0xffdba2, key: SKY_KEY.colour, fog: 0xf0c9b6,
  cloudShade: 0xb08fb4, cloudShadeWarm: 0xe0a294, cloudLit: 0xffe0c4, isle: 0x9d8fb8, isleLit: 0xe2ad8c,
  seaShade: 0xa29dbd, seaShadeWarm: 0xe6b996, seaLit: 0xfff3e2,
} as const;
/** The haze's reach: E392 (the targets are clear and golden, our frames sat under a rose veil) starts it later and never
 * covers more than `max`; E399 (the council: 'grey-beige haze on the middle-distance islands') thins it. */
export const SKY_FOG = { near: 160, far: 720, max: 0.5 } as const;

/**
 * The cloud sea (review 2026-10-01 item 2): two layered sheets under the islands; the kill height sits just above the
 * high one. `size` is its baked tileable texture's (generators/seaTexture.ts); `maelstrom`: the sea twists toward an eye
 * under the storm crown (x, z, falloff radius m).
 */
export const SEA = { size: 64, low: -48, high: -34, radius: 1400, handoff: [240, 700], maelstrom: { x: 0, z: -190, r: 95 } } as const;

/**
 * Sky Reach's haze (the engine's `headingHaze`): the painted horizon's colour in the direction you look (gold toward the
 * sun, rose-lavender away), from the panorama's haze strip (data/panorama.json) warmed to gold (E392: the targets sink
 * far islands into warm gold); E399 (the council: 'no golden haze toward the sun'): the air toward the low sun goes only
 * a little gold over distance. Its near / far / max are `SKY_FOG`.
 */
export const SKY_HAZE = { tint: [1.04, 0.98, 0.84], sunHaze: 0.12, name: 'far.rose-fog', prefix: 'far' } as const;
