import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { SPAWN, TRAIL, POSES } from './layout';
import { BUDGETS } from './budgets';
import { EXPLORE } from './explore/art';
import { DUNES_CARD, DUNES_PORTRAIT } from './thumbs/card';
import { bootFiles, bootSources } from './boot/files';
import { duneHeight } from './world/dunes';

const SEED = 6363;
const TERRAIN = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
const pose = (p: { x: number; z: number; yaw: number; pitch: number }, frame: string): { eye: readonly [number, number, number]; feet: readonly [number, number, number]; yaw: number; pitch: number; mockup: string; frame: string } => {
  const y = TERRAIN.heightAt(p.x, p.z);
  return { eye: [p.x, y + 1.6, p.z], feet: [p.x, y, p.z], yaw: p.yaw, pitch: p.pitch, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame };
};

export const SUNSCAR_DUNES: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'sunscar-dunes', order: 5, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [5, 0], size: [500, 200, 500] },
  card: { thumb: DUNES_CARD, portrait: DUNES_PORTRAIT, landscape: DUNES_CARD },
  style: 'duskDunes', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  ground: { paths: 'plugin', terrain: TERRAIN },
  spawn: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -248, x1: 248, z0: -248, z1: 248, floor: -20 },
  sky: { sunColor: [1, 0.52, 0.28], sunIntensity: 1.6, envIntensity: 0.35, bgIntensity: 1, fogSunColor: [1, 0.5, 0.3], cloudSunColor: [1, 0.55, 0.35],
    hemiSky: 0x39407a, hemiGround: 0x4a2414, hemiIntensity: 0.75, sun: { azimuth: 318, elevation: 5 } },
  atmosphere: { fogHeight: 0, fogHeightFalloff: 0.05, fogHeightDensity: 0.002, fogDistDensity: 0.0032, volumetricSunColor: [1, 0.5, 0.3] },
  grade: { saturation: 0.08, brightness: 0, contrast: 0.08, bloomIntensity: 0.35, bloomThreshold: 0.85, shadowTint: [0.86, 0.92, 1.12], highTint: [1.08, 1, 0.9],
    lift: [0, 0, 0.012], gain: [1, 1, 1], gamma: 1 },
  horizon: { cloudSea: false, rings: [
    { r: 820, base: -2, color: [0.07, 0.035, 0.025], top: [0.2, 0.09, 0.05], snowLine: 2, haze: 0.45, floor: -30,
      bands: [{ azimuth: 10, spread: 40, height: 22, rough: 0.05 }, { azimuth: 95, spread: 55, height: 15, rough: 0.08 }, { azimuth: 200, spread: 60, height: 20, rough: 0.05 }, { azimuth: 300, spread: 45, height: 12, rough: 0.06 }] },
    { r: 1300, base: -4, color: [0.09, 0.05, 0.05], top: [0.2, 0.11, 0.1], snowLine: 2, haze: 0.7, floor: -30,
      bands: [{ azimuth: 340, spread: 70, height: 35, rough: 0.1 }, { azimuth: 150, spread: 80, height: 28, rough: 0.1 }] },
  ] },
  render: async () => (await import('./look/render')).dunesLook(),
  uses: ['quests', 'spawns', 'hover', 'explore', 'coins', 'loot'],
  loadout: { weapons: ['weapon.sunscar-whip'], tools: ['tool.hoverboard'], start: ['weapon.sunscar-whip', 'tool.hoverboard'], held: 'weapon.sunscar-whip' },
  species: ['duneRay'], spawns: [], fight: { attackers: 1, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  hud: { bands: [] }, loot: { coins: true },
  audio: { bed: 'forest', ambience: 'kit.ambience.forest', score: 'sunscar.silent', cues: async () => (await import('./audio/cues')).CUES,
    preload: async () => (await import('#kit')).createForestAudio() },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({ spawn: pose(POSES.spawn, 'spawn'), ray: pose(POSES.ray, 'ray'), tower: pose(POSES.tower, 'tower') }) },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
