import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { BUDGETS } from './budgets';
import { CROWN, DECK, HIGH, KEEPER, ROOST, SPAWN, STEP, WINDMILL } from './layout';
import { SKY_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';
import { SKY_REACH_MINIMAP } from './look/minimap';

export const SKY_REACH: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 60, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: 6417,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [1, 4], size: [500, 500, 500] },
  card: { thumb: SKY_CARD.thumb, portrait: SKY_CARD.portrait, landscape: SKY_CARD.landscape },
  style: 'skyReach', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'pines' },
  // A built world (G23, structures only): every island and bridge is a registry piece (world/build.ts); no terrain mesh or
  // collider, the analytic floor is y -1000. The void under the islands is the cloud sea; `world.killY` ends a fall.
  ground: { structures: true, paths: 'plugin' },
  spawn: { x: SPAWN.x, y: DECK + 1, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -120, x1: 120, z0: -240, z1: 60, floor: DECK - 18 },
  world: { killY: DECK - 24 },
  horizon: { rings: [], cloudSea: false }, boundary: { visible: false },
  minimap: { palette: SKY_REACH_MINIMAP }, // the islands over the cloud sea, the bridges, the places (look/minimap.ts)
  // The painted light (review 2026-10-01 item 1): a warm sky fill and a gold ground bounce lift every shade side; the key
  // stays low and behind the islands (look/light.ts adds the bounce wrap, the rim and the shade floor).
  sky: { sunColor: [1, 0.8, 0.58], sunIntensity: 2.3, envIntensity: 0.7, bgIntensity: 1, fogSunColor: [1, 0.82, 0.64], cloudSunColor: [1, 0.84, 0.7],
    hemiSky: 0xc8c6dc, hemiGround: 0xb39a6c, hemiIntensity: 1.4, sun: { azimuth: 300, elevation: 4.3 } }, // the elevation is the painted sun's (look/panoramaData.ts PANO_SUN)
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.8, 0.6] },
  grade: { saturation: 0.22, brightness: 0, contrast: 0.18, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: [1.04, 0.95, 0.98], highTint: [1.03, 1, 0.95], lift: [0.012, 0.004, 0], gain: [1, 0.99, 0.97], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['hover', 'quests', 'bosses', 'coins', 'loot'],
  loadout: { weapons: ['weapon.far-fan'], tools: ['tool.hoverboard'], start: ['weapon.far-fan', 'tool.hoverboard'], held: 'weapon.far-fan' },
  species: ['driftRay', 'skyGoat', 'galeWisp', 'stormRoc'], encounters: ['far.roc'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  // far.meadowBlades: blades per 8 m tile of the near meadow (world/meadow.ts)
  tiers: { phone: { 'far.meadowBlades': 1600, godRays: false, ao: false }, desktop: { 'far.meadowBlades': 3200, godRays: false, ao: false } },
  loot: { coins: true },
  audio: { ambience: 'none', score: 'far.silent', cues: async () => (await import('./audio/cues')).CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: { eye: [SPAWN.x, DECK + 1.7, SPAWN.z], feet: [SPAWN.x, DECK, SPAWN.z], yaw: 0, pitch: 0, mockup: 'art/far-reach/round-1-proposals/B-sky-reach.jpg', frame: 'Spawn: Sunrest, the windmill isle across the gap' },
    hover: { eye: [12, DECK + 1.7, -2.5], feet: [12, DECK, -2.5], yaw: 80, pitch: -6, mockup: '', frame: 'The hover bridge to the Roost' },
    windmill: { eye: [WINDMILL.x - 6, DECK + 1.7, WINDMILL.z + 10], yaw: 10, pitch: 8, mockup: '', frame: 'The windmill isle' },
    roost: { eye: [ROOST.x, ROOST.y + 1.7, ROOST.z + 6], yaw: -90, pitch: 0, mockup: '', frame: 'The Roost, looking back' },
    keeper: { eye: [KEEPER.x + 4, KEEPER.y + 1.7, KEEPER.z + 8], yaw: 200, pitch: 0, mockup: '', frame: 'The keeper\'s isle and its notes' },
    updraft: { eye: [4, DECK + 2, WINDMILL.z - 10], yaw: 10, pitch: 12, mockup: '', frame: 'The updraft to the high step' },
    crown: { eye: [CROWN.x, HIGH + 1.7, CROWN.z + 16], yaw: 0, pitch: 4, mockup: '', frame: 'The storm crown' },
    step: { eye: [STEP.x - 5, HIGH + 1.7, STEP.z + 6], yaw: 20, pitch: 0, mockup: '', frame: 'The high step and the crown bridge winch' },
  }) },
  assetGlobs: ['public/assets/far-reach/**'],
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
