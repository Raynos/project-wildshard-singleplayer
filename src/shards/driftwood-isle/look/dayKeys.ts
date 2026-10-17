import type { DayLookPreset } from '@wildshard/game/looks/dayLookPresets';
import type { DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import { dayClock } from '@wildshard/game/looks/dayClock';
import { FACETED_DAY_PRESET, type FacetedDayStyle } from '../data/facetedDayRows';
import DRIFTWOOD_SKY_DAY from '../data/skyDay.json' with { type: 'json' };

/**
 * Driftwood's day / night clock (DRIFTWOOD-REMASTER L7): the faceted-day row in data/skyDay.json as the engine's clock spec,
 * the sun's and moon's arcs and the night curve (`@wildshard/game/looks/dayClock`; the dusk follows the presets' own).
 * Renderer-free: the headless host steps the same clock the page draws (runtime/headless.ts).
 */
const DRIFTWOOD = dayClock<typeof FACETED_DAY_PRESET, FacetedDayStyle>(FACETED_DAY_PRESET, DRIFTWOOD_SKY_DAY, { dusk: 'dusk' });

export type Preset = DayLookPreset<typeof FACETED_DAY_PRESET>;
export const DRIFTWOOD_DAY: DayCycleSpec<Preset> = DRIFTWOOD.spec;
/** the clock with its row, for the backdrop (look/backdrop.ts) */
export const DRIFTWOOD_FACETED_DAY = DRIFTWOOD;
