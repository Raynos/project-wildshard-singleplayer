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
/** the gulls' pier corridors, native wheeling, body response and flap bursts (data/gullsLook.ts) */
export const GULL_FLIGHT = { wave: 0, amplitude: 0, pitch: 0.7, pitchRate: 4, bank: 0.9, bankLimit: 0.75, bankRate: 2.5, directionEpsilon: 1e-4 } as const;
export const GULL_WHEEL = { xAmplitude: 0.22, xFrequency: 2, zScale: 0.85, zAmplitude: 0.18, zFrequency: 3, altitudeFrequency: 0.45, altitudeAmplitude: 3.5, detailFrequency: 1.7, detailAmplitude: 1.2 } as const;
export const GULL_BURSTS = { gull: { phase: [3.6, Math.PI, 2], amplitude: 0.75, foldPhase: 0.6, foldAmplitude: 0.5, rest: [0.14, 0.12], rates: [6, 6], glide: [1.5, 5], beats: [2, 6] } } as const;
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
/** the trophy wall's ids and plaque layout (data/trophyLayout.ts) */
export const TROPHY_LAYOUT = { ids: ['bear', 'boar'], gap: 0.8, width: 0.34, height: 0.43, thickness: 0.03, mountY: 0.235, panelOffset: 0.018 } as const;
/** the ring shrine's two authored sites, the island's and the Explorer specimen's (data/shrineSites.ts) */
export const SHRINE_SITES = { world: { x: -98, z: 108, rot: 2.51 }, specimen: { x: 0, z: 0, rot: 0 } } as const;
/** the finale's reward spot on the shrine knoll (data/spots.generated.json `reward`) */
export const FINALE_REWARD = { x: -96.21572111113656, y: 9.568160017513259, z: 105.52632596242425, yaw: 2.5132741228718345, pitch: 0.6632251157578453, phase: 0.745 } as const;
/** the reef's bounded Explorer defaults, sizes and variants (data/reefSpecimenRows.ts) */
export const REEF_SPECIMENS = {"coral":{"defaults":{"s":1,"rot":0,"v":0,"shape":0},"size":[3,3,3],"variants":[{"id":"brain","label":"Brain","params":{"shape":0}},{"id":"staghorn","label":"Staghorn","params":{"shape":1,"v":0.3}},{"id":"fan","label":"Fan","params":{"shape":2,"v":0.45}},{"id":"tube","label":"Tube","params":{"shape":3,"v":0.6}}]},"weed":{"defaults":{"s":1,"rot":0,"v":0},"size":[3,3,3],"variants":[{"id":"tint-0","label":"Tint 1","params":{"v":0.125}},{"id":"tint-1","label":"Tint 2","params":{"v":0.375}},{"id":"tint-2","label":"Tint 3","params":{"v":0.625}},{"id":"tint-3","label":"Tint 4","params":{"v":0.875}}]},"star":{"defaults":{"s":0.7,"rot":0,"v":0},"size":[3,1,3],"variants":[{"id":"tint-0","label":"Tint 1","params":{"v":0.16666666666666666}},{"id":"tint-1","label":"Tint 2","params":{"v":0.5}},{"id":"tint-2","label":"Tint 3","params":{"v":0.8333333333333334}}]}} as const;
/** the six trail Explorer specimens' parameter records (data/trailSpecimenRows.ts) */
export const TRAIL_SPECIMEN_ROWS = [{"kind":"fence-post","id":"fencePost","params":{},"size":[3,2,3]},{"kind":"signpost","id":"two","params":{"arrows":[-1.27,0.35],"labels":["HUT","LOOKOUT"]},"size":[4,3,4]},{"kind":"signpost","id":"one","params":{"arrows":[1.2],"labels":["WRECK"]},"size":[4,3,4]},{"kind":"signpost","id":"three","params":{"arrows":[0.45,0.75,-0.87],"labels":["LOOKOUT","WRECK","SHRINE"]},"size":[4,3,4]},{"kind":"plank-step","id":"light","params":{"w":2.4,"roll":0,"yaw":0,"dark":false},"size":[3,2,3]},{"kind":"plank-step","id":"dark","params":{"w":2.4,"roll":0,"yaw":0,"dark":true},"size":[3,2,3]}] as const;
/** the trail specimens' immutable Explorer geometry (data/trailSpecimens.ts) */
export const TRAIL_SPECIMENS = {"fencePost":"/assets/driftwood-isle/baked/trail-71195c5f474dcd59692f73db2ac16ac5c4a488b49e6c00bad155e86dfb873ea4.glb","two":"/assets/driftwood-isle/baked/trail-a388307316b578e92a35be49f3e35d75992f50c6498c6e961c2bdaabb97cf78c.glb","one":"/assets/driftwood-isle/baked/trail-f1645c1601d885caa3c32b2fdacb99a5ac354c10e770eec99b53cffa39c972bf.glb","three":"/assets/driftwood-isle/baked/trail-3b31606dd2e7bab937624a0cf40e503ea8ff1c5a152c9a86b04d4898187b9c11.glb","light":"/assets/driftwood-isle/baked/trail-0239a5bb72a630612f7e2303d248fdb6f93ab57672f1cd967c8ea71be3678c2d.glb","dark":"/assets/driftwood-isle/baked/trail-bcd26672d7cc0fa1190447ec2dc52216bd2031689ef2b8bc3fdaefb54d794acf.glb"} as const;
/** the zipline's baked draws (legacy URLs the product's custom/assets names) and its admitted world / specimen layouts (data/zipline.generated.json), read at model definition */
export const ZIPLINE_ROWS = {"world":"/assets/driftwood-isle/baked/zipline-f46535e8c9879d9dd99034069990a534923dc9239c2efa6bb069362e49f5b38f.glb","trolley":"/assets/driftwood-isle/baked/zipline-418925b4346b831476c455e13d1f48118ffb34bcb6084e2d43a06290aa4e5852.glb","specimen":"/assets/driftwood-isle/baked/zipline-a046356e204f5dc454bafb388cdd01b60789778a428eb9b43b49c4a4120a2f2b.glb","parked":"/assets/driftwood-isle/baked/zipline-21ff0e7566db26cbc6d4a67e1990adb9c3c89be792a27f0ece3908647ea0ce79.glb","layout":{"top":{"x":116.80870125700497,"y":33.55979897744159,"z":56.6249609037573},"bottom":{"x":132,"y":0.8549076442718511,"z":12},"sag":1.6,"prompt":{"x":116.74424917158824,"y":35.05979897744159,"z":56.81429111446186,"radius":2.4}},"specimenLayout":{"top":{"x":0,"y":0,"z":0},"bottom":{"x":13,"y":-5,"z":3}}} as const;
/** the dev capture probes the diagnostic poses stand at (manifest.json captureProbes) */
export const CAPTURE_PROBES = [
  { name: 'pier', x: 0, z: -194, yaw: 3.141592653589793, pitch: 0 },
  { name: 'beach', x: -10, z: -150, yaw: 4.3, pitch: 0 },
  { name: 'wreck', x: 105, z: 0, yaw: -1.5707963267948966, pitch: 0 },
] as const;

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */
export const DRIFTWOOD_BOOT_FILES = {
  "empty": {
    "source": {
      "urls": []
    }
  },
  "baked": {
    "source": {
      "publicPrefix": "/assets/baked/driftwood-isle/tex/"
    },
    "excludeParts": [
      ".phone."
    ],
    "map": [
      "gpu"
    ]
  },
  "physics": {
    "source": {
      "urls": [
        "/assets/physics/rapier.wasm"
      ]
    }
  },
  "lut": {
    "source": {
      "urls": [
        "/assets/lut/driftwood-isle.bin"
      ]
    }
  },
  "horizon": {
    "source": {
      "urls": [
        "/assets/horizon/driftwood-isle-day.webp",
        "/assets/horizon/driftwood-isle-night.webp"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "island": {
    "source": {
      "urls": [
        "/assets/models/driftwood-blender/island.glb"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "records": {
    "source": {
      "urls": {
        "phone": [
          "/assets/models/driftwood-blender/island.json",
          "/assets/models/driftwood-blender/placements.bin",
          "/assets/driftwood-isle/baked/island-plan-bbe7282cde6bf8a130140dd7c952b4b3c86159c59daf1b5f56f93fb04ddf8bee.json"
        ],
        "desktop": [
          "/assets/models/driftwood-blender/island.json",
          "/assets/models/driftwood-blender/placements.bin",
          "/assets/driftwood-isle/baked/island-plan-cbf54035425a3adeaffdb5648b055437c27453980f670e8dda8234ef874b8bba.json"
        ]
      }
    }
  },
  "lights": {
    "source": {
      "urls": {
        "phone": [
          "/assets/models/driftwood-blender/lm-ao.phone.webp",
          "/assets/models/driftwood-blender/lm-bounce.phone.webp"
        ],
        "desktop": [
          "/assets/models/driftwood-blender/lm-ao.webp",
          "/assets/models/driftwood-blender/lm-bounce.webp"
        ]
      }
    },
    "map": [
      "gpu"
    ]
  },
  "reef": {
    "source": {
      "urls": [
        "/assets/driftwood-isle/baked/reef-2485e39982beb460e69e164562f178b6214cc080bedfa8e17281d8bd86a9f8f6.bin"
      ]
    }
  },
  "ground": {
    "source": {
      "urls": [
        "/assets/driftwood-isle/baked/ground-239a2c11d0e40f6cf32f64d6d09a03429c8c1bead98db28532099b4d002c33d6.glb",
        "/assets/driftwood-isle/baked/ground-c1b1903f1ee18926f7489a52f4f5eddd224d57f030fbca0dd4e0e2893f609b92.glb"
      ]
    }
  },
  "ocean": {
    "source": {
      "urls": {
        "phone": [
          "/assets/driftwood-isle/baked/ocean-e29cd70d60cff4eed17da3621629db3cc7de24f9b98a4a9738470026ea4c9328.glb",
          "/assets/driftwood-isle/baked/ocean-4594171dad0831c9522dd54adc6c3c5f306ada75dec05bdfaea40699eb934ad8.bin"
        ],
        "desktop": [
          "/assets/driftwood-isle/baked/ocean-93422f68838c3c52f063ad95964c770570ff11f395e78e71a111077558378022.glb",
          "/assets/driftwood-isle/baked/ocean-4594171dad0831c9522dd54adc6c3c5f306ada75dec05bdfaea40699eb934ad8.bin"
        ]
      }
    }
  },
  "palms": {
    "source": {
      "urls": {
        "phone": [
          "/assets/driftwood-isle/baked/palm-b215817e315b21685f4860a94a6e706466ffaf53ac9edc4d1c29fec3aa6f2392.bin"
        ],
        "desktop": [
          "/assets/driftwood-isle/baked/palm-4a6d31124c14498f867d244c61c244b9855701711a051781f938e0a1df1a4e88.bin"
        ]
      }
    }
  },
  "hibiscus": {
    "source": {
      "urls": {
        "phone": [
          "/assets/driftwood-isle/baked/hibiscus-3e1779a84ad4aaf5d2814319d916ca58a30a6c63aca6c0ebf83ef0ec14f6bae6.bin"
        ],
        "desktop": [
          "/assets/driftwood-isle/baked/hibiscus-38a4f8b6ba5c423dfa20a693ea244abf4f153305d869d71f22e2c2b2742af22d.bin"
        ]
      }
    }
  },
  "cover": {
    "source": {
      "urls": {
        "phone": [
          "/assets/driftwood-isle/baked/island-cover-742619371bf3887692480c2595c8762c150fea4061608e96954a08ed0cc02edf.bin"
        ],
        "desktop": [
          "/assets/driftwood-isle/baked/island-cover-c28f6393f7d4293a4140b2d20b2460d2cd2f7204e134324e735bdff69e3f549d.bin"
        ]
      }
    }
  },
  "captain": {
    "source": {
      "urls": [
        "/assets/models/driftwood-hero/captain/captain.glb"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "late": {
    "source": {
      "concat": [
        "lut",
        "horizon",
        "island",
        "records",
        "lights",
        "cover",
        "hibiscus",
        "palms",
        "reef",
        "ground",
        "captain"
      ]
    },
    "present": true
  }
} as const;

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */
export const DRIFTWOOD_BOOT_SOURCES = {
  "sky": "empty",
  "baked": "baked",
  "terrain": "empty",
  "trees": "empty",
  "physics": "physics",
  "cabins": "empty",
  "props": "empty",
  "art": "empty",
  "music": "empty",
  "sfx": "empty"
} as const;

/** Checked build-time file mirror (data/runtimeFiles.ts); private draws use named blobs. */
export const GPU_FILES = {
  "phone": {
    "/assets/baked/driftwood-isle/tex/giant.phone.webp": "/assets/gpu/baked/driftwood-isle/tex/giant-db470988.ktx2",
    "/assets/horizon/driftwood-isle-day.webp": "/assets/gpu/horizon/driftwood-isle-day-2ca8c3a2.ktx2",
    "/assets/horizon/driftwood-isle-night.webp": "/assets/gpu/horizon/driftwood-isle-night-f949f086.ktx2",
    "/assets/models/driftwood-blender/lm-ao.phone.webp": "/assets/gpu/models/driftwood-blender/lm-ao.phone-9f6766dc.ktx2",
    "/assets/models/driftwood-blender/lm-bounce.phone.webp": "/assets/gpu/models/driftwood-blender/lm-bounce.phone-582c92be.ktx2",
    "/assets/models/driftwood-hero/captain/captain.glb": "/assets/gpu/models/driftwood-hero/captain/captain-51fb1b40.glb"
  },
  "desktop": {
    "/assets/baked/driftwood-isle/tex/giant.jpg": "/assets/gpu/baked/driftwood-isle/tex/giant-db470988.ktx2",
    "/assets/horizon/driftwood-isle-day.webp": "/assets/gpu/horizon/driftwood-isle-day-2ca8c3a2.ktx2",
    "/assets/horizon/driftwood-isle-night.webp": "/assets/gpu/horizon/driftwood-isle-night-f949f086.ktx2",
    "/assets/models/driftwood-blender/lm-ao.webp": "/assets/gpu/models/driftwood-blender/lm-ao-880aa796.ktx2",
    "/assets/models/driftwood-blender/lm-bounce.webp": "/assets/gpu/models/driftwood-blender/lm-bounce-c187e3f8.ktx2",
    "/assets/models/driftwood-hero/captain/captain.glb": "/assets/gpu/models/driftwood-hero/captain/captain-51fb1b40.glb"
  }
} as const;
