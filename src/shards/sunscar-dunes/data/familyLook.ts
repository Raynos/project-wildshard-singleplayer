import type { DuskSandRow, DuskSkyRow } from '@wildshard/sdk/looks/duskFamilies';
import { SAND_DUSK } from './dusk';
import { GROUND_HALF } from './layout';
import { SHADOW_HALF } from './sand';
import { PAINTED } from './sky';

/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10) as rows on the SDK's
 * dusk family surfaces (`@wildshard/sdk/looks/duskFamilies`): the sand is the PBR family's ground layer over the baked
 * maps `sd:grain` / `sd:trail` / `sd:shadow`, its dusk terms the SAND_DUSK curves; the painted dusk dome is the emissive
 * family's sky over the two stages `sd:early` / `sd:late`. No shard shader source is left on either surface.
 */
export const SAND_LOOK: DuskSandRow = {
  name: 'Signal Dunes sand', maps: { grain: 'sd:grain', trail: 'sd:trail', shadow: 'sd:shadow' }, roughness: 0.88, metalness: 0, curves: SAND_DUSK,
  // round 2 / E399: a baked 0.75 m trail mask, trodden smoother (half its ripples) and a faint brighter bed
  trail: { rect: [-GROUND_HALF, -GROUND_HALF, GROUND_HALF, GROUND_HALF], ripples: 0.5, tint: [1.1, 1.05, 0.98], amount: 0.6 },
  // E407 row 3: long dune shadows across the troughs, the key kept at 0.28 in cast shade
  keyShadow: { rect: [-SHADOW_HALF, -SHADOW_HALF, SHADOW_HALF, SHADOW_HALF], edge: [0.25, 0.75], floor: 0.28 },
  // round 8 / 23 / 24: each burning fire lights the sand orange round it, the caravan's lantern (a fraction of a fire) amber
  pools: { low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 },
};

/** The painted dome: the two dusk stages over the strip's elevations (data/sky.ts PAINTED), the first stage held at full gain for 2.5 s. */
export const SKY_LOOK: DuskSkyRow = { name: 'Signal Dunes sky', maps: ['sd:early', 'sd:late'], elevation: [PAINTED.elevBottom, PAINTED.elevTop], window: [PAINTED.dusk[0], PAINTED.dusk[1]], firstGain: [0.64, 1], hold: 2.5 };
