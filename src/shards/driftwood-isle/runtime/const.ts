/**
 * Driftwood Isle's runtime copies of build-time constants (G449: whatever the standalone runtime needs is duplicated into
 * it; P2a spec §2.3). Each export mirrors a `data/` value that `data/runtimeMirrors.ts` names, and
 * `test/driftwood-runtime-mirrors.test.ts` (the build's step 5 once wired) refuses any drift. Plain JSON `export const`s only.
 */

/** the look.materials ids the cascade's three meshes wear (data/waterfallLook.ts) */
export const CASCADE_LOOKS = { curtain: 'driftwood-cascade-curtain', pool: 'driftwood-cascade-pool', puffs: 'driftwood-cascade-puffs' } as const;
/** the look.materials id the castaway's smoke wears (data/smokeLook.ts) */
export const SMOKE_LOOK = 'driftwood-castaway-smoke';
/** the look.materials id the shrine's fireflies wear (data/fireflyLook.ts) */
export const FIREFLY_LOOK = 'driftwood-shrine-fireflies';
/** the look.materials id the reef wears (data/reefLook.ts) */
export const REEF_LOOK = 'driftwood-reef';
/** the look.materials ids the cove's pools and the ring shrine's pool wear (data/poolLook.ts) */
export const POOL_LOOK = 'driftwood-cove-pool';
export const SHRINE_POOL_LOOK = 'driftwood-shrine-pool';
/** the sea's look.materials id, its dry-socket slots, the empty dry rectangle and the sea-floor texture size (data/oceanLook.ts) */
export const OCEAN_LOOK = 'driftwood-ocean';
export const OCEAN_DRY_SLOTS = 4;
export const OCEAN_NO_DRY = [1e9, 1e9, -1e9, -1e9] as const;
export const SEA_RES = 512;
/** the look.materials id the gulls wear (data/gullGraphLook.ts) */
export const GULL_GRAPH_LOOK = 'driftwood-gulls';
/** the creature body looks (data/creatureLook.ts) */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing', captain: 'driftwood-creature-captain' } as const;
/** every ground-cover look id, near and far (data/coverLook.ts COVER_LOOKS) */
export const COVER_LOOKS = [
  'driftwood-cover-tuft', 'driftwood-cover-tuft-far', 'driftwood-cover-fern', 'driftwood-cover-fern-far',
  'driftwood-cover-hibiscus', 'driftwood-cover-hibiscus-far', 'driftwood-cover-daisy', 'driftwood-cover-daisy-far',
  'driftwood-cover-pebble', 'driftwood-cover-shells', 'driftwood-cover-starfish', 'driftwood-cover-bush', 'driftwood-cover-bush-far',
] as const;
/** the baked island's terrain, caster and cover looks (data/islandLook.ts) */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props',
  cover: 'driftwood-island-cover', coverBig: 'driftwood-island-cover-big',
} as const;
/** the look.materials ids the arms, the two swords and the swimming arms wear (data/fpArmsLook.ts) */
export const FP_ARMS_MATERIALS = { arms: 'driftwood-fp-arms', wood: 'driftwood-fp-wood', iron: 'driftwood-fp-iron', swim: 'driftwood-fp-swim', pickupBlade: 'driftwood-pickup-blade', pickupFittings: 'driftwood-pickup-fittings' } as const;
/** the castaway's first-person arms: rig, framing, shadow lookup and swim line (data/fpArmsLook.ts) */
export const FP_ARMS_LOOK = {
  url: '/assets/models/driftwood-fp/fp-arms.glb',
  skeleton: 'driftwood-fp',
  sockets: ['R_weapon', 'L_hand'],
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'], fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'], phalanges: 3 },
  offset: [-0.03, -0.012, 0],
  frame: { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 },
  sunward: 1.2,
  bladeBase: 0.012,
  swim: { tilt: 1.1, handsZ: -0.5, waterY: -0.16, startD: -0.16 },
  materials: FP_ARMS_MATERIALS,
} as const;
/** the step surfaces the island's audio maps (data/audioSurfaces.ts) */
export const ISLAND_SURFACES = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water'] as const;
export type Surface = typeof ISLAND_SURFACES[number];
/** the island's voice families, prewarmed in this order (data/audioPlayback.ts) */
export const ISLAND_FAMILIES = [
  'step-sand', 'step-planks', 'step-grass', 'step-wetSand', 'step-rock', 'step-water', 'step-stone',
  'whoosh', 'impact-flesh', 'hurt', 'impact-shell', 'impact-wood', 'impact-stone', 'whoosh-heavy',
  'vocal-boar', 'vocal-crab', 'vocal-monkey', 'vocal-sailor', 'windup-boar', 'windup-crab', 'windup-sailor',
  'plunge-down', 'plunge-up', 'death', 'ui-chime', 'ui-chest', 'ui-locked', 'ui-lever', 'ui-plate', 'ui-door', 'ui-grate', 'ui-glyph', 'ui-ignite',
] as const;
/** the faceted ground's materials, build band, cliff lip and slab walls (data/groundLook.ts GROUND_LOOK) */
export const GROUND_LOOK = {
  materials: { ground: 'driftwood-ground', slab: 'driftwood-ground-slab' },
  band: 64,
  lip: { steep: 0.8, reach: 2.5, from: 0.4, to: 1.4 },
  slab: { segs: 96, rock: '#5a5d63', deep: '#1c1f26', top: 0.05, bulge: [4, 5], foot: 2, mid: 0.55, shade: [0.85, 0.3] },
} as const;
/** the low-poly kit variant each graph is lent to (data/kitLook.ts KIT_LENDS) */
export const KIT_LENDS = {
  default: 'driftwood-kit', still: 'driftwood-kit-still', 'rock-smooth': 'driftwood-kit-rock', pennant: 'driftwood-kit-pennant',
  palm: 'driftwood-kit-palm', solid: 'driftwood-kit-solid',
} as const;
/** the faceted sky's dome and cumulus looks (data/skyLook.ts) */
export const SKY_DOME_LOOK = 'driftwood-sky-dome';
export const SKY_CLOUD_LOOK = 'driftwood-sky-cumulus';
/** the midday sky palette, linear RGB before the tonemap (data/skyPalette.ts) */
export const MIDDAY_SKY_ROWS = {
  zenith: [0.055, 0.2, 0.78],
  horizon: [0.36, 0.7, 1.0],
  below: [0.22, 0.46, 0.72],
  sunGlow: [1.0, 0.88, 0.62],
  cloudLit: [1.25, 1.22, 1.16],
  cloudShade: [0.52, 0.6, 0.92],
  night: 0,
} as const;
/** the day light every toon look starts from, and the colour-ramp fog (data/toonLook.ts) */
export const DAY_LIGHT = {
  uToonLift: [0.07, 0.035, 0.2],
  uToonRim: [1.3, 0.95, 0.6],
  uCloudShadow: 0.6,
  uToonNight: 0,
  uSeaLevel: -1e4,
  uCloudTime: 0,
} as const;
export const RAMP_FOG = { start: 180, end: 1700, near: [0.5, 0.6, 0.98], zenith: [0.055, 0.2, 0.78] } as const;
/** the wooden and iron swords' combat profiles the declared items must carry (data/meleeProfile.ts) */
export const DRIFTWOOD_MELEE_PROFILE = {
  family: 'melee', damage: 12, reach: 2.2, swingScale: 1,
  cooldown: 0.08, comboGap: 0.6, chainLag: 0.02, heavyCharge: 0.45,
  moves: { combo: [
    { windup: 0.07, slashEnd: 0.235, total: 0.35, damage: 1, stagger: 0, sweep: 1 },
    { windup: 0.06, slashEnd: 0.22, total: 0.34, damage: 1, stagger: 0, sweep: -1 },
    { windup: 0.1, slashEnd: 0.28, total: 0.44, damage: 1.3333333333333333, stagger: 0.25, sweep: 0.5 },
  ], heavy: { windup: 0.06, slashEnd: 0.3, total: 0.62, damage: 2, stagger: 1, sweep: 0.35 } },
  lunge: { range: 4, heavyRange: 5, cone: 0.4363323129985824, stop: 1.1, speed: 22, minTime: 0.08, maxTime: 0.15 },
  sweep: { rays: 5, extensions: [0.12, 0.24, 0.36, 0.48], step: 0.09, maxSamples: 6, maxHits: 8 },
} as const;
export const DRIFTWOOD_IRON_PROFILE = { ...DRIFTWOOD_MELEE_PROFILE, damage: 28 } as const;
/** the iron sword's world pickup scene: its blade and fittings on the borrowed graph materials (data/ironSwordScene.json) */
export const IRON_SWORD_SCENE = {
  version: 1,
  root: 'pickup',
  nodes: [
    { kind: 'group', id: 'pickup', children: ['blade', 'fittings'] },
    { kind: 'mesh', id: 'blade', geometry: 'blade', material: 'blade', missing: 'empty', position: [0, -0.36, 0], castShadow: true, receiveShadow: true },
    { kind: 'mesh', id: 'fittings', geometry: 'fittings', material: 'fittings', missing: 'empty', position: [0, -0.36, 0], castShadow: true, receiveShadow: true },
  ],
  materials: [
    { kind: 'port', id: 'blade', source: 'blade' },
    { kind: 'port', id: 'fittings', source: 'fittings' },
  ],
} as const;
/** the shore boulders' granite and the reef rocks' weedier basalt (data/rockProfiles.ts) */
export const SHORE_ROCK = {
  foot: '#2f3134', dark: '#45474c', mid: '#5f6165', light: '#7f7e7c', edge: '#918f8b', warm: '#776e63', cool: '#535b64', crease: '#2a2d33',
  moss: '#62853a', mossLight: '#8ea24f', mossDark: '#40602b', wet: '#2e3a36',
} as const;
export const REEF_ROCK = {
  foot: '#3a3836', dark: '#535050', mid: '#726e69', light: '#958f87', edge: '#a8a198', warm: '#8a7f72', cool: '#63666a', crease: '#35333a',
  moss: '#62853a', mossLight: '#8ea24f', mossDark: '#3d5d2a', wet: '#34403b',
} as const;
/** the boat's hull stations (data/boatLayout.ts) */
export const BOAT_LAYOUT = { length: 6.4, beam: 2.2, floor: 0.32, deckThickness: 0.105 } as const;
/** the trader's counter top (data/counterLayout.ts) */
export const COUNTER_TOP = { w: 1.36, d: 0.64, y: 0.86 } as const;
/** the baked island's LOD, cover file and mesh-name rows (data/islandRows.ts ISLAND_LOOK) */
export const ISLAND_LOOK = {
  lod: 110,
  far: { ratio: 0.25, error: 0.01 },
  coverDepth: 0.6,
  coverFile: { magic: 0x43495357, version: 2 },
  names: { casterKinds: ['palm', 'rock', 'prop'], skip: '^rockb?\\d+$', apart: '^smallrock\\d+$', big: '^(bush|flowerbush|hibiscus|fern)\\d+$' },
  protoPrefix: 'proto_',
  meshPrefix: 'island-',
  palmCell: 8,
} as const;
