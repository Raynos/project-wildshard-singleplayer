import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { SPAWN } from './data/spawn';
import { BUDGETS } from './budgets';
import { GREY_CARD, EXPLORE } from './explore/art';

export const TEMPLATE: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: '_template', order: 1000, status: 'hidden', name: 'Template shard', label: '(+0, +0)', seed: 357,
  accent: 'sand', // G104: the HUD accent inside its grid cell
  biome: 'Grey-box teaching level', blurb: 'A hut, a blob, and declared platform systems.', 
  card: { thumb: GREY_CARD, portrait: GREY_CARD, landscape: GREY_CARD },
  style: 'greybox', kitLook: 'toon', hands: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'trees' },
  shardfile: '/shardfiles/_template/shard.json',
  // SF57: one admitted regional sim's measured resident cost (basis excluded; it is charged as sim-basis:), the highest of
  // Node, Chromium and WebKit readings; budgets.sim.resident (16 MB) stays the validated ceiling
  regionalSimCost: { residentMB: 3.21, rev: '01e880c73', device: 'Chromium 153 + WebKit 26.6 content footprint, Node 24 V8 + Rapier', evidence: 'progress/memory/sf57/regional-sim-cost/summary.json' },
  ground: { paths: 'plugin', structures: true },
  minimap: { image: '/assets/_template/map/top.webp' }, // the map baked from the world (SF66)
  assetGlobs: ['public/assets/_template/map/**'],
  // Start above the sampled collision floor: the analytic trail bed is lower between grid vertices.
  spawn: SPAWN, bounds: { x0: -100, x1: 100, z0: -100, z1: 100, floor: -10 },
  sky: { sunColor: [1, 1, 1], sunIntensity: 1.5, envIntensity: 0.5, bgIntensity: 1, fogSunColor: [1, 1, 1], cloudSunColor: [1, 1, 1],
    hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 1, 1] },
  grade: { saturation: 0, brightness: 0, contrast: 0, bloomIntensity: 0, bloomThreshold: 1, shadowTint: [1, 1, 1], highTint: [1, 1, 1], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'],
  loadout: { weapons: ['weapon.sword-iron', 'weapon.template-whip'], tools: ['tool.template-lantern', 'tool.hoverboard'], start: ['weapon.sword-iron', 'weapon.template-whip', 'tool.template-lantern', 'tool.hoverboard'], held: 'weapon.template-whip' },
  species: [], spawns: [], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  hud: { bands: ['band.1', 'band.2', 'band.3'] }, bag: { tabs: ['map', 'gear', 'pack', 'notes'], pack: { slots: 8 } }, loot: { coins: true },
  audio: { ambience: 'none', score: 'none' },
  explore: EXPLORE,
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default TEMPLATE;
