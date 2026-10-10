import type { OptionValue } from '@wildshard/engine/ui/Settings';
import type { DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import { facetedDay, type FacetedDayPreset } from '@wildshard/sdk/looks/facetedDay';
import { DRIFTWOOD_SKY_DAY } from '../data/skyDay';

/**
 * Driftwood's day / night clock (DRIFTWOOD-REMASTER L7): the faceted-day row in data/skyDay.ts as the engine's clock spec,
 * the sun's and moon's arcs and the night curve (`@wildshard/sdk/looks/facetedDay`). Renderer-free: the headless host
 * steps the same clock the page draws (runtime/headless.ts).
 */
const DRIFTWOOD = facetedDay(DRIFTWOOD_SKY_DAY);

/** Settings ▸ Time of day's fixed picks → the phase they park the clock at (noon, the GOLDEN / SUNSET keys, mid-night) */
export const FIXED_PHASE: Record<Exclude<OptionValue<'time'>, 'live'>, number> = DRIFTWOOD.fixed;
export type Preset = FacetedDayPreset;
export const driftwoodSunAt = DRIFTWOOD.sunAt;
export const driftwoodMoonAt = DRIFTWOOD.moonAt;
export const driftwoodNightAt = DRIFTWOOD.nightAt;
export const DRIFTWOOD_DAY: DayCycleSpec<Preset> = DRIFTWOOD.spec;
/** the clock with its row, for the backdrop (look/backdrop.ts) */
export const DRIFTWOOD_FACETED_DAY = DRIFTWOOD;
