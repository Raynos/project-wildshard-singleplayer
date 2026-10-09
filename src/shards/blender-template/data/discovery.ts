import { BUDGETS } from './budgets';
// Temporary Developer-only discovery metadata; SF55 replaces this with the SDK source-manifest mapping.
const white: [number, number, number] = [1, 1, 1], zero: [number, number, number] = [0, 0, 0];
const card = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
export const DISCOVERY = {
  api: 1 as const, order: 8, status: 'hidden' as const, name: 'Blender Template', label: '(−1, −1)', seed: 55,
  accent: 'teal' as const, biome: 'Blender clay prototype', blurb: 'A bridge, a hall, and one textured door.',
  card: { thumb: card, portrait: card, landscape: card }, shardfile: '/shardfiles/blender-template/shard.json',
  style: 'greybox' as const, kitLook: 'pbr' as const, hands: 'toon' as const, weapon: 'custom' as const,
  treeCount: 0, trees: { factory: 'none' as const, noun: 'trees' }, ground: { structures: true as const, paths: 'plugin' as const },
  spawn: { x: 0, y: 0.1, z: 9, yaw: Math.PI }, spawns: [], species: [],
  sky: { sunColor: white, sunIntensity: 1.5, envIntensity: 0.5, bgIntensity: 1, fogSunColor: white, cloudSunColor: white,
    hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: white },
  grade: { saturation: 0, brightness: 0, contrast: 0, bloomIntensity: 0, bloomThreshold: 1, shadowTint: white, highTint: white, lift: zero, gain: white, gamma: 1 },
  budgets: BUDGETS,
  assetGlobs: ['public/assets/blender-template/map/**'],
  minimap: { image: '/assets/blender-template/map/top.webp' },
  // the full map's places (SF66, sp-x6's list; test/map-coverage.test.ts holds the door and the guardian on the hall)
  pois: [
    { id: 'hall', name: 'The hall', x: 0, z: 32, r: 14 }, { id: 'bridge', name: 'North bridge', x: 0, z: 209, r: 14 },
    { id: 'east', name: 'East canopy', x: 205, z: 0, r: 20 }, { id: 'west', name: 'West steps', x: -210, z: 0, r: 20 },
    { id: 'south', name: 'South arch', x: 0, z: -211, r: 18 },
  ],
  tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
};
