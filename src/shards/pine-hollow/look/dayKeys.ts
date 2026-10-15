import { dayClock } from '@wildshard/sdk/looks/dayClock';
import { SKY_PRESET } from '../data/keyedSkyRows';
import { PINE_SKY } from '../data/sky';

/**
 * Pine Hollow's day / night clock (PINE-HOLLOW-REMASTER PH-L2): the keyed-sky row in data/sky.ts as the engine's clock spec,
 * the sun's and moon's paths and the night curve (`@wildshard/sdk/looks/dayClock`; the lamps follow the presets' own).
 * Renderer-free: the headless host steps the same clock the page draws.
 */
const PINE = dayClock(SKY_PRESET, PINE_SKY, { lampsOf: (p) => p.lamps });
/** named phases for `?tod=`, Settings ▸ Time of day, the quest and the King's night */
export const PINE_PHASES = PINE_SKY.phases;
export const PINE_DAY = PINE.spec;
/** the clock with its row, for the backdrop (look/render.ts) */
export const PINE_KEYED_DAY = PINE;
