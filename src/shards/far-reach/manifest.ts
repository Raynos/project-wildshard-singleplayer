import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { STRINGS } from './data/strings';
import { BUDGETS, SKY_REACH_RUNTIME_COST } from './budgets';
import { CROWN, DECK, HIGH, KEEPER, ROOST, SPAWN, STEP, WINDMILL } from './data/layout';
import { SKY_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources, lateReads } from './boot/files';
import { SKY_REACH_MINIMAP } from './look/minimap';

export const SKY_REACH: ShardManifest = {
  runtimeCost: SKY_REACH_RUNTIME_COST,
  gridShardfile: '/shardfiles/far-reach/shard.json',
  trustedRuntime: { get slug() { return SKY_REACH.slug; }, entry: 'runtime/index.ts' },
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 60, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: 6417,
  accent: 'pink', // G104: the HUD accent inside its grid cell
  biome: STRINGS.biome, blurb: STRINGS.blurb, 
  card: { thumb: SKY_CARD.thumb, portrait: SKY_CARD.portrait, landscape: SKY_CARD.landscape },
  style: 'skyReach', kitLook: 'toon', hands: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'pines' },
  // A built world (G23, structures only): every island and bridge is a registry piece (world/build.ts); no terrain mesh or
  // collider, the analytic floor is y -1000. The void under the islands is the cloud sea; `world.killY` ends a fall.
  ground: { structures: true, paths: 'plugin' },
  // Shipping bounds stay unchanged; the entry Debug row overrides them through the session hook.
  spawn: { x: SPAWN.x, y: DECK + 1, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -120, x1: 120, z0: -240, z1: 60, floor: DECK - 18 },
  world: { killY: DECK - 24 },
  horizon: { rings: [], cloudSea: false }, boundary: { visible: false },
  minimap: { image: '/assets/far-reach/map/top.webp', palette: SKY_REACH_MINIMAP }, // the map baked from the world (SF66); the palette paints the grid's edges (look/minimap.ts)
  // The painted light (review 2026-10-01 item 1): a warm sky fill and a gold ground bounce lift every shade side; the key
  // stays low and behind the islands (look/light.ts adds the bounce wrap, the rim and the shade floor).
  sky: { sunColor: [1, 0.8, 0.58], sunIntensity: 2.3, envIntensity: 0.7, bgIntensity: 1, fogSunColor: [1, 0.82, 0.64], cloudSunColor: [1, 0.84, 0.7],
    hemiSky: 0xc8c6dc, hemiGround: 0x9e98ac, hemiIntensity: 1.4, sun: { azimuth: 300, elevation: 4.3 } }, // the elevation is the painted sun's (look/panoramaData.ts PANO_SUN)
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.8, 0.6] },
  // E399 round 6: under the NEUTRAL tone map (look/render.ts) no extra saturation (0.32 drove every low-blue colour to 0:
  // the meadow's blue measured 0-3 against the mockups' 14-45), a gentler contrast and bloom; measured against the mockups.
  // (round 7: a gamma 1.15 lifted the middle but flattened the meadow's spread, 29 vs 70; look/light.ts lifts the forms' shade instead)
  grade: { saturation: 0, brightness: 0, contrast: 0.12, bloomIntensity: 0.35, bloomThreshold: 0.7, shadowTint: [0.97, 0.98, 1.04], highTint: [1.06, 1.0, 0.88], lift: [0.012, 0.004, 0], gain: [1, 0.99, 0.97], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['hover', 'quests', 'bosses', 'coins', 'loot'],
  loadout: { weapons: ['weapon.far-reach.fan'], tools: ['tool.hoverboard'], start: ['weapon.far-reach.fan', 'tool.hoverboard'], held: 'weapon.far-reach.fan' },
  species: ['driftRay', 'skyGoat', 'galeWisp', 'stormRoc'], encounters: ['far.roc'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  // far.meadowBlades: blades per 8 m tile of the near meadow (world/meadow.ts)
  // G253 (Jake, B): the phone loads the 22 HD models' ASTC 4×4 (UASTC) KTX2 GLBs under Auto from the first visit (−72 MB
  // GL, progress/memory/sky-reach/). The desktop has no KTX2 set and keeps Auto's rule (G188); pause ▸ Settings ▸ Debug ▸
  // GPU textures = Images stays the engine-wide fallback (the desktop's own files).
  tiers: { phone: { 'far.meadowBlades': 1600, godRays: true, ao: false, textures: 'ktx2' }, desktop: { 'far.meadowBlades': 3200, godRays: true, ao: false } },
  ktx2: () => import('./ktx2.generated'),
  loot: { coins: true },
  audio: { ambience: 'none', score: 'far.silent', cues: async () => (await import('./data/cues')).CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: bootFiles, sources: bootSources, lateReads, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
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
  assetGlobs: ['public/assets/far-reach/**', 'public/assets/lut/far-reach.bin'],
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
