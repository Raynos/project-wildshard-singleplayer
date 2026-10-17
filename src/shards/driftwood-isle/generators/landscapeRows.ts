// Retained Driftwood landscape, trail bed and grading rows. Runtime manifest remains the native oracle.
import { CHUNK_HALF } from '@wildshard/format/contentBounds';
/** Native terrain seed, retained before the world datum is applied. */
export const SEED = 0x5ea1;
/** Authored waterline and the whole-world vertical offset (G164). */
export const SHORE_LEVEL = 0.8, WORLD_DROP = 0.8;
/** Fixed native entry-road run, retained from the terrain compiler. */
const ROAD_LENGTH = 60;
/** Original surface paths, retaining their authored order. */
export const PATHS: [number, number][][] = [
  // E308: it starts where the built pier's landing steps down onto the sand (z ≈ −152, not on the deck over the lagoon)
  // and runs the fenced corridor off it (Trailside's landing fences) to the plateau ramp's foot. The maps draw this line;
  // the terrain's bed keeps PIER_PATH_BED below
  [[0, -152], [-8, -145], [-18, -143], [-30, -142], [-30, -104], [-24, -80], [-20, -68]],
  // hut → lookout: over the rope bridge end to end (BRIDGE.a → .b), then up the headland ramp's diagonal with its plank
  // steps and fence (Trailside), not beside them over the crags (PHYSICS.md P9: the old line climbed 2–3 m a metre).
  // E354: it ends at the lookout's stair foot (88, 88): its last 2.8 m ran on under the stair's treads (1.4–1.9 m up)
  [[-20, -68], [-8, -50], [14, -24], [17, 8], [15, 12], [16, 14], [32, 30], [34, 32], [46, 46], [86, 86], [88, 88]],
  [[17, 8], [60, 0], [100, -2], [140, 4]],
  // E354: from the fenced approach's end (−94, 88) it turns onto the shrine's axis and up the pool causeway's three
  // steps (between the front glyph pillars): it ran on to (−96, 96), through the south-west pillar into the pool's side
  [[-20, -68], [-52, -30], [-72, 20], [-88, 70], [-94, 88], [-87.5, 93.7], [-89.3, 96.1]],
];
/** the pier → hut path's sand bed as the terrain carves it (`trails`), the line it had before E308: the Blender spawn cove
 *  is baked from these heights (blenderArea.ts), so re-cutting the bed along PATHS[0] would lift or sink the cove's
 *  ground by up to 0.35 m at the pier's foot until the cove is re-baked */
export const PIER_PATH_BED: [number, number][] = [[0, -188], [-8, -172], [-30, -142], [-30, -104], [-24, -80], [-20, -68]];
/** the island disc: centre and nominal shoreline radius (the shoreline is noise-warped ±30 m) */
export const ISLAND = { x: 0, z: 12, r: 188 };
/** the hut's plateau: a flat-topped crag in the south-centre; the hut stands at its middle */
export const PLATEAU = { x: -24, z: -62, r: 46, h: 13 };
/** the north-east massif: a tall craggy headland (a broad shoulder + a high top) with the lookout on its summit */
export const HEADLAND = { x: 98, z: 96, r: 48, h: 22, shoulderR: 80, shoulderH: 9 };
/** Wreck Cove: a bay bitten out of the east shore; the wreck lies half sunk on the reef at its mouth, bow run up the sand, heeled toward the beach (Wreck.ts) */
export const COVE = { ang: -0.02, depth: 46, width: 0.5 };
/** the ring shrine on a knoll in the north-west jungle (rot: its stair faces south-east toward the hut path; its back points at the planet, so the ring frames it from the stair head) */
export const SHRINE = { x: -98, z: 108, rot: 2.51 };
/** the tidal creek across the hut → lookout path (a ravine cut below sea level, so the lagoon runs into it) and the rope bridge over it */
export const GULLY = { x: 24, z: 22, width: 11, depth: 7, length: 64 };

/** Native graded paths and their exact maximum slope. */
export const GRADED: { paths: [number, number][][]; maxGrade: number } = {
  paths: [
    [[14.9, -13.5], [17, 8], [15, 12], [16, 14]],
    [[32, 30], [34, 32], [46, 46], [86, 86], [90, 90]],
    [[17, 8], [60, 0], [100, -2], [140, 4]],
    [[-58.6, -13.5], [-72, 20], [-88, 70], [-96, 96]],
  ],
  maxGrade: Math.tan(32 * Math.PI / 180),
};
/** Four mandated roads followed by the original beach bed and inland paths. */
export const TRAILS: [number, number][][] = [
  [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
  [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
  [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
  [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
  PIER_PATH_BED, ...PATHS.slice(1),
];
