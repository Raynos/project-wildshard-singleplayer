import { SPAWN } from './data/spawn';
import { BUDGETS } from './budgets';
import { PASTEL_CARD, EXPLORE } from './explore/art';

const white: [number, number, number] = [1, 1, 1], zero: [number, number, number] = [0, 0, 0];
/** The pastel plain's picker and discovery metadata (literal types stand in for the game's manifest type). */
export const PASTEL = {
  budgets: BUDGETS, api: 1 as const, slug: 'pastel-plain' as const, order: 9, status: 'hidden' as const, name: 'Pastel Plain', label: '(−1, +1)', seed: 357,
  accent: 'lime' as const, // G104: the HUD accent inside its grid cell
  biome: 'Pastel alien plain', blurb: 'A lilac plain of pink rock: the hut, its blobs and the boss under a soft pastel sky (SF59 graph-material fixture).',
  card: { thumb: PASTEL_CARD, portrait: PASTEL_CARD, landscape: PASTEL_CARD },
  style: 'greybox' as const, kitLook: 'toon' as const, hands: 'toon' as const, weapon: 'custom' as const, treeCount: 0, trees: { factory: 'none' as const, noun: 'trees' },
  shardfile: '/shardfiles/pastel-plain/shard.json',
  // SF57: one admitted regional sim's measured resident cost (basis excluded; it is charged as sim-basis:), the highest of
  // Node, Chromium and WebKit readings; budgets.sim.resident (16 MB) stays the validated ceiling
  regionalSimCost: { residentMB: 3.21, rev: '01e880c73', device: 'Chromium 153 + WebKit 26.6 content footprint, Node 24 V8 + Rapier', evidence: 'progress/memory/sf57/regional-sim-cost/summary.json' },
  ground: { paths: 'plugin' as const, structures: true as const },
  minimap: { image: '/assets/pastel-plain/map/top.webp' }, // the map baked from the world (SF66)
  // the full map's places (SF66; test/map-coverage.test.ts holds every trigger, interaction, marker and arena on one): the
  // hut and the two teaching fights' arenas
  pois: [
    // Literal on purpose: importing data/text or data/encounters here pulls the plain's gameplay into the shard-list chunk (SF16).
    { id: 'hut', name: 'Grey hut', x: 0, z: -9, r: 6 },
    { id: 'greyback', name: 'Greyback', x: 15, z: -12, r: 15 },
    { id: 'big-blob', name: 'Big blob', x: -15, z: -20, r: 8 },
  ],
  assetGlobs: ['public/assets/pastel-plain/map/**'],
  // Start above the sampled collision floor: the analytic trail bed is lower between grid vertices.
  spawn: SPAWN, bounds: { x0: -100, x1: 100, z0: -100, z1: 100, floor: -10 },
  sky: { sunColor: white, sunIntensity: 1.5, envIntensity: 0.5, bgIntensity: 1, fogSunColor: white, cloudSunColor: white,
    hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: white },
  grade: { saturation: 0, brightness: 0, contrast: 0, bloomIntensity: 0, bloomThreshold: 1, shadowTint: white, highTint: white, lift: zero, gain: white, gamma: 1 },
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'] as const,
  loadout: { weapons: ['weapon.sword-iron', 'weapon.pastel-whip'], tools: ['tool.pastel-lantern', 'tool.hoverboard'], start: ['weapon.sword-iron', 'weapon.pastel-whip', 'tool.pastel-lantern', 'tool.hoverboard'], held: 'weapon.pastel-whip' },
  species: [], spawns: [], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  hud: { bands: ['band.1', 'band.2', 'band.3'] as const }, bag: { tabs: ['map', 'gear', 'pack', 'notes'] as const, pack: { slots: 8 } }, loot: { coins: true },
  audio: { ambience: 'none' as const, score: 'none' as const },
  explore: EXPLORE,
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default PASTEL;
