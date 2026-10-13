import { SAND_DUSK } from './dusk';
import { DUNE_FIELD } from './duneField';
import { GROUND_HALF } from './layout';
import { SHADOW_HALF } from './sand';
import { PAINTED, SKY_SUN } from './sky';
import sandMeans from './sand.json' with { type: 'json' };

type V2 = readonly [number, number];

/** A dusk sand as rows: its name, its three maps' names, its PBR ground entry (the dusk's first frame) and its dusk curves. */
export interface DuskSandRow { readonly name: string; readonly maps: { readonly grain: string; readonly trail: string; readonly shadow: string }; readonly entry: unknown; readonly curves: typeof SAND_DUSK }

/** A painted dusk sky as rows: its name, its two stages' map names, the strip's elevations, the dusk window, the first stage's gain and the hold. */
export interface DuskSkyRow {
  readonly name: string;
  readonly maps: readonly [string, string];
  readonly elevation: V2; readonly window: V2; readonly firstGain: V2; readonly hold: number;
}

const [sunX, sunY, sunZ] = SKY_SUN, toSun = 1 / Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ);
/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10) as rows on the SDK's
 * dusk family surfaces (`@wildshard/sdk/looks/duskFamilies`): the sand is the PBR family's ground layer over the baked
 * maps `sd:grain` / `sd:trail` / `sd:shadow`, its dusk terms the SAND_DUSK curves (`look.curves` rows); the painted dusk
 * dome is the emissive family's sky over the two stages `sd:early` / `sd:late`. No shard shader source is left on either.
 */
export const SAND_LOOK: DuskSandRow = { name: 'Signal Dunes sand', maps: { grain: 'sd:grain', trail: 'sd:trail', shadow: 'sd:shadow' }, curves: SAND_DUSK,
  entry: { family: 'pbr', vertexColours: true, roughness: 0.88, metalness: 0, ground: {
    // the ripples run with the dunes' wind; the faces turned from the set sun (data/sky.ts SKY_SUN) fall dark late
    wind: [DUNE_FIELD.wind.x, DUNE_FIELD.wind.z], away: { from: [sunX * toSun, sunZ * toSun], amount: 0 },
    // the grain tile's own means (data/sand.json): every faded grain term is zero-mean
    grain: { map: 'sd:grain', mean: sandMeans.meanR, glintMean: sandMeans.meanGlint, strength: 1 },
    // round 2 / E399: a baked 0.75 m trail mask, trodden smoother (half its ripples) and a faint brighter bed
    trail: { map: 'sd:trail', rect: [-GROUND_HALF, -GROUND_HALF, GROUND_HALF, GROUND_HALF], ripples: 0.5, tint: [1.1, 1.05, 0.98], amount: 0.6 },
    // E407 row 3: long dune shadows across the troughs, the key kept at 0.28 in cast shade
    keyShadow: { map: 'sd:shadow', rect: [-SHADOW_HALF, -SHADOW_HALF, SHADOW_HALF, SHADOW_HALF], edge: [0.25, 0.75], floor: 0.28 },
    // round 8 / 23 / 24: each burning fire lights the sand orange round it, the caravan's lantern (a fraction of a fire) amber
    pools: { low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 },
  } } };

/** The painted dome: the two dusk stages over the strip's elevations (data/sky.ts PAINTED), the first stage held at full gain for 2.5 s. */
export const SKY_LOOK: DuskSkyRow = { name: 'Signal Dunes sky', maps: ['sd:early', 'sd:late'], elevation: [PAINTED.elevBottom, PAINTED.elevTop], window: [PAINTED.dusk[0], PAINTED.dusk[1]], firstGain: [0.64, 1], hold: 2.5 };
