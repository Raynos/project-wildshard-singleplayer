import { STRINGS } from './strings';
import { DECK, SPAWN } from './layout';

/** Discovery, play declarations and tier preferences retain their original literal values. */
export const SKY_DISCOVERY = {
  entries: { legacy: true, shardfile: true, public: 'shardfile' },
  gridShardfile: '/shardfiles/far-reach/shard.json',
  api: 1,
  slug: 'far-reach',
  order: 60,
  status: 'experimental',
  name: STRINGS.name,
  label: STRINGS.label,
  seed: 6417,
  accent: 'pink',
  biome: STRINGS.biome,
  blurb: STRINGS.blurb,
  style: 'skyReach',
  kitLook: 'toon',
  hands: 'toon',
  weapon: 'custom',
  treeCount: 0,
  trees: { factory: 'none', noun: 'pines' },
  ground: { structures: true, paths: 'plugin' },
  spawn: { x: SPAWN.x, y: DECK + 1, z: SPAWN.z, yaw: SPAWN.yaw },
  bounds: { x0: -120, x1: 120, z0: -240, z1: 60, floor: DECK - 18 },
  world: { killY: DECK - 24 },
  boundary: { visible: false },
  uses: ['hover', 'quests', 'bosses', 'coins', 'loot'],
  loadout: { weapons: ['weapon.far-reach.fan'], tools: ['tool.hoverboard'], start: ['weapon.far-reach.fan', 'tool.hoverboard'], held: 'weapon.far-reach.fan' },
  species: ['driftRay', 'skyGoat', 'galeWisp', 'stormRoc'],
  encounters: ['far.roc'],
  fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { 'far.meadowBlades': 1600, godRays: true, ao: false, textures: 'ktx2' }, desktop: { 'far.meadowBlades': 3200, godRays: true, ao: false } },
  loot: { coins: true },
  assetGlobs: ['public/assets/far-reach/**', 'public/assets/lut/far-reach.bin']
} as const;
