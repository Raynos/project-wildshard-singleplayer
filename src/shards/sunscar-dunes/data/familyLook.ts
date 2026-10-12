import { SAND_DUSK, type DuskRow } from './dusk';
import { GROUND_HALF } from './layout';
import { SHADOW_HALF } from './sand';
import { PAINTED } from './sky';

type V2 = readonly [number, number];
type V3 = readonly [number, number, number];

/** A dusk sand as rows: its name, its three maps' names, its PBR surface, its dusk curves and its trail / key-shadow / fire-pool layers. */
export interface DuskSandRow {
  readonly name: string;
  readonly maps: { readonly grain: string; readonly trail: string; readonly shadow: string };
  readonly roughness: number; readonly metalness: number;
  /** dusk-curve rows for `contrast`, `grainStrength`, `albedo`, `shade` and `away` (the dimming of faces turned from the afterglow) */
  readonly curves: DuskRow;
  /** the trail mask's rect (x0, z0, x1, z1), how much of the ripples it keeps, its tint and amount */
  readonly trail: { readonly rect: readonly [number, number, number, number]; readonly ripples: number; readonly tint: V3; readonly amount: number };
  /** the key-shadow map's rect, its edge and the key's floor in cast shade */
  readonly keyShadow: { readonly rect: readonly [number, number, number, number]; readonly edge: V2; readonly floor: number };
  /** the fires' light pools: the low and high colours, their split, radius and gain */
  readonly pools: { readonly low: V3; readonly high: V3; readonly split: number; readonly radius: number; readonly gain: number };
}

/** A painted dusk sky as rows: its name, its two stages' map names, the strip's elevations, the dusk window, the first stage's gain and the hold. */
export interface DuskSkyRow {
  readonly name: string;
  readonly maps: readonly [string, string];
  readonly elevation: V2; readonly window: V2; readonly firstGain: V2; readonly hold: number;
}

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
