import { CHUNK_HALF, ROAD_LENGTH } from '@wildshard/engine/core/config';
import type { OceanDef } from '@wildshard/game/shard/manifest';
import authoredLayout from '../data/layout.json' with { type: 'json' };
import BRIDGE_SPANS from '../data/bridgeRows.json' with { type: 'json' };
import SHRINE_SITES from '../data/shrineSites.json' with { type: 'json' };
import WRECK_SITES from '../data/wreckSites.json' with { type: 'json' };
import { SHORE_LEVEL, WORLD_DROP } from './sea';

const LOWERED_SEA = SHORE_LEVEL - WORLD_DROP;

const { PLATEAU, HEADLAND } = authoredLayout;
/** Sea surface. The four entry roads are forced to y = 0 by `buildTerrain`, so a level a little above 0 turns them into submerged sandbars under the piers. */

export const OCEAN: OceanDef = {

  level: LOWERED_SEA,
  
  shallowColor: [0.0, 0.8, 0.88],
  deepColor: [0.008, 0.15, 0.52],
  deepDepth: 6,
};

/** Where the south pier lands (the crescent beach) — the island's origin for the later pieces. */
export const PIER = { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckAbove: 1.2 };
/** the other three jetties at the N / W / E edge midpoints (the mandated entry roads are their sandbars); the E one runs on into Wreck Cove.
 *  `landing`: the deck runs on to the dry sand and ramps down onto it, like the south pier (agent playtest round 1, #6: the
 *  north jetty ended 1.45 m over the beach, a step the hoverboard could not climb back up) */
export const JETTIES: readonly { readonly x: number; readonly z: number; readonly rot: number; readonly length: number; readonly landing?: boolean | 'end' }[] = [
  { x: 0, z: CHUNK_HALF, rot: Math.PI, length: ROAD_LENGTH, landing: true },
  { x: -CHUNK_HALF, z: 0, rot: Math.PI / 2, length: 95 },
  { x: CHUNK_HALF, z: 0, rot: -Math.PI / 2, length: 72, landing: 'end' }, 
];




/** the hut site on the plateau (rot: which way the door faces — south, toward the pier) */
export const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };


export const WRECK = WRECK_SITES.world;
/** the ring shrine on a knoll in the north-west jungle (rot: its stair faces south-east toward the hut path; its back points at the planet, so the ring frames it from the stair head) */
export const SHRINE = SHRINE_SITES.world;

export const BRIDGE = BRIDGE_SPANS.world;
/** the lookout tower on the headland summit (rot: the stair faces south-west, toward the hut) */
export const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };


