import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { HerdPlan } from '@wildshard/engine/level/data';
import { layoutFauna } from '@wildshard/engine/world/faunaLayout';
import { TERRAIN } from '../world/terrain';
import { SPAWN, CABIN_SITES, POND, HAMLET, KINGS_CLEARING, DEN, ridgeFootZ } from '../layout';

// Fauna: MANY SMALL GROUPS across the whole shard (user: "I don't want to search endlessly in an empty
// forest" — nor nine boars in one clearing). `layoutFauna` lays a ~60 m grid of cells over the chunk (25 m
// inside the edge), skips the water, the pads, the Den, the ridge's crags and the south gate, jitters each cell ±15 m
// with the shard seed and rolls ONE small group per cell: deer 3–4 in the clearings off the trails, boar 2–3 under the
// canopy, elk 2–4 (biased to the clearings 15–40 m off a trail), or nothing. The grid is 56 m (v1: 60) so the cells the
// v2 layout takes away (ridge crags, hamlet, arena, Den) come back elsewhere: the species counts stay close to v1's.
// The manifest's `spawns` and the headless runtime's herd placement (SF72) read this one plan: it loads in plain Node.
export const PINE_FAUNA: HerdPlan[] = [
  ...layoutFauna({
    seed: 1337, half: CHUNK_HALF, margin: 25, spacing: 56, jitter: 15, ring: 20,
    trailDistance: TERRAIN.trailDistance,
    avoid: [
      { x: POND.x, z: POND.z, r: POND.r + 12 },                          // the pond and its shore
      ...CABIN_SITES.map((c) => ({ x: c.x, z: c.z, r: 35 })),           // cabin pads (the manager's cabinMask reaches ~30 m)
      { x: SPAWN.x, z: SPAWN.z - 5, r: 60 },                              // the south-gate spawn
      { x: HAMLET.x, z: HAMLET.z, r: HAMLET.blend },                      // the mill hamlet
      { x: KINGS_CLEARING.x, z: KINGS_CLEARING.z, r: KINGS_CLEARING.blend }, // the King's arena (his thralls come at night)
      { x: DEN.x, z: DEN.z, r: 55 },                                      // bear country: the Den keeps its own
      ...[-215, -155, -95, -35, 25, 85, 135].map((x) => ({ x, z: ridgeFootZ(x) + 52, r: 34 })), // the ridge's crags
    ],
    emptyWeight: 10,
    groups: [
      { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
      { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
      { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (td) => (td >= 15 && td <= 40 ? 1.8 : 0.8) },
    ],
  }),
  // ── bears ── all three live in the Den (NW corner, layout v2; v1 had them at (−150, −150) = SE and (+150, −150) = SW):
  // the two black bears on the bowl's floor in front of the cave, the lone brown bear at its mouth toward the path.
  // Bears hunt you (see bear.ts).
  { kind: 'bear', count: 2, anchor: { x: DEN.x + 6, z: DEN.z + 6, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['black', 'black-blaze', 'black-old'] },
  { kind: 'bear', count: 1, anchor: { x: DEN.x - 8, z: DEN.z - 14, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['brown', 'brown-old'] },
];
