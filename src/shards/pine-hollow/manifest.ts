import { PINE_MANIFEST } from './data/manifest';

import { PINE_AUDIO_SAMPLES } from './data/runtimeCost';

import { PINE_STEPS, PINE_BYTES } from './boot/steps';
import { PINE_TREE_ASSETS, PINE_TREE_SPECIES } from './world/treeSet';

import { bootFiles, bootSources, BAKED_UNREAD } from './boot/files';

/**
 * Pine Hollow — the first shard: a boreal Scots-pine forest on grid (+3, −2). World layout v2 = Map D, layout A (Jake's
 * pick, project/archive/2026-09-25-pine-hollow-remaster.md §4): the granite Ridge along the north edge with the fire lookout and the
 * waterfall into the Still pond, the Den in the NW corner, the Old-growth and the King's clearing in the west, the creek
 * running SE from the pond to the Mill hamlet, and the Hollow with its cabins and the crossroads at the centre. Every
 * coordinate lives in ./pineHollowLayout.ts (+z north, +x WEST — see its header). Golden-hour sunset sky.
 */
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import { defineShard } from '@wildshard/game/shard/manifest';
import { TERRAIN, forestDensity, oldGrowthMask, speciesMix } from './world/terrain';
import { basinBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { surfaceReflect } from '@wildshard/engine/world/water/view';
import { SPAWN, PINE_HOLLOW_POIS } from './data/layout';
import { inBeaverPool, creekWaterAt } from './behaviour/layout';

/** the creek: water wherever `creekWaterAt` answers, at the surface it answers */
function creekBody(): WaterBody {
  return {
    id: 'creek', get level() { return TERRAIN.waterLevel(); }, 
    restAt: creekWaterAt,
    surfaceAt: (x, z) => creekWaterAt(x, z) ?? TERRAIN.waterLevel(),
    inside: (x, z, y) => { const s = creekWaterAt(x, z); return s !== null && y < s; },
    reflect: surfaceReflect,
  };
}

export const PINE_WATER: readonly WaterBody[] = [basinBody('pond', TERRAIN, surfaceReflect), creekBody()];

const CELL = CHUNK_SIZE / (TERRAIN_RES - 1);

export const PINE_HOLLOW = defineShard({ ...PINE_MANIFEST,

  audio: { bed: PINE_AUDIO_SAMPLES.bed, samples: { loopGains: PINE_AUDIO_SAMPLES.loopGains }, ambience: 'ambience.pine', score: 'score.pine', preload: () => import('./runtime/audio/files').then((m) => m.createPineAudio()) },
  
  boot: { viewmodelSets: ['walnut', 'brushed-steel', 'leather', 'cord', 'bolt', 'anodised', 'polymer', 'gunmetal'], audio: async () => (await import('./runtime/audio/files')).BOOT_AUDIO(), explore: { art: [...Object.values(PINE_MANIFEST.explore.art), ...PINE_MANIFEST.explore.compare.flatMap(({ live, image }) => [live, image])] }, precache: [], stagedWorld: true, files: bootFiles, sources: bootSources, bakedUnread: BAKED_UNREAD, steps: PINE_STEPS, bytes: PINE_BYTES },

  minimap: { image: '/assets/pine-hollow/map/top.webp' }, 
  pois: PINE_HOLLOW_POIS.map(({ id, name, x, z, r }) => ({ id, name, x, z, r })),

  ground: { terrain: TERRAIN, water: PINE_WATER },
  
  blender: { area: { x0: -CHUNK_HALF + 87 * CELL, x1: -CHUNK_HALF + 168 * CELL, z0: -CHUNK_HALF + 66 * CELL, z1: -CHUNK_HALF + 148 * CELL }, models: [] },

  trees: { factory: () => import('./world/treeFactory').then((m) => m.pineFactory), ...PINE_TREE_ASSETS, noun: 'trees', drawnBy: 'model' }, 
  forest: {
    spacing: 8.5,
    densityFreq: 0.008,
    clearings: [-0.45, 0.35],
    maxSlope: 0.72,
    tintHue: 0.25, tintHueJitter: [-0.04, 0.03], tintSat: [0.25, 0.5], tintLight: [0.5, 0.68],
    largeVariantChance: 0.1,
    density: forestDensity,
    /** the old-growth's pines and firs stand a quarter taller (its giants are their own species, PH-B4) */
    scale: (x, z) => 1 + oldGrowthMask(x, z) * 0.25,
    species: speciesMix, speciesTraits: PINE_TREE_SPECIES,

    understory: { ferns: 1, shrubs: 2.5, fernCanopy: false },
  },

  spawn: SPAWN,

  pondClip: inBeaverPool,

}, {
dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'gate',x:0,z:-200,yaw:Math.PI,pitch:0},{name:'cabin',x:-14,z:-62,yaw:Math.PI,pitch:0},{name:'pond',x:-56,z:95,yaw:Math.PI,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (PINE_HOLLOW.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
render: async () => (await import('./look/render')).shardRender(),
load: () => import('./plugin'),
ktx2: () => import('./boot/gpuTable').then((m) => m.pineKtx2()),
roster: async () => (await import('./roster')).ROSTER
});

// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default PINE_HOLLOW;
