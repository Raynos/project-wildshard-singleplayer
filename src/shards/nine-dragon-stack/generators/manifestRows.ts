import manifest from '../data/manifest.json' with { type: 'json' };
import NINE_LAYOUT_PLAN from '../data/layoutPlan.json' with { type: 'json' };
import { NINE_DRAGON_PLACES } from './places';

const { PLAZA, STAIR, STREET, WELL, Y0 } = NINE_LAYOUT_PLAN;

const SEED = 0x9d2a;
/** Fixed pre-admission metadata, evaluated only by the boot producer. */
export const NINE_MANIFEST_ROWS = {
api: 1,
entries: { legacy: true, shardfile: true },
gridShardfile: '/shardfiles/nine-dragon-stack/shard.json',
kitLook: 'pbr',
creatures: manifest.CREATURE_LOOK,
debugOptions: [],
uses: ['hover', 'explore', 'practice'],
loadout: manifest.LOADOUT,
bag: { tabs: ['map', 'gear'], pack: { slots: 0 } },
species: [],
encounters: [],
tiers: { phone: { ao: false, slices: false, aa: 'fxaa', warmTurns: 0, textures: 'img' }, desktop: { ao: true, slices: false } },
assetGlobs: manifest.ASSET_GLOBS,
order: 4,
status: 'experimental',
name: manifest.NINE_STRINGS.name,
label: manifest.NINE_STRINGS.label,
seed: SEED,
treeCount: 0,
accent: 'iris',
biome: manifest.NINE_STRINGS.biome,
blurb: manifest.NINE_STRINGS.blurb,
assets: {
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    slabRock: 'rock_ground',
  },
trees: { factory: 'none', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees' },
spawns: [],
sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky', // unused: the sky is painted
    painted: { zenith: [0.09, 0.14, 0.26], horizon: [0.36, 0.44, 0.58], ground: [0.16, 0.18, 0.22], glow: [0.2, 0.2, 0.3] },
    sun: { azimuth: 250, elevation: 8 },
    sunColor: [0.55, 0.62, 0.85], sunIntensity: 0.6, envIntensity: 0.5, bgIntensity: 1.0,
    fogSunColor: [0.6, 0.66, 0.8], cloudSunColor: [0.6, 0.66, 0.8],
    hemiSky: 0x6f86a8, hemiGround: 0x2a2c34, hemiIntensity: 0.5,
  },
atmosphere: {
    fogHeight: Y0 - 40, fogHeightFalloff: 0.05, fogHeightDensity: 0.004, fogDistDensity: 0.004,
    volumetricSunColor: [0.55, 0.62, 0.85],
    volumetric: { height: Y0 - 30, falloff: 0.05, density: 0.003, strength: 0.3 },
  },
grade: {
    saturation: 0.1, brightness: 0, contrast: 0.1,
    bloomIntensity: 0.6, bloomThreshold: 0.9,
    shadowTint: [0.92, 0.96, 1.08], highTint: [1.06, 1.0, 0.92],
    lift: [0, 0, 0.01], gain: [1, 1, 1], gamma: 1,
  },
spawn: { x: 0.95, z: 7.5, yaw: -12 * (Math.PI / 180), y: Y0 },
weapon: 'sword',
camera: { portraitFov: 78 },
horizon: { rings: [], cloudSea: false },
minimap: { image: '/assets/nine-dragon-stack/map/top.webp' },
pois: [
    ...NINE_DRAGON_PLACES.flatMap(({ id, label }) => {
      const at = Object.entries(manifest.PLACE_AT).find(([key]) => key === id)?.[1];
      return at === undefined ? [] : [{ id, name: label.charAt(0) + label.slice(1).toLowerCase(), ...at }];
    }),
    ...manifest.ROAD_PORTAL_PINS.map(({ edge, x, z }) => ({ id: `portal-${edge}`, name: manifest.NINE_STRINGS.roadPortal, x, z, r: 8 })),
  ],
bounds: { x0: WELL.x0 - 8, x1: STAIR.x1 + 20, z0: STREET.z0 + 100, z1: PLAZA.z1 + 8, floor: Y0 - 100 },
style: 'jiehua'
};
