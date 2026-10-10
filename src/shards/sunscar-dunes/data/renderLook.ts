import type { DuskLookRow } from '@wildshard/sdk/looks/duskLook';
import { AERIAL_FOG, FAR_HAZE, FILL, FOG_SUN, KEY_DIM } from './dusk';
import { KEY_DIR, SKIRT_GRID, SKIRT_SWELL } from './sand';
import { SKY_STYLE } from './sky';
import { SAND_LOOK, SKY_LOOK } from './familyLook';
import { PAINTED_STAGES, PAINTED_URLS } from './files';

/**
 * "Last Light"'s colours and clock as rows (look/render.ts builds its key, fog, sand tint and day clock from them;
 * docs/design/sunscar-dunes/style-bible.md). Linear RGB unless named.
 */
/** The key light's colour and intensity (its direction is data/sand.ts KEY_DIR). loop 3: a deeper, redder key (ΔE00 of
 *  the lit sand against the H1–H4 targets: the game's was too pale and grey-blue); E399 (R2B-1): measured against the
 *  mockups' ground patches, not eyeballed; loop 5 targets: saturated lit faces, deep shade. */
export const KEY_LIGHT = { color: [1, 0.68, 0.34], intensity: 1.85 } as const;
/** The key's colour at the blue hour (look/dusk.ts): a low red ember of the set sun. */
export const DEEP_KEY = [0.78, 0.42, 0.4] as const;
/** Violet aerial perspective (R9): far dune rows cool and lift into layers, never pink. round 22 (the lead after round
 *  21: the light band's 0x5e5288 turned A's mid dunes and D's far land milky lilac): the horizon's darker violet near the
 *  ground. */
export const FOG = { color: 0x3e3452, near: 80, far: 430 } as const;
/**
 * The sand's hollow / crest tint (round 1): a vertex's height against the mean of a `ring` m ring around it, over `span`
 * m, lerps the sand toward the hollow (× `hollowGain`) or the crest (× `crestGain`); the skirt is the sand `skirtHollow`
 * toward the hollow. loop 6: lit sand a gold-orange, less saturated and a little lighter than loop 5 (the targets' lit
 * faces); E399 (council round 2, R2B-1: the mockups' ground measures warm brown, R/B ~3): less blue in every tone.
 */
export const SAND_TINT = { sand: [0.5, 0.23, 0.075], hollow: [0.22, 0.14, 0.12], crest: [0.64, 0.33, 0.1], ring: 14, span: 2.5, hollowGain: 0.75, crestGain: 0.6, skirtHollow: 0.25 } as const;
/** The day clock: Signal Dunes holds at dusk (the clock is never advanced). */
export const DUSK_CLOCK = { units: 'hour', start: 19,
  schedule: [{ phase: 'day', from: 0, to: 24, minutes: 24 * 60 }],
  sun: { maxElevation: 60, azimuthOffset: 250 },
  fixed: { midday: 12, golden: 18, sunset: 19, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 19, night: 0 } } as const;

/**
 * "Last Light" as one dusk look row (SHARD-PLATFORM M3, `@wildshard/sdk/looks/duskLook`; look/render.ts binds it): the
 * violet fog, the key from 20° left of north (data/sand.ts KEY_DIR; round 19: one global art-directed direction that
 * lights the faces the mockups light, the painted glow staying right of the tower) dimming and reddening toward DEEP_KEY
 * as the quest's dusk deepens, the held clock, the dusk curves (data/dusk.ts), the sand tint, the skirt, the procedural
 * dome (data/sky.ts) and the two painted dusk stages that replace it (E409 second top-10 row 2).
 */
export const SIGNAL_DUSK_LOOK: DuskLookRow = {
  fog: FOG, key: { dir: KEY_DIR, color: KEY_LIGHT.color, deep: DEEP_KEY, intensity: KEY_LIGHT.intensity }, clock: DUSK_CLOCK,
  curves: { key: KEY_DIM, fill: FILL, fogSun: FOG_SUN, farHaze: FAR_HAZE, aerialFog: AERIAL_FOG },
  tint: SAND_TINT, skirt: { grid: SKIRT_GRID, swell: SKIRT_SWELL }, dome: SKY_STYLE, sand: SAND_LOOK, sky: SKY_LOOK,
  painted: { stages: PAINTED_STAGES, urls: PAINTED_URLS, tag: 'sunscar.sky', fault: '[sunscar-dunes] painted sky', scope: 'sunscar-dunes.sky' },
};
