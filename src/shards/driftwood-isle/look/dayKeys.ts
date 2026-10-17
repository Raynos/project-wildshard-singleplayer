import type { DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import { dayClock } from '@wildshard/sdk/looks/dayClock';
import { FACETED_DAY_PRESET, type FacetedDayPreset, type FacetedDayStyle } from '../data/facetedDayRows';
import DRIFTWOOD_SKY_DAY from '../data/skyDay.json' with { type: 'json' };

/**
 * Driftwood's day / night clock (DRIFTWOOD-REMASTER L7): the faceted-day row in data/skyDay.json as the engine's clock spec,
 * the sun's and moon's arcs and the night curve (`@wildshard/sdk/looks/dayClock`; the dusk follows the presets' own).
 * Renderer-free: the headless host steps the same clock the page draws (runtime/headless.ts).
 */
const DRIFTWOOD = dayClock<typeof FACETED_DAY_PRESET, FacetedDayStyle>(FACETED_DAY_PRESET, DRIFTWOOD_SKY_DAY, { duskOf: (p) => p.dusk });

export type Preset = FacetedDayPreset;
export const DRIFTWOOD_DAY: DayCycleSpec<Preset> = DRIFTWOOD.spec;
/** the clock with its row, for the backdrop (look/backdrop.ts) */
export const DRIFTWOOD_FACETED_DAY = DRIFTWOOD;
