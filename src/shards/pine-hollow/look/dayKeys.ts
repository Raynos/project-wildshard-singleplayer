import { keyedSkyDay } from '@wildshard/sdk/looks/keyedSkyDay';
import { PINE_SKY } from '../data/sky';

/**
 * Pine Hollow's day / night clock (PINE-HOLLOW-REMASTER PH-L2): the keyed-sky row in data/sky.ts as the engine's clock spec,
 * the sun's and moon's paths and the night curve (`@wildshard/sdk/looks/keyedSkyDay`). Renderer-free: the headless host
 * steps the same clock the page draws.
 */
const PINE = keyedSkyDay(PINE_SKY);
/** named phases for `?tod=`, Settings ▸ Time of day, the quest and the King's night */
export const PINE_PHASES = PINE_SKY.phases;
export const PINE_DAY = PINE.spec;
export const pineSunAt = PINE.sunAt;
export const pineMoonAt = PINE.moonAt;
/** 0 at day … 1 at full night (the ambience, the lamps) */
export const pineNightAt = PINE.nightAt;
/** the clock with its row, for the backdrop (look/render.ts) */
export const PINE_KEYED_DAY = PINE;
