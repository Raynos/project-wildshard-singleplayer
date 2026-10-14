import { DRIFTWOOD_MANIFEST } from './data/manifest';
import { BRIDGE_SPANS } from './data/bridgeRows';
import { SHRINE_SITES } from './data/shrineSites';
import { WRECK_SITES } from './data/wreckSites';

import { area as BLENDER_AREA } from './world/blenderArea';

/**
 * Driftwood Isle — the second shard: a small faceted low-poly island in a bright turquoise ocean
 * on grid (−1, +6). Wind Waker in spirit: flat-shaded vertex-coloured geometry, no textures at
 * all (`style: 'toon'`), a wooden pier at the south edge, a moored sailboat, island boar hunted
 * with a wooden sword. Tropical midday sky, the ringed planet high over the water.
 *
 * Build order (docs/tasks/ASKS.md D12): water + pier → boat → beach → the island piece by piece.
 * The landscape below is the sea floor; the island rises out of it as the pieces land.
 */
import { CHUNK_HALF, ROAD_LENGTH } from '@wildshard/engine/core/config';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { defineShard, type OceanDef } from '@wildshard/game/shard/manifest';
import { lateReads } from './boot/lateReads';
import { bootSources } from './boot/sources';
import { DRIFTWOOD_SEA, LOWERED_SEA, SHORE_LEVEL, droppedTerrain } from './world/sea';

const SEED = 0x5ea1;

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
/** the sand paths between the POIs (also `trails[4..]`): [pier → hut], [hut → lookout], [fork → wreck], [hut → shrine] */
export const PATHS: [number, number][][] = [

  [[0, -152], [-8, -145], [-18, -143], [-30, -142], [-30, -104], [-24, -80], [-20, -68]],

  [[-20, -68], [-8, -50], [14, -24], [17, 8], [15, 12], [16, 14], [32, 30], [34, 32], [46, 46], [86, 86], [88, 88]],
  [[17, 8], [60, 0], [100, -2], [140, 4]],

  [[-20, -68], [-52, -30], [-72, 20], [-88, 70], [-94, 88], [-87.5, 93.7], [-89.3, 96.1]],
];
/** the pier → hut path's sand bed as the terrain carves it (`trails`), the line it had before E308: the Blender spawn cove
 *  is baked from these heights (blenderArea.ts), so re-cutting the bed along PATHS[0] would lift or sink the cove's
 *  ground by up to 0.35 m at the pier's foot until the cove is re-baked */
const PIER_PATH_BED: [number, number][] = [[0, -188], [-8, -172], [-30, -142], [-30, -104], [-24, -80], [-20, -68]];
/** the island disc: centre and nominal shoreline radius (the shoreline is noise-warped ±30 m) */
export const ISLAND = { x: 0, z: 12, r: 188 };
/** the hut's plateau: a flat-topped crag in the south-centre; the hut stands at its middle */
export const PLATEAU = { x: -24, z: -62, r: 46, h: 13 };
/** the hut site on the plateau (rot: which way the door faces — south, toward the pier) */
export const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };
/** the north-east massif: a tall craggy headland (a broad shoulder + a high top) with the lookout on its summit */
export const HEADLAND = { x: 98, z: 96, r: 48, h: 22, shoulderR: 80, shoulderH: 9 };
/** Wreck Cove: a bay bitten out of the east shore; the wreck lies half sunk on the reef at its mouth, bow run up the sand, heeled toward the beach (Wreck.ts) */
export const COVE = { ang: -0.02, depth: 46, width: 0.5 };
export const WRECK = WRECK_SITES.world;
/** the ring shrine on a knoll in the north-west jungle (rot: its stair faces south-east toward the hut path; its back points at the planet, so the ring frames it from the stair head) */
export const SHRINE = SHRINE_SITES.world;
/** the tidal creek across the hut → lookout path (a ravine cut below sea level, so the lagoon runs into it) and the rope bridge over it */
export const GULLY = { x: 24, z: 22, width: 11, depth: 7, length: 64 };
export const BRIDGE = BRIDGE_SPANS.world;
/** the lookout tower on the headland summit (rot: the stair faces south-west, toward the hut) */
export const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };

/** E308 (Jake's pick B, art/onboarding/round-1-first-minutes/board-3-start-length.jpg): half way down the pier (it runs
 *  ~100 m, sea end z −250 → the landing on the sand z ≈ −152), facing north up it, so the first frame is still the island
 *  from the sea: 38 s walking / 22 s sprinting to Wendell, was 49 / 27 from 15 m in */

const SPAWN = { x: 0, y: 1.2, z: -194, yaw: Math.PI };
/** the sailboat you arrived in, moored alongside the pier's west side by the spawn (it was at the sea end, 9 m behind the
 *  old spawn; E308, Jake: "move the boat to halfway down the pier too") — bow out to sea, its bow line on the pennant's piling */
export const BOAT_MOOR = { x: -4.2, z: SPAWN.z - 9 };
/** metres from the pier's sea end to the piling that flies the pennant (E111; E308 moved it from the sea-end bollard to
 *  half way down, just past the boat's bow — Jake: "also the flag on the pier also halfway down") */
export const PIER_PENNANT_AT = 43.2;
/** the practice crab (E308, Jake's pick A, board-2-practice-target.jpg): one lone small reef crab on the sand path at the
 *  pier's foot, where the landing's fenced corridor turns for the plateau ramp — the first enemy a new player meets */
export const PRACTICE_CRAB = { x: -7, z: -143 };
/** the boar variants the island rolls (E318): the common four, never Pine Hollow's Scarback or Old Ironhide (whose drop is a gun) */

export const DRIFTWOOD_ISLE = defineShard({ ...DRIFTWOOD_MANIFEST,

  audio: { bed: 'island', samples: { loopGains: { island: 0.5 } }, ambience: 'ambience.driftwood', score: 'score.driftwood',
    preload: () => import('./runtime/audio/files').then((m) => m.createDriftwoodAudio()) },

  blender: { area: BLENDER_AREA, models: [] },

  boot: { audio: async () => (await import('./runtime/audio/files')).BOOT_AUDIO(), explore: { art: [...Object.values(DRIFTWOOD_MANIFEST.explore.art), ...DRIFTWOOD_MANIFEST.explore.compare.flatMap(({ live, image }) => [live, image])] }, precache: [], files: (tier) => Object.values(bootSources(tier)).flat(), sources: bootSources, lateReads }, 

  sword: async () => {
    try {
      return await (await import('./fpArms')).castawayArms();
    } catch (error) {
      console.warn('driftwood-isle: the castaway arms did not load, the code-built sword stands in', error);
      return {};
    }
  },
  ocean: OCEAN,

  minimap: {
    image: '/assets/driftwood-isle/map/top.webp',
    
    openWater: { level: LOWERED_SEA, deepDepth: OCEAN.deepDepth },
    outside: 'rgb(22,74,128)',
  },
  pois: [
    { id: 'jetty', name: 'Jetty', x: 0, z: -CHUNK_HALF + 24, r: 16 },
    { id: 'hut', name: 'Hut', x: HUT.x, z: HUT.z, r: 12 },
    { id: 'shrine', name: 'Ring shrine', x: SHRINE.x, z: SHRINE.z, r: 16 },
    { id: 'lookout', name: 'Lookout', x: LOOKOUT.x, z: LOOKOUT.z, r: 12 },
    { id: 'wreck', name: 'Wreck cove', x: WRECK.x, z: WRECK.z, r: 20 },
    { id: 'bridge', name: 'Rope bridge', x: (BRIDGE.a[0] + BRIDGE.b[0]) / 2, z: (BRIDGE.a[1] + BRIDGE.b[1]) / 2, r: 12 },
  ],

  navigation: { row: navigation.navigation, url: navigation.url },
  ground: { paths: 'plugin', water: [DRIFTWOOD_SEA], terrain: createBakedTerrainField({ key: 'driftwood-isle', seed: SEED }, droppedTerrain(buildTerrain(SEED, {
    oceanLevel: SHORE_LEVEL,
    
    landscape: () => { throw new Error('Driftwood requires admitted native ground'); },
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
      PIER_PATH_BED, ...PATHS.slice(1),
    ],
    cabinSites: [],

  }))) },

  spawn: SPAWN,
}, {
dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'pier',x:0,z:-194,yaw:Math.PI,pitch:0},{name:'beach',x:-10,z:-150,yaw:4.3,pitch:0},{name:'wreck',x:105,z:0,yaw:-Math.PI/2,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (DRIFTWOOD_ISLE.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
ktx2: () => import('./ktx2.generated'),
load: () => import('./plugin'),
render: async () => (await import('./look/render')).shardRender(),
roster: async () => (await import('./roster')).ROSTER
});

// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default DRIFTWOOD_ISLE;
