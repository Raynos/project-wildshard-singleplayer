import type { DuskLookRow } from './duskLook';
import { AERIAL_FOG, FAR_HAZE, FILL, FOG_SUN, KEY_DIM } from '../../data/dusk';
import { KEY_DIR, SKIRT_GRID, SKIRT_SWELL } from '../../data/sand';
import { SKY_STYLE } from '../../data/sky';
import { SAND_LOOK, SKY_LOOK } from '../../data/familyLook';
import { PAINTED_STAGES, PAINTED_URLS } from '../../data/files';
import { DEEP_KEY, DUSK_CLOCK, FOG, KEY_LIGHT, SAND_TINT } from '../../data/lastLight';

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
