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

/** Authored GEAR order and source wording; the shared locker supplies live locked/worn state. */
export const FINISH_CARDS = [
  { id: 'hollow-ash', name: 'Hollow Ash', blurb: 'Crossbow', lockedBlurb: "Crossbow · Mott's stall", icon: 'crossbow' },
  { id: 'ghost-stag', name: 'Ghost Stag', blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Ghost Stag', icon: 'crossbow' },
  { id: 'blackpaw', name: 'Blackpaw', blurb: 'Crossbow', lockedBlurb: 'Crossbow · Old Blackpaw', icon: 'crossbow' },
  { id: 'imperial', name: 'Imperial', blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Imperial Bull', icon: 'crossbow' },
  { id: 'warden', name: 'Warden', blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Antler King', icon: 'crossbow' },
  { id: 'ironhide', name: 'Ironhide', blurb: 'Lever-action', lockedBlurb: 'Lever-action · Old Ironhide', icon: 'lever' },
  { id: 'scarback-furnace', name: 'Scarback Furnace', blurb: 'Lever-action', lockedBlurb: "Lever-action · Mott's stall", icon: 'lever' },
] as const;

/** Held knife recipe mirror, including its existing playback programme (data/skinningKnifeLook.ts). */
export const KNIFE_LOOK = {
  name: 'skin-knife',
  standIn: { roughness: 0.55, metalness: 0.25 }, envMapIntensity: 0.9, anisotropy: 8, loadDelayMs: 600, renderOrder: 1000,
  playback: [{"id":"knife.beat","reads":["beatTime","aspect","length","kneelIn","rise","cut.0","cut.1"],"nodes":[{"op":"read","index":0},{"op":"read","index":1},{"op":"read","index":2},{"op":"read","index":3},{"op":"read","index":4},{"op":"read","index":5},{"op":"read","index":6},{"op":"constant","value":0},{"op":"constant","value":1},{"op":"div","a":0,"b":3},{"op":"sample","a":9,"interpolation":"smoothstep","keys":[[0,0],[1,1]]},{"op":"sub","a":0,"b":4},{"op":"sub","a":2,"b":4},{"op":"div","a":11,"b":12},{"op":"sample","a":13,"interpolation":"smoothstep","keys":[[0,0],[1,1]]},{"op":"sub","a":8,"b":14},{"op":"mul","a":10,"b":15},{"op":"sub","a":8,"b":1},{"op":"constant","value":1.6},{"op":"mul","a":17,"b":18},{"op":"min","a":8,"b":19},{"op":"max","a":7,"b":20},{"op":"constant","value":0.16},{"op":"sub","a":5,"b":22},{"op":"sub","a":0,"b":23},{"op":"sample","a":24,"interpolation":"smoothstep","keys":[[0,0],[0.12,1],[0.24,0]]},{"op":"sample","a":24,"interpolation":"smoothstep","keys":[[0.1,0],[0.24000000000000002,1],[0.3,1],[0.42,0]]},{"op":"sub","a":6,"b":22},{"op":"sub","a":0,"b":27},{"op":"sample","a":28,"interpolation":"smoothstep","keys":[[0,0],[0.12,1],[0.24,0]]},{"op":"sample","a":28,"interpolation":"smoothstep","keys":[[0.1,0],[0.24000000000000002,1],[0.3,1],[0.42,0]]},{"op":"constant","value":0.2},{"op":"constant","value":-0.09000000000000001},{"op":"mul","a":32,"b":16},{"op":"add","a":31,"b":33},{"op":"constant","value":-0.075},{"op":"mul","a":21,"b":35},{"op":"add","a":34,"b":36},{"op":"constant","value":0.03},{"op":"mul","a":38,"b":25},{"op":"constant","value":-0.075},{"op":"mul","a":40,"b":26},{"op":"add","a":39,"b":41},{"op":"add","a":37,"b":42},{"op":"constant","value":0.03},{"op":"mul","a":44,"b":29},{"op":"constant","value":-0.03},{"op":"mul","a":46,"b":30},{"op":"add","a":45,"b":47},{"op":"add","a":43,"b":48},{"op":"constant","value":-0.46},{"op":"constant","value":0.34500000000000003},{"op":"mul","a":51,"b":16},{"op":"add","a":50,"b":52},{"op":"constant","value":0.04},{"op":"mul","a":21,"b":54},{"op":"add","a":53,"b":55},{"op":"constant","value":0.035},{"op":"mul","a":57,"b":25},{"op":"constant","value":-0.055},{"op":"mul","a":59,"b":26},{"op":"add","a":58,"b":60},{"op":"add","a":56,"b":61},{"op":"constant","value":0.035},{"op":"mul","a":63,"b":29},{"op":"constant","value":-0.05},{"op":"mul","a":65,"b":30},{"op":"add","a":64,"b":66},{"op":"add","a":62,"b":67},{"op":"constant","value":-0.3},{"op":"constant","value":-0.030000000000000027},{"op":"mul","a":70,"b":16},{"op":"add","a":69,"b":71},{"op":"constant","value":0.02},{"op":"mul","a":73,"b":25},{"op":"constant","value":-0.02},{"op":"mul","a":75,"b":26},{"op":"add","a":74,"b":76},{"op":"add","a":72,"b":77},{"op":"constant","value":0.02},{"op":"mul","a":79,"b":29},{"op":"constant","value":0.06},{"op":"mul","a":81,"b":30},{"op":"add","a":80,"b":82},{"op":"add","a":78,"b":83},{"op":"constant","value":-0.3},{"op":"sub","a":8,"b":16},{"op":"constant","value":0.5},{"op":"mul","a":86,"b":87},{"op":"add","a":85,"b":88},{"op":"constant","value":-0.16},{"op":"mul","a":90,"b":26},{"op":"constant","value":0.1},{"op":"mul","a":92,"b":25},{"op":"add","a":93,"b":91},{"op":"add","a":89,"b":94},{"op":"constant","value":-0.16},{"op":"mul","a":96,"b":30},{"op":"constant","value":0.1},{"op":"mul","a":98,"b":29},{"op":"add","a":99,"b":97},{"op":"add","a":95,"b":100},{"op":"constant","value":0.95},{"op":"constant","value":0.22},{"op":"mul","a":103,"b":26},{"op":"add","a":102,"b":104},{"op":"constant","value":-0.14},{"op":"mul","a":106,"b":30},{"op":"add","a":105,"b":107},{"op":"constant","value":-0.45},{"op":"constant","value":-0.12},{"op":"mul","a":110,"b":26},{"op":"add","a":109,"b":111},{"op":"constant","value":0.1},{"op":"mul","a":113,"b":30},{"op":"add","a":112,"b":114},{"op":"gt","a":7,"b":0},{"op":"select","test":116,"yes":7,"no":8},{"op":"gt","a":2,"b":0},{"op":"mul","a":117,"b":118}],"bindings":[{"property":"x","target":"pivot"},{"property":"y","target":"pivot"},{"property":"z","target":"pivot"},{"property":"pitch","target":"pivot","order":"YXZ"},{"property":"yaw","target":"pivot","order":"YXZ"},{"property":"roll","target":"pivot","order":"YXZ"},{"property":"visible","target":"root"}],"channels":[{"property":"x","value":49},{"property":"y","value":68},{"property":"z","value":84},{"property":"pitch","value":101},{"property":"yaw","value":108},{"property":"roll","value":115},{"property":"visible","value":119}]}],
  parts: [
    {
      kind: 'extrude', args: [], paint: '#c9ccd0',
      shape: [['moveTo', 0, 0.012], ['lineTo', 0.075, 0.012], ['quadraticCurveTo', 0.098, 0.009, 0.105, 0.0], ['quadraticCurveTo', 0.085, -0.014, 0.05, -0.016], ['lineTo', 0, -0.014], ['lineTo', 0, 0.012]],
      extrude: { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 1, curveSegments: 8 },
      ops: [['translate', 0, 0, -0.0015], ['rotateY', 1.5707963267948966], ['translate', 0, 0.004, -0.062]],
    },
    { kind: 'box', args: [0.012, 0.036, 0.006], ops: [['translate', 0, 0, -0.06]], paint: '#b08a4a' },
    { kind: 'cylinder', args: [0.0125, 0.014, 0.11, 12], ops: [['rotateX', 1.5707963267948966], ['translate', 0, 0, -0.005]], paint: '#5a3a24' },
    { kind: 'sphere', args: [1, 14, 10], ops: [['scale', 0.034, 0.038, 0.05], ['translate', 0.004, -0.006, 0.0]], paint: '#8a6644' },
    { kind: 'capsule', args: [0.009, 0.03, 4, 8], ops: [['rotateX', 1.5707963267948966], ['translate', -0.012, 0.024, -0.02]], paint: '#8a6644' },
    { kind: 'cylinder', args: [0.028, 0.032, 0.07, 12], ops: [['rotateX', 1.2207963267948965], ['translate', 0.01, -0.02, 0.07]], paint: '#7d5c3d' },
    { kind: 'cylinder', args: [0.042, 0.046, 0.12, 14, 1, 1], ops: [['rotateX', 1.2207963267948965], ['translate', 0.014, -0.042, 0.15]], paint: '#2b2f33' },
  ],
} as const;

/** Crossbow display rest transforms (data/crossbowDisplay.json); order and every component stay exact. */
export const CROSSBOW_DISPLAY_REST = [{"part":"left cord","child":4,"material":"xbow-cord","position":[-0.335,0.004,-0.205],"quaternion":[0.2613569905058314,0,-0.6485525319959521,0.714893094633998],"scale":[1,0.36126721412273216,1]},{"part":"right cord","child":5,"material":"xbow-cord","position":[0.335,0.004,-0.205],"quaternion":[0.2613569905058314,0,0.6485525319959521,0.714893094633998],"scale":[1,0.36126721412273216,1]},{"part":"serving","child":6,"material":"xbow-cord","position":[0,0.012,-0.07],"quaternion":[0,0,0,1],"scale":[1,1,1]}];

/** The waterfall spray bake (data/sprayPuffs.json), kept verbatim as finite numeric rows. */
export const SPRAY_PUFFS = {"notice":"DO NOT EDIT: generated by generators/bake-pine-spray.mjs","at":[-86.28898661511963,5.455964300247271,154.17621415808597,-88.37385907376913,5.455964300247271,154.98676997474735,-87.3839878349923,5.455964300247271,152.98081662748297,-86.75896503768092,5.455964300247271,155.12861559470494,-88.67061204207258,5.455964300247271,153.9670220206184,-89.12191267013466,-2.7,138.9525002365585,-90.44631824807016,-2.7,140.75517707001816,-90.68735172550728,-2.7,138.53130729786122,-89.0074730045774,-2.7,140.0083656527429,-91.2439035505106,-2.7,140.05388832814495,-89.62552261180926,-2.7,138.50969370375108],"seed":[0,2.6,-0.5,0.8,0.618034,3.0587612800000006,-0.3480266000000003,1.1935136800000004,0.23606799999999994,3.99752256,-0.29605320000000046,1.06702736,0.8541019999999999,2.8562838399999997,-0.14407980000000098,1.0605410399999997,0.4721359999999999,3.7950451199999997,-0.09210640000000092,0.9340547199999997,0.09016999999999964,3.133806399999998,-0.04013300000000186,0.8075683999999984,0.7082039999999998,3.5925676799999993,0.11184039999999884,0.8010820799999998,0.32623800000000003,2.93132896,0.1638138,1.0745957600000002,0.9442719999999998,3.3900902399999993,0.31578719999999816,1.0681094399999993,0.5623059999999995,2.728851519999997,0.36776059999999733,0.9416231199999981,0.18033999999999928,3.667612799999996,0.4197339999999963,0.8151367999999968],"size":[3.6,3.6,3.5,4.7124612,4.52096676,3.5,4.0249223999999995,4.90193352,3.5,5.1373836,4.022900279999999,3.5,4.4498448,4.403867039999999,3.5,4.598374,5.848130199999994,3,5.9580488,4.773756239999996,3,5.117723600000001,5.23938228,3,6.4773984,6.365008319999997,3,5.6370732,4.630634359999992,3,4.796747999999999,5.096260399999989,3]} as const;
