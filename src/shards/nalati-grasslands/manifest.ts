import { COMPARE } from './explore/compare';
import exploreHorse from './explore/playground-horse.webp';
import { NALATI_BUDGET_INPUTS } from './budgets';
import { NALATI_RUNTIME_COST } from './data/runtimeCost';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { basinBody } from '@wildshard/engine/world/water/body';
import { nalatiWetAt } from './wet';
import { SEED, SPAWN, TERRAIN, groundColor, surfaceAt, loneSpruceMask, edgeBermAt } from './world/terrain';
import { NALATI_MAP } from './layout';
import { inSpruceClearing } from './world/clearings';
import { edgeSpruceMask } from './edge';
import { NALATI_HORIZON_V2 } from './look/horizon';
import { NALATI_MINIMAP } from './look/minimap';
import { bootFiles, bootSources, lateReads } from './boot/files';
import { BOOT_STEPS } from './boot/steps';
import thumbnail from './thumbs/nalati-grasslands.jpg';
import heroPortrait from './thumbs/nalati-grasslands-portrait.jpg';
import heroLandscape from './thumbs/nalati-grasslands-landscape.jpg';
import exploreWorld from './explore/world-nalati-grasslands.webp';
import exploreModels from './explore/models-nalati-grasslands.webp';
import exploreSets from './explore/sets-nalati-grasslands.webp';
import explorePractice from './explore/practice-nalati-grasslands.webp';


const EXPLORE = { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice } satisfies NonNullable<ShardManifest['explore']>;

export const NALATI_GRASSLANDS: ShardManifest = {
  // Migrated verbatim from parity’s camera table; omitted y keeps the existing ground/land placement.
  dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'camp',x:60,z:214,yaw:-Math.PI/2,pitch:0},{name:'bridge',x:0,z:200,yaw:0,pitch:0},{name:'plains',x:65,z:0,yaw:Math.PI,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (NALATI_GRASSLANDS.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
  uses: ['dayCycle', 'weather', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'loot', 'feats'],
  api: 1,
  load: () => import('./plugin'),
  gridShardfile: '/shardfiles/nalati-grasslands/shard.json',
  // SF65 (G237): SHARDFILE is the SF48 hybrid boot (shard.config.ts admitted over the trusted runtime); public stays LEGACY
  entries: { legacy: true, shardfile: true, public: 'legacy' },
  trustedRuntime: { get slug() { return NALATI_GRASSLANDS.slug; }, entry: 'runtime/index.ts' },
  loadout: { weapons: ['bow', 'sabre', 'spear', 'rifle'], tools: ['tool.hoverboard'], start: ['bow', 'sabre', 'spear', 'tool.hoverboard'], held: 'bow', loans: [{ id: 'rifle', in: 'practice' }] },
  budgets: NALATI_BUDGET_INPUTS,
  runtimeCost: NALATI_RUNTIME_COST,
  audio: { bed: 'steppe', ambience: 'ambience.nalati', score: 'score.nalati', alertOnlyHostile: true, preload: () => import('./runtime/audio/files').then((m) => m.createNalatiAudio()) },
  boot: { audio: async () => (await import('./runtime/audio/files')).BOOT_AUDIO(), explore: { art: [...Object.values(EXPLORE), exploreHorse, ...COMPARE.flatMap(({ live, image }) => [live, image])] }, precache: [], stagedWorld: true, files: bootFiles, sources: bootSources, steps: BOOT_STEPS, bytes: { trees: 'spruce bark' }, lateReads },
  bag: { tabs: ['map', 'gear', 'finds', 'feats'], pack: { slots: 0 }, skinsTitle: 'Skins' },
  kitLook: 'painterly',
  fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: true },
  creatures: { lowPoly: false, waitForModels: true, furRim: false, tintRange: 0.2, oneMaterial: false },
  debugOptions: [],
  assetGlobs: ['public/assets/nalati/**', 'public/assets/gpu/nalati/**', 'public/assets/music/nalati/**', 'public/assets/sfx/nalati-grasslands/**', 'public/assets/title/nalati-grasslands-portrait.jpg', 'public/assets/nalati-grasslands/map/**'],
  ktx2: () => import('./ktx2.generated'),
  order: 3,
  status: 'earlyAccess',
  
  slug: 'nalati-grasslands',
  name: 'Nalati Grasslands',
  label: '(+4, −2)',
  seed: SEED,
  treeCount: 1400, // (N23's edge: the berm's spruce lines too)
  accent: 'ember', // G104: the HUD accent inside its grid cell
  biome: 'Alpine steppe',
   // NALATI-MERGE E1 (the user's pick): in the shard picker for everyone, tagged EARLY ACCESS
  blurb: 'SUPER EXPERIMENTAL — the Tian Shan steppe, painted: cross the braided Kunes, tame a steppe horse and hunt wolves from the saddle across the golden bowl of the Sky Grassland, break the Golden King in his kurgan, and ride out a storm to face the Storm Titan. Snow Lotus Valley waits in the snow ring. Built live, rough edges everywhere.',
  card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
  style: 'painterly',
  // the painterly look (look/render.ts, E357 S3.2): its own composer, fog, painted ground and grass
  render: async () => (await import('./look/render')).shardRender(),
  tiers: { phone: { msaa: 2 }, desktop: { msaa: 4 } }, // the look's composer MSAA (phone ×2: the fill rate of ×4 at DPR 1.5 on a tile GPU)
  // EXPLORE WORLD (NALATI-MERGE P1, wave 8): the viewer over the steppe — every registered POI is in the Model Explorer
  // (src/shards/nalati-grasslands/world/index.ts), the World Explorer map pins the map's named places
  explore: { art: EXPLORE, compare: COMPARE },
  // its live models in the Model Explorer (E315 M5): the creatures it spawns, alive now or not, its people, its gear
  roster: async () => (await import('./roster')).ROSTER,
  pois: NALATI_MAP.pois.map((p) => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })),
  hud: { dayBadge: true }, // the minimap's sun / moon (E154)
  minimap: { image: '/assets/nalati-grasslands/map/top.webp', palette: NALATI_MINIMAP }, // the map baked from the world (SF66); the palette paints the grid's edges and names the map-01 places (look/minimap.ts)
  weapon: 'custom', // its own kit (src/shards/nalati-grasslands/weapons/nalatiKit.ts: bow · sabre · spear) — no Driftwood sword built (NALATI-MERGE F2)
  // the rings re-aimed to layout v2 in front of the painted panorama (the far snow range is the painting); the camera's far
  // plane is 2.6 km: every ring stays inside 2.5 km
  horizon: NALATI_HORIZON_V2,
  groundColor,
  surfaceAt,

  // the Kunes and the meltwater brook are one still basin (the terrain's pondMask at RIVER.level): swimming and wading ask it
  ground: { terrain: TERRAIN, paths: 'plugin', water: [basinBody('river', TERRAIN)] },
  // Herds avoid the full river corridor and brook; roads carry them onto the registered bridge.
  navmesh: { excludeGroundAt: (x, z, y) => y <= TERRAIN.waterLevel() + 0.25 || (nalatiWetAt(x, z) && TERRAIN.trailDistance(x, z) > 3.5) },

  // the painterly terrain loads none of these (it paints itself); they satisfy the PBR contract
  assets: {
    groundLayers: ['leafy_grass', 'stony_dirt_path', 'rock_ground', 'forest_ground_04'],
    groundTints: [[0.7, 0.85, 0.5], [0.9, 0.84, 0.66], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
    slabRock: 'rock_ground',
  },
  // the spruce forest is cut (layout v2): a handful of lone Tian Shan spruces (src/shards/nalati-grasslands/world/Spruce.ts) at LONE_SPRUCE; the
  // tint multiplies the painted colours, so it stays near-white
  trees: { factory: () => import('./world/Spruce').then((m) => m.spruceFactory), bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces' },
  forest: {
    spacing: 4.2,
    densityFreq: 0.01,
    clearings: [-2, -1.5], // never a "grove" by the density noise: the spruce mask decides
    maxSlope: 0.6,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95],
    largeVariantChance: 0.15,
    // never in a POI (clearings.ts); N23's edge: the spruce lines on the berm's crest
    mask: (x: number, z: number) => (inSpruceClearing(x, z) ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)))),
  },
  spawns: [], // wolves, horses and sheep: the creatures agent (B4)
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky', // unused: the sky is painted (below)
    painted: { zenith: [0.1, 0.28, 0.85], horizon: [0.62, 0.78, 0.98], ground: [0.3, 0.36, 0.3], glow: [0.5, 0.4, 0.25] },
    sun: { azimuth: 250, elevation: 26 },
    sunColor: [1.0, 0.85, 0.64], // a warm late-afternoon key (look pass lever 2: warm light, cool painted shade)
    sunIntensity: 2.8,
    envIntensity: 0.6,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.88, 0.7],
    cloudSunColor: [1.0, 0.93, 0.82],
    hemiSky: 0x9cc4ff, hemiGround: 0x7a7436, hemiIntensity: 0.5, // a warm bounce off the grass lifts every shade side — kept low enough for strong value contrast (look pass lever 2)
    // the ringed giant high in the SSW over the snow range — ahead and to the right from the spawn, lit from the WSW sun
    planet: { azimuth: 205, elevation: 23, size: 26, tilt: 2, roll: -20 },
  },
  atmosphere: {
    fogHeight: -30.0,
    fogHeightFalloff: 0.05,
    fogHeightDensity: 0.0006,
    fogDistDensity: 0.002, // the painterly aerial perspective (Atmosphere.ts paintedAir), pushed hard for the 500 m slab: ~20 % at 150 m, 45 % at 500 m
    volumetricSunColor: [1.0, 0.9, 0.72],
    // thin, high: a clear mountain afternoon (the default forest haze sits exactly on the valley floor and milks it out)
    volumetric: { height: -30, falloff: 0.06, density: 0.0009, strength: 0.35 },
  },
  grade: {
    // (the post chain is look/grade.ts's own grade; `saturation` feeds the lighting cheat, look/light.ts)
    saturation: 0.1, brightness: 0.0, contrast: 0.15,
    bloomIntensity: 0.35, bloomThreshold: 0.86,
    shadowTint: [0.9, 0.96, 1.1], highTint: [1.05, 1.01, 0.94],
    lift: [0.0, 0.004, 0.018], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  spawn: SPAWN,
};

// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NALATI_GRASSLANDS;
