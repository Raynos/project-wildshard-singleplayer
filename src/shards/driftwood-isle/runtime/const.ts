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
/** the castaway's client scene, its parts and bindings (data/npcScenes.ts) */
export const CASTAWAY_SCENE = { version: 1, root: 'root', materials: [{ id: 'coat', kind: 'port', source: 'coat' }], nodes: [{ id: 'root', kind: 'group', name: 'npc-castaway', children: ['figure', 'camp', 'flames', 'smoke'] }, { id: 'figure', kind: 'group', children: ['body', 'head', 'arm'] }, { id: 'body', kind: 'mesh', geometry: 'body', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true }, { id: 'camp', kind: 'mesh', geometry: 'camp', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true }, { id: 'head', kind: 'mesh', geometry: 'head', material: 'coat', missing: 'empty', position: [0, 1.52, 0.01] }, { id: 'arm', kind: 'mesh', geometry: 'arm', material: 'coat', missing: 'empty', position: [-0.21, 1.4, 0] }, { id: 'flames', kind: 'object', source: 'flames', missing: 'refuse' }, { id: 'smoke', kind: 'object', source: 'smoke', missing: 'refuse' }] } as const;
export const CASTAWAY_PARTS = { figure: 'group', body: 'object', camp: 'object', head: 'object', arm: 'object' } as const;
export const CASTAWAY_BINDINGS = { figure: { kind: 'group', part: 'figure' }, body: { kind: 'object', part: 'body' }, camp: { kind: 'object', part: 'camp' }, head: { kind: 'object', part: 'head' }, arm: { kind: 'object', part: 'arm' } } as const;
/** the castaway's pose clips (data/npcPose.ts) */
export const CASTAWAY_POSE = [{ bone: 'head', channel: 'rotation.x', cases: [{ sum: [{ of: [{ mem: 'headPitch' }] }, { of: [{ wave: 't', rate: 1.6 }, 0.02] }] }] }, { bone: 'head', channel: 'rotation.y', cases: [{ sum: [{ of: [{ mem: 'headYaw' }] }] }] }, { bone: 'head', channel: 'rotation.z', cases: [{ sum: [{ of: [{ wave: 't', rate: 0.5 }, 0.05] }] }] }, { bone: 'head', channel: 'position.y', cases: [{ sum: [1.52, { of: [{ wave: 't', rate: 1.6 }, 0.006] }] }] }, { bone: 'arm', channel: 'rotation.x', cases: [{ sum: [0], when: { mem: { key: 'waving', atLeast: 1 } } }, { sum: [{ of: [{ wave: 't', rate: 1.1 }, 0.05] }] }] }, { bone: 'arm', channel: 'rotation.y', cases: [{ sum: [0] }] }, { bone: 'arm', channel: 'rotation.z', cases: [{ sum: [{ of: [-2.6, { bounded: [{ of: [{ clock: 'phase' }, 4] }], max: 1 }, { bounded: [{ of: [{ bounded: [2.2, { of: [{ clock: 'phase' }, -1] }] }, 4] }], min: 0, max: 1 }] }, { of: [{ wave: 'phase', rate: 12 }, 0.35, { bounded: [{ of: [{ clock: 'phase' }, 4] }], max: 1 }, { bounded: [{ of: [{ bounded: [2.2, { of: [{ clock: 'phase' }, -1] }] }, 4] }], min: 0, max: 1 }] }], when: { mem: { key: 'waving', atLeast: 1 } } }, { sum: [0.08, { of: [{ bounded: [{ of: [{ wave: 't', rate: 2.3 }] }], min: 0 }, 0.35, { mem: 'talking' }] }] }] }, { bone: 'flames', channel: 'rotation.y', cases: [{ sum: [{ of: [{ clock: 't' }, 0.6] }] }] }] as const;
/** the castaway's head focus and body facing (data/npcFocus.ts) */
export const CASTAWAY_HEAD_FOCUS = { range: 9, yawLimit: 1.1, pitchLimit: 0.4, pitchScale: 1, eyeHeight: 1.6, minimumDistance: 0.5, response: 'linear', rate: 5, clampAfterOffset: false, idle: { cadence: { kind: 'sine', base: 2.5, frequency: 1.7, span: 2 }, yaw: [0.37, 0.8], pitch: 0.15 } } as const;
export const CASTAWAY_FACING = { range: 6, rate: 3, maxSpeed: 2.2, wrapTarget: true, wrapOutput: true } as const;
/** the trader's client scene, its parts and bindings (data/npcScenes.ts) */
export const TRADER_SCENE = { version: 1, root: 'root', materials: [{ id: 'coat', kind: 'port', source: 'coat' }], nodes: [{ id: 'root', kind: 'group', name: 'trader', children: ['figure'] }, { id: 'figure', kind: 'group', children: ['body', 'head', 'upper'] }, { id: 'body', kind: 'mesh', geometry: 'body', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true }, { id: 'head', kind: 'mesh', geometry: 'head', material: 'coat', missing: 'empty', position: [0, 1.48, 0.01] }, { id: 'upper', kind: 'mesh', geometry: 'upper', material: 'coat', missing: 'empty', position: [-0.19, 1.4, 0], children: ['fore'] }, { id: 'fore', kind: 'mesh', geometry: 'fore', material: 'coat', missing: 'empty', position: [-0.03, -0.27, 0.02] }] } as const;
export const TRADER_PARTS = { figure: 'group', body: 'object', head: 'object', upper: 'object', fore: 'object' } as const;
export const TRADER_BINDINGS = { figure: { kind: 'group', part: 'figure' }, body: { kind: 'object', part: 'body' }, head: { kind: 'object', part: 'head' }, upper: { kind: 'object', part: 'upper' }, fore: { kind: 'object', part: 'fore' } } as const;
/** the trader's pose clips (data/npcPose.ts) */
export const TRADER_POSE = [{ bone: 'figure', channel: 'rotation.y', cases: [{ sum: [{ of: [{ mem: 'turn' }] }] }] }, { bone: 'figure', channel: 'rotation.z', cases: [{ sum: [{ of: [{ wave: 't', rate: 0.42 }, 0.018] }] }] }, { bone: 'figure', channel: 'position.x', cases: [{ sum: [{ of: [{ wave: 't', rate: 0.42 }, 0.012] }] }] }, { bone: 'head', channel: 'rotation.x', cases: [{ sum: [{ of: [{ mem: 'headPitch' }] }, { of: [{ wave: 't', rate: 1.5, offset: 0.7 }, 0.02] }] }] }, { bone: 'head', channel: 'rotation.y', cases: [{ sum: [{ of: [{ mem: 'headYaw' }] }] }] }, { bone: 'head', channel: 'rotation.z', cases: [{ sum: [{ of: [{ wave: 't', rate: 0.55 }, 0.05] }, { of: [{ wave: 't', rate: 0.42 }, -0.03] }] }] }, { bone: 'head', channel: 'position.y', cases: [{ sum: [1.48, { of: [{ wave: 't', rate: 1.5, offset: 0.7 }, 0.006] }] }] }, { bone: 'upper', channel: 'rotation.x', cases: [{ sum: [{ of: [-0.7, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 3 } } }, { sum: [{ of: [-0.5, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 2 } } }, { sum: [{ of: [-0.55, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 1 } } }, { sum: [{ of: [{ wave: 't', rate: 1.1 }, 0.05] }] }] }, { bone: 'upper', channel: 'rotation.z', cases: [{ sum: [-0.1, { of: [-0.25, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 3 } } }, { sum: [-0.1, { of: [0.18, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 2 } } }, { sum: [-0.1, { of: [-0.65, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 1 } } }, { sum: [-0.1] }] }, { bone: 'upper', channel: 'rotation.y', cases: [{ sum: [{ of: [0.3, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 3 } } }, { sum: [0], when: { mem: { key: 'gesture', atLeast: 2 } } }, { sum: [{ of: [0.5, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 1 } } }, { sum: [0] }] }, { bone: 'fore', channel: 'rotation.x', cases: [{ sum: [-0.12, { of: [-0.35, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 3 } } }, { sum: [-0.12, { of: [-0.28, { mem: 'weight' }] }, { of: [{ wave: 'phase', rate: 5 }, 0.08, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 2 } } }, { sum: [-0.12, { of: [{ bounded: [1.5, { of: [{ wave: 'phase', rate: 11 }, 0.35] }] }, -1, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 1 } } }, { sum: [-0.12] }] }, { bone: 'figure', channel: 'rotation.x', cases: [{ sum: [0], when: { mem: { key: 'gesture', atLeast: 3 } } }, { sum: [{ of: [0.07, { mem: 'weight' }] }], when: { mem: { key: 'gesture', atLeast: 2 } } }, { sum: [0], when: { mem: { key: 'gesture', atLeast: 1 } } }, { sum: [0] }] }, { bone: 'fore', channel: 'rotation.y', cases: [{ sum: [0] }] }, { bone: 'fore', channel: 'rotation.z', cases: [{ sum: [0] }] }] as const;
/** the trader's head focus and body facing (data/npcFocus.ts) */
export const TRADER_HEAD_FOCUS = { range: 11, yawLimit: 0.9, pitchLimit: 0.4, pitchScale: 1, eyeHeight: 1.6, minimumDistance: 0.5, response: 'linear', rate: 5, clampAfterOffset: true, idle: { cadence: { kind: 'sine', base: 2, frequency: 1.9, span: 1.8 }, yaw: [0.41, 0.75], pitch: { frequency: 0.7, threshold: 0.4, above: 0.35, below: 0.05 } } } as const;
export const TRADER_FACING = { range: 6, rate: 3, maxSpeed: 2.2, wrapTarget: true, wrapOutput: true } as const;
/** the castaway's campfire smoke column (data/castawayLook.ts) */
export const CASTAWAY_SMOKE = { count: 42, rise: 21, life: 13, rate: [0.85, 0.3], seedSpread: 10, reseed: 1.37, seed: 24076, ease: 0.9, linear: 0.1, base: 1.2, lean: 5, wind: [0.8, 0.55], wanderX: [8, 5, 0.2, 1.1], wanderZ: [6.3, 3, 0.2, 0.9], size: [0.9, 4.4], fadeIn: 0.08, fadeOut: 0.45, fadePow: 1.3, thin: [0.45, 0.55, 7.7], color: [0.8, 0.79, 0.77], opacity: [0.12, 0.46], opacityFrom: 8, opacityTo: 30, bounds: { offset: [2, 9, 1.5], radius: 14 }, renderOrder: 4, name: 'castaway-smoke' } as const;
/** the two authored shipwreck sites, Wreck Cove (lowered with the world) and the Explorer's specimen (data/wreckSites.ts) */
export const WRECK_SITES = {
  world: { x: 153, z: 2, heading: 2.7, roll: -0.2, pitch: 0.05, floorY: 0.6499999999999999 },
  specimen: { x: 0, z: 0, heading: 0, roll: -0.2, pitch: 0.05, floorY: 1.2 },
} as const;
/** a faceted day preset's fields by kind (data/facetedDayRows.ts FACETED_DAY_PRESET) */
export const FACETED_DAY_PRESET = {
  sky: { zenith: 'colour', horizon: 'colour', below: 'colour', sunGlow: 'colour', cloudLit: 'colour', cloudShade: 'colour', night: 'number' },
  light: 'colour', lightI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  lift: 'colour', rim: 'colour', fogNear: 'colour', fogSun: 'colour', disc: 'colour', cloudShadow: 'number', dusk: 'number',
} as const;
/** the Drowned Captain's encounter id, arena radius and boss-bar name (data/captainEncounter.ts) */
export const CAPTAIN_ID = 'boss.captain';
export const CAPTAIN_ARENA_R = 22;
export const CAPTAIN_NAME = 'The Drowned Captain';
