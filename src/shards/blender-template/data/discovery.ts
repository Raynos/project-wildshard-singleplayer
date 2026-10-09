import { BUDGETS } from './budgets';
// App placement and map metadata supplement the shared shardfile declaration.
const white: [number, number, number] = [1, 1, 1], zero: [number, number, number] = [0, 0, 0];
export const DISCOVERY = {
  order: 8, status: 'hidden' as const, label: '(−1, −1)',
  style: 'greybox' as const, kitLook: 'pbr' as const, hands: 'toon' as const, weapon: 'custom' as const,
  treeCount: 0, trees: { factory: 'none' as const, noun: 'trees' }, ground: { structures: true as const, paths: 'plugin' as const },
  sky: { sunColor: white, sunIntensity: 1.5, envIntensity: 0.5, bgIntensity: 1, fogSunColor: white, cloudSunColor: white,
    hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: white },
  grade: { saturation: 0, brightness: 0, contrast: 0, bloomIntensity: 0, bloomThreshold: 1, shadowTint: white, highTint: white, lift: zero, gain: white, gamma: 1 },
  budgets: BUDGETS,
  assetGlobs: ['public/assets/blender-template/map/**'],
  minimap: { image: '/assets/blender-template/map/top.webp' },
  // the full map's places (SF66; G276 fills the cell: a set piece at each entry, the hub, the ring road). The map's east is -x.
  pois: [
    { id: 'hall', name: 'The hall', x: 0, z: 32, r: 14 }, { id: 'plaza', name: 'Hub plaza', x: 0, z: -18, r: 18 },
    { id: 'bridge', name: 'North bridge', x: 0, z: 209, r: 14 }, { id: 'watchtower', name: 'Watchtower', x: -44, z: 205, r: 8 },
    { id: 'stoa', name: 'Market stoa', x: 187, z: 0, r: 40 }, { id: 'amphitheatre', name: 'Amphitheatre', x: -200, z: -48, r: 32 },
    { id: 'aqueduct', name: 'Aqueduct', x: -40, z: -211, r: 50 }, { id: 'cistern', name: 'Cistern tower', x: -102, z: -211, r: 8 },
  ],
  tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
};
