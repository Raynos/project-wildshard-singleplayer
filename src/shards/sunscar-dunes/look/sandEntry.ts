import { DUNE_FIELD } from '../data/duneField';
import { GROUND_HALF } from '../data/layout';
import { SHADOW_HALF } from '../data/sand';
import { SKY_SUN } from '../data/sky';
import sandMeans from '../data/sand.json' with { type: 'json' };

const [sunX, sunY, sunZ] = SKY_SUN, toSun = 1 / Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ);

/**
 * The sand's PBR ground entry over its three maps (`maps`: their refs), at the dusk's first frame: the PBR family's ground
 * layer (SHARD-PLATFORM SF50 / SF10a, A10) whose dusk terms are data/dusk.ts SAND_DUSK. A function, so it lives outside
 * data/ (serialisable values only); data/familyLook.ts SAND_LOOK and shard.config.ts call it with their map refs.
 */
export function sandEntry(maps: { readonly grain: string; readonly trail: string; readonly shadow: string }): unknown {
  return { family: 'pbr', vertexColours: true, roughness: 0.88, metalness: 0, ground: {
    // the ripples run with the dunes' wind; the faces turned from the set sun (data/sky.ts SKY_SUN) fall dark late
    wind: [DUNE_FIELD.wind.x, DUNE_FIELD.wind.z], away: { from: [sunX * toSun, sunZ * toSun], amount: 0 },
    // the grain tile's own means (data/sand.json): every faded grain term is zero-mean
    grain: { map: maps.grain, mean: sandMeans.meanR, glintMean: sandMeans.meanGlint, strength: 1 },
    // round 2 / E399: a baked 0.75 m trail mask, trodden smoother (half its ripples) and a faint brighter bed
    trail: { map: maps.trail, rect: [-GROUND_HALF, -GROUND_HALF, GROUND_HALF, GROUND_HALF], ripples: 0.5, tint: [1.1, 1.05, 0.98], amount: 0.6 },
    // E407 row 3: long dune shadows across the troughs, the key kept at 0.28 in cast shade
    keyShadow: { map: maps.shadow, rect: [-SHADOW_HALF, -SHADOW_HALF, SHADOW_HALF, SHADOW_HALF], edge: [0.25, 0.75], floor: 0.28 },
    // round 8 / 23 / 24: each burning fire lights the sand orange round it, the caravan's lantern (a fraction of a fire) amber
    pools: { low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 },
  } };
}
