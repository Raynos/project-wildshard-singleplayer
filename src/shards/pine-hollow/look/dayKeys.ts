import { keyedSkyDay } from '@wildshard/game/looks/keyedSkyClock';
import PINE_SKY from '../data/sky.json' with { type: 'json' };

/**
 * Pine Hollow's day / night clock (PINE-HOLLOW-REMASTER PH-L2): the keyed-sky row in data/sky.json as the engine's clock spec,
 * the sun's and moon's paths and the night curve (`@wildshard/game/looks/dayClock`; the lamps follow the presets' own).
 * Renderer-free: the headless host steps the same clock the page draws.
 */
const PINE = keyedSkyDay(PINE_SKY);
/** named phases for `?tod=`, Settings ▸ Time of day, the quest and the King's night */
export const PINE_PHASES = PINE_SKY.phases;
export const PINE_DAY = PINE.spec;
/** the clock with its row, for the backdrop (look/render.ts) */
export const PINE_KEYED_DAY = PINE;
