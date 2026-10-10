import { SPAWN } from './data/spawn';
import { BUDGETS } from './budgets';
import { INK_CARD, EXPLORE } from './explore/art';

const white: [number, number, number] = [1, 1, 1], zero: [number, number, number] = [0, 0, 0];
/** The ink valley's picker and discovery metadata (literal types stand in for the game's manifest type). */
export const INK = {
  budgets: BUDGETS, api: 1 as const, slug: 'ink-cel-valley' as const, order: 10, status: 'hidden' as const, name: 'Ink & Cel Valley', label: '(+1, −1)', seed: 357,
  accent: 'ember' as const, // G104: the HUD accent inside its grid cell
  biome: 'Ink / cel valley', blurb: 'A sage valley between two ridges, every rock inked: the hut, its blobs and the boss under a paper sky (SF59 graph-material fixture).',
  card: { thumb: INK_CARD, portrait: INK_CARD, landscape: INK_CARD },
  style: 'greybox' as const, kitLook: 'toon' as const, hands: 'toon' as const, weapon: 'custom' as const, treeCount: 0, trees: { factory: 'none' as const, noun: 'trees' },
  shardfile: '/shardfiles/ink-cel-valley/shard.json',
  // SF57: one admitted regional sim's measured resident cost (basis excluded; it is charged as sim-basis:), the highest of
  // Node, Chromium and WebKit readings; budgets.sim.resident (16 MB) stays the validated ceiling
  regionalSimCost: { residentMB: 3.21, rev: '01e880c73', device: 'Chromium 153 + WebKit 26.6 content footprint, Node 24 V8 + Rapier', evidence: 'progress/memory/sf57/regional-sim-cost/summary.json' },
  ground: { paths: 'plugin' as const, structures: true as const },
  minimap: { image: '/assets/ink-cel-valley/map/top.webp' }, // the map baked from the world (SF66)
  // the full map's places (SF66; test/map-coverage.test.ts holds every trigger, interaction, marker and arena on one): the
  // hut and the two teaching fights' arenas
  pois: [
    // Literal on purpose: importing data/text or data/encounters here pulls the valley's gameplay into the shard-list chunk (SF16).
    { id: 'hut', name: 'Grey hut', x: 0, z: -9, r: 6 },
    { id: 'greyback', name: 'Greyback', x: 15, z: -12, r: 15 },
    { id: 'big-blob', name: 'Big blob', x: -15, z: -20, r: 8 },
  ],
  assetGlobs: ['public/assets/ink-cel-valley/map/**'],
  // Start above the sampled collision floor: the analytic trail bed is lower between grid vertices.
  spawn: SPAWN, bounds: { x0: -100, x1: 100, z0: -100, z1: 100, floor: -10 },
  sky: { sunColor: white, sunIntensity: 1.5, envIntensity: 0.5, bgIntensity: 1, fogSunColor: white, cloudSunColor: white,
    hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: white },
  grade: { saturation: 0, brightness: 0, contrast: 0, bloomIntensity: 0, bloomThreshold: 1, shadowTint: white, highTint: white, lift: zero, gain: white, gamma: 1 },
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'] as const,
  loadout: { weapons: ['weapon.sword-iron', 'weapon.ink-whip'], tools: ['tool.ink-lantern', 'tool.hoverboard'], start: ['weapon.sword-iron', 'weapon.ink-whip', 'tool.ink-lantern', 'tool.hoverboard'], held: 'weapon.ink-whip' },
  species: [], spawns: [], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  hud: { bands: ['band.1', 'band.2', 'band.3'] as const }, bag: { tabs: ['map', 'gear', 'pack', 'notes'] as const, pack: { slots: 8 } }, loot: { coins: true },
  audio: { ambience: 'none' as const, score: 'none' as const },
  explore: EXPLORE,
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default INK;
