/**
 * Pine Hollow's runtime copies of build-time constants (G449: whatever the standalone runtime needs is duplicated into
 * it; P2a spec §2.3). Each export below mirrors a `data/` value that `data/runtimeMirrors.ts` names, and
 * `test/pine-runtime-mirrors.test.ts` (the build's step 5 once wired) refuses any drift. Plain JSON `export const`s only.
 */

/** the King's clearing (data/layout.ts KINGS_CLEARING): centre, flat radius, blend and clear radii */
export const KINGS_CLEARING = { x: 150, z: -30, r: 30, blend: 42, clear: 38 } as const;
/** the King's fight-ring fog wall radius (data/kingFight.ts ANTLER_KING_FIGHT.arena.fog) */
export const KING_ARENA_FOG = 31;
/** the King's fx look.materials ids (data/kingFxLook.ts KING_FX_LOOKS) */
export const KING_FX_LOOKS = { fog: 'pine-king-fog', flame: 'pine-king-flame' } as const;
/** the look.materials graphs runtime/index.ts compiles before the streams build (generators/lookMaterials.ts `runtime`) */
export const PINE_RUNTIME_GRAPHS = [
  'pine-cabin-door',
  'pine-cabin-moss-roof',
  'pine-cabin-moss-stone',
  'pine-hearth-smoke',
  'pine-hearth-flame',
  'pine-hearth-ember',
  'pine-cave-shaft',
  'pine-crag',
  'pine-waterfall-spray',
  'pine-king-fog',
  'pine-king-flame',
  'pine-rain-curtain',
  'pine-rain-splash',
  'pine-rain-lens',
  'pine-undergrowth',
  'pine-water-pond',
  'pine-water-creek',
  'pine-water-trickle',
  'pine-water-puddle',
] as const;
/** the small wildlife's look.materials id (data/wildlifeLook.ts WILDLIFE_LOOK) */
export const WILDLIFE_LOOK = 'pine-wildlife';
/** the lever action's auto-reload close (data/leverProfile.ts LEVER_WEAPON_PROFILE.lever.autoReloadClose) */
export const LEVER_AUTO_RELOAD_CLOSE = 5;
/** the gloves' linear tint over the hunter palette (data/handsLook.ts BUCKSKIN) */
export const BUCKSKIN: [number, number, number] = [3.2, 4.2, 6.0];
/** the hunter's gloves and coat cuff palette (data/handsLook.ts HUNTER_HANDS, a GloveHandsLook) */
export const HUNTER_HANDS = {
  palette: {
    leather: 0x6a4a30, leatherLight: 0x8a6646, leatherDark: 0x3a281a, leatherEdge: 0x4a3424, thread: 0xa89878,
    fleece: 0x6e685e, fleeceShade: 0x524c44, fleeceDeep: 0x3a352f,
    wool: 0x5e5038, woolShade: 0x3e3424, red: 0x4a3422, redDeep: 0x33251a, redLine: 0x2a1e14,
  },
  coatLip: 0x8a7650,
  coatStitch: 0x2e2618,
};
/** the hands' material parameters (data/handsLook.ts HANDS_MATERIAL) */
export const HANDS_MATERIAL = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };
/** the coat sleeve's material row (data/handsLook.ts COAT_MATERIAL) */
export const COAT_MATERIAL = { set: 'coat', normalScale: [0.8, 0.8], roughness: 1, metalness: 0, envMapIntensity: 0.5, specularIntensity: 0.5 } as const;

/** the cave mouth's frame (data/layout.ts BEAR_CAVE) */
export const BEAR_CAVE = { x: 200, z: 200, rot: 0.7853981633974483 };
/** small world dimensions, shared with the author bake (data/hollowLog.json) */
export const HOLLOW_LOG_SHAPE = { len: 11, R: 1.6, r: 1.3, bed: 0.42 };
/** the Explorer names (data/wardensHollow.ts dialogue names), without loading quest dialogue */
export const NPC_NAMES = { ranger: 'Hale, ranger of the Hollow', miller: 'Brandt, the miller', trader: 'Mott, the trader' };
/** the NPC figure dimensions and motion (data/peopleLook.ts) */
export const NPC_FIGURE = {
  collider: { half: 0.28, top: 1.8, bottom: 0.3 },
  talkHeight: 1.6,
  drawDistance: 140,
  shadowDistance: 45,
  noticeRadius: 9,
  walk: { speed: 0.72, cycle: 0.72 },
  flame: { radius: 0.035, widthSegments: 8, heightSegments: 6, color: [2.4, 1.35, 0.45] },
  point: { period: 9, from: 5.5, to: 8 },
  sway: { breathe: 0.006, breatheRate: 1.7, talk: 0.025, talkRate: 2.3 },
} as const;
/** graph material identities, not shader code (data/cragLook.ts, streamLook.ts) */
export const CRAG_LOOK = 'pine-crag';
export const SPRAY_LOOK = 'pine-waterfall-spray';
/** cave lighting and drip parameters (data/cragLook.ts) */
export const CAVE_LOOK = {
  near: 60,
  under: { height: 7, lzMin: -4, lzMax: 36 },
  fill: [0.05, 1.6],
  surface: 'rock',
  shaft: { look: 'pine-cave-shaft', radialSegments: 20, heightSegments: 6, renderOrder: 7, gain: 0.2, sunBase: 0.4, sunGain: 2, floor: 0.02 },
  drips: { color: 0xcfd8dc, size: 0.045, opacity: 0.85, period: 1.7, periodStep: 0.53, kinds: 5, phaseStep: 0.37, gravity: 9.8, hang: 0.04, minDrop: 0.2 },
} as const;

/** Client-only longbow look, grip and flight mirrors; native profiles keep their original owners. */
/** The arrow: an ash shaft, a sinew-bound bodkin head, three grey-goose feathers (a white cock feather). */
export const LONGBOW_ARROW = {
  length: 0.76, shaft: 0xc9a878, shaftDark: 0x8a6a46, binding: 0x4a3622, head: 0x3c3e42, feather: 0x8e8a84, featherBar: 0xe6e0d4,
} as const;
/** The stave: its proportions and bend, the string, the yew's colours, the arrow and the gloved fists on it. */
export const LONGBOW_LOOK = {
  gripH: 0.06, limbW: 0.74, nockL: 0.035,
  kappaRest: 0.52, kappaDraw: 0.9,
  braceZ: 0.155, drawLen: 0.56,
  arrowX: -0.017, arrowY: 0.052,
  radial: 14, stringRadial: 6, stringR: 0.0019, serving: 0.1,
  palette: {
    sap: 0xd9c08e, sapDark: 0xb89a64, heart: 0x9a4a24, heartDark: 0x6a2c14, heartHi: 0xc0703a,
    horn: 0x2a211a, hornHi: 0x6a5a44, leather: 0x3a2a1c, leatherHi: 0x5c4430, amber: 0xe08a28,
    string: 0xd8ccb0, serving: 0x3a2e24,
  },
  arrow: LONGBOW_ARROW,
  hands: HUNTER_HANDS.palette,
  leftFist: { R: 0.019, mirror: true, yaw: -0.32 },
  rightFist: { R: 0.009, yaw: 0.55 },
  rightRoll: 1.35,
  leftSleeve: [1.0, 1], rightSleeve: [0.9, 2],
} as const;
/** The Longbow's material (the viewmodels' shared lit program): waxed yew, leather, linen. */
export const LONGBOW_MATERIAL = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };
/** The arrows' material (the viewmodels' shared lit program, vertex colours × the 1×1 fillers): ash, sinew, feathers. */
export const ARROW_MATERIAL = { roughness: 0.7, metalness: 0 };
/* Poses in rig space (camera space / VM_SCALE), the starter bow's, re-seated for a bow twice as tall: rest = lowered and
 * canted across the body; drawn = the fist right of centre, the stave canted, the arrow converging on the crosshair ~6 m out. */
/** The Longbow's grip poses. */
export const LONGBOW_POSES = {
  rest: { pos: [0.32, -0.46, -0.9], aim: [-0.1, 0.25, -4], cant: -0.78, pitch: -0.16 },
  drawn: { pos: [0.2, -0.17, -1.12], aim: [0, 0, -5.5], cant: -0.3, pitch: 0 },
  restPort: { pos: [0.16, -0.52, -0.92], aim: [-0.05, 0.12, -4], cant: -0.62, pitch: -0.14 },
  drawnPort: { pos: [0.07, -0.1, -1.08], aim: [0, 0, -5.5], cant: -0.24, pitch: 0 },
  aim: { pos: [0.1, -0.22, -1.15], aim: [0.02, -0.052, -7], cant: -0.22, pitch: 0 },
  aimPort: { pos: [0.04, -0.19, -1.15], aim: [0.02, -0.052, -8], cant: -0.16, pitch: 0 },
} as const;

export const ARROW_FLIGHT = { gravity: 6, drag: 0.014, windCoupling: 0.25 };
export const ARROW_MAX_FLYING = 8;

/** Weapon finish look and GEAR card mirrors, with their original order. */
export const WEAPON_FINISHES = {
  'ghost-stag': {
    id: 'ghost-stag', weapon: 'crossbow', name: 'Ghost Stag', blurb: 'bone-white ash, the stag\'s own antlers for a prod',
    dropsFrom: { kind: 'deer', variant: 'ghost' },
    mats: {
      'xbow-wood': { color: 0xd9cfb4, roughness: 0.6, envMapIntensity: 0.8, emissive: 0x8fe3ff, emissiveIntensity: 0.03, plain: true },
      'xbow-prod': { color: 0xe9dfc6, metalness: 0, roughness: 0.55, envMapIntensity: 0.6, plain: true },
      'xbow-iron': { color: 0xc9ced4, roughness: 0.55, envMapIntensity: 1.1 },
      'xbow-brass': { color: 0xc9ced4, roughness: 0.5 },
      'xbow-leather': { color: 0xdad3c4, roughness: 0.9 },
      'xbow-cord': { color: 0xe8fbff, emissive: 0x8fe3ff, emissiveIntensity: 0.9 },
    },
  },
  'hollow-ash': {
    id: 'hollow-ash', weapon: 'crossbow', name: 'Hollow Ash', blurb: 'charred ash, cold light in the cracks',
    mats: {
      'xbow-wood': { color: 0x2a2a2e, roughness: 1, emissive: 0x8fe3ff, emissiveIntensity: 0.08 },
      'xbow-prod': { color: 0x1c1d22, roughness: 0.9, envMapIntensity: 0.9 },
      'xbow-iron': { color: 0x15161a, roughness: 0.8 },
      'xbow-brass': { color: 0xc9ced4, roughness: 0.5 },
      'xbow-leather': { color: 0x2a2523 },
      'xbow-cord': { color: 0x1a1a1a },
    },
  },
  'ironhide': {
    id: 'ironhide', weapon: 'rifle', name: 'Ironhide', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge',
    dropsFrom: { kind: 'boar', variant: 'ironhide' },
    mats: {
      'rifle-alu': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: 0xff5a12, emissiveIntensity: 0.02 },
      'rifle-poly': { color: 0xe9dfc6, metalness: 0, roughness: 0.55, envMapIntensity: 0.7, plain: true },
      'rifle-steel': { color: 0x3a2a22, roughness: 0.9, emissive: 0xff5a12, emissiveIntensity: 0.1 },
      'rifle-brass': { color: 0xf2b24c, roughness: 0.45, envMapIntensity: 1.2 },
      // Pine Hollow's lever-action (LeverRifle.ts) wears it too: iron-dark steel, a tusk-ivory stock, brass
      'lever-steel': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: 0xff5a12, emissiveIntensity: 0.03 },
      'lever-wood': { color: 0xe9dfc6, roughness: 0.55, envMapIntensity: 0.7 },
      'lever-brass': { color: 0xf2b24c, roughness: 0.45, envMapIntensity: 1.2 },
    },
  },
  'blackpaw': {
    id: 'blackpaw', weapon: 'crossbow', name: 'Blackpaw', blurb: 'bear-black stock, claw-hook nocks, the rent in arrears',
    mats: {
      'xbow-wood': { color: 0x2a221d, roughness: 0.95, envMapIntensity: 0.7 },
      'xbow-prod': { color: 0x16130f, roughness: 0.8 },
      'xbow-iron': { color: 0x2b2a28, roughness: 0.7 },
      'xbow-brass': { color: 0x8a7a64, roughness: 0.6 },
      'xbow-leather': { color: 0x1d1714, roughness: 1 },
      'xbow-cord': { color: 0x3a2e24 },
    },
  },
  'imperial': {
    id: 'imperial', weapon: 'crossbow', name: 'Imperial', blurb: 'antler-ivory stock, gold fittings, seven tines on the prod',
    mats: {
      'xbow-wood': { color: 0xe6d8b8, roughness: 0.55, envMapIntensity: 0.8 },
      'xbow-prod': { color: 0xcfb58a, roughness: 0.5, envMapIntensity: 0.9 },
      'xbow-iron': { color: 0xf2b24c, roughness: 0.35, metalness: 1, envMapIntensity: 1.3 },
      'xbow-brass': { color: 0xf2b24c, roughness: 0.3, envMapIntensity: 1.4 },
      'xbow-leather': { color: 0x5a2b1c, roughness: 0.8 },
      'xbow-cord': { color: 0xf2e2b0 },
    },
  },
  'warden': {
    id: 'warden', weapon: 'crossbow', name: 'Warden', blurb: 'bark-bound limbs, amber in the grain, it hums at night',
    mats: {
      'xbow-wood': { color: 0x2e241a, roughness: 1, emissive: 0xff8a2a, emissiveIntensity: 0.06 },
      'xbow-prod': { color: 0x3a2f22, roughness: 0.9 },
      'xbow-iron': { color: 0x1f1c18, roughness: 0.8 },
      'xbow-brass': { color: 0xffa040, emissive: 0xff8a2a, emissiveIntensity: 0.5, roughness: 0.5 },
      'xbow-leather': { color: 0x3b4a22, roughness: 1 },
      'xbow-cord': { color: 0xffc070, emissive: 0xff9a3a, emissiveIntensity: 0.9 },
    },
  },
  'scarback-furnace': {
    id: 'scarback-furnace', weapon: 'rifle', name: 'Scarback Furnace', blurb: 'forge-black steel, molten light through the vents',
    mats: {
      'rifle-alu': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: 0xff5a12, emissiveIntensity: 0.12 },
      'rifle-poly': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'rifle-steel': { color: 0x101114, roughness: 0.6, emissive: 0xff5a12, emissiveIntensity: 0.25 },
      'rifle-brass': { color: 0xf2b24c, roughness: 0.35, envMapIntensity: 1.3 },
      'lever-steel': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: 0xff5a12, emissiveIntensity: 0.16 },
      'lever-wood': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'lever-brass': { color: 0xf2b24c, roughness: 0.35, envMapIntensity: 1.3 },
    },
  },
} as const;

/** Authored GEAR order and source wording; the shared locker supplies live locked/worn state. */
export const FINISH_CARDS = [
  { id: 'hollow-ash', name: WEAPON_FINISHES['hollow-ash'].name, blurb: 'Crossbow', lockedBlurb: "Crossbow · Mott's stall", icon: 'crossbow' },
  { id: 'ghost-stag', name: WEAPON_FINISHES['ghost-stag'].name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Ghost Stag', icon: 'crossbow' },
  { id: 'blackpaw', name: WEAPON_FINISHES.blackpaw.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · Old Blackpaw', icon: 'crossbow' },
  { id: 'imperial', name: WEAPON_FINISHES.imperial.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Imperial Bull', icon: 'crossbow' },
  { id: 'warden', name: WEAPON_FINISHES.warden.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Antler King', icon: 'crossbow' },
  { id: 'ironhide', name: WEAPON_FINISHES.ironhide.name, blurb: 'Lever-action', lockedBlurb: 'Lever-action · Old Ironhide', icon: 'lever' },
  { id: 'scarback-furnace', name: WEAPON_FINISHES['scarback-furnace'].name, blurb: 'Lever-action', lockedBlurb: "Lever-action · Mott's stall", icon: 'lever' },
] as const;
