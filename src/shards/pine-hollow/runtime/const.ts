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
/** the cave mouth's frame (data/layout.ts BEAR_CAVE) */
export const BEAR_CAVE = { x: 200, z: 200, rot: 0.7853981633974483 };
/** the Explorer names (data/wardensHollow.ts dialogue names), without loading quest dialogue */
export const NPC_NAMES = { ranger: 'Hale, ranger of the Hollow', miller: 'Brandt, the miller', trader: 'Mott, the trader' };
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


/** The waterfall spray bake (data/sprayPuffs.json), kept verbatim as finite numeric rows. */
export const SPRAY_PUFFS = {"notice":"DO NOT EDIT: generated by generators/bake-pine-spray.mjs","at":[-86.28898661511963,5.455964300247271,154.17621415808597,-88.37385907376913,5.455964300247271,154.98676997474735,-87.3839878349923,5.455964300247271,152.98081662748297,-86.75896503768092,5.455964300247271,155.12861559470494,-88.67061204207258,5.455964300247271,153.9670220206184,-89.12191267013466,-2.7,138.9525002365585,-90.44631824807016,-2.7,140.75517707001816,-90.68735172550728,-2.7,138.53130729786122,-89.0074730045774,-2.7,140.0083656527429,-91.2439035505106,-2.7,140.05388832814495,-89.62552261180926,-2.7,138.50969370375108],"seed":[0,2.6,-0.5,0.8,0.618034,3.0587612800000006,-0.3480266000000003,1.1935136800000004,0.23606799999999994,3.99752256,-0.29605320000000046,1.06702736,0.8541019999999999,2.8562838399999997,-0.14407980000000098,1.0605410399999997,0.4721359999999999,3.7950451199999997,-0.09210640000000092,0.9340547199999997,0.09016999999999964,3.133806399999998,-0.04013300000000186,0.8075683999999984,0.7082039999999998,3.5925676799999993,0.11184039999999884,0.8010820799999998,0.32623800000000003,2.93132896,0.1638138,1.0745957600000002,0.9442719999999998,3.3900902399999993,0.31578719999999816,1.0681094399999993,0.5623059999999995,2.728851519999997,0.36776059999999733,0.9416231199999981,0.18033999999999928,3.667612799999996,0.4197339999999963,0.8151367999999968],"size":[3.6,3.6,3.5,4.7124612,4.52096676,3.5,4.0249223999999995,4.90193352,3.5,5.1373836,4.022900279999999,3.5,4.4498448,4.403867039999999,3.5,4.598374,5.848130199999994,3,5.9580488,4.773756239999996,3,5.117723600000001,5.23938228,3,6.4773984,6.365008319999997,3,5.6370732,4.630634359999992,3,4.796747999999999,5.096260399999989,3]} as const;
