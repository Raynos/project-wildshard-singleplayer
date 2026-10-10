// SHARD-PLATFORM M3 (look-family rows): Wendell the castaway as data (npc/Castaway.ts builds him): his low-poly kit meshes
// (@wildshard/sdk/kit/kitParts: body, campfire, code head, waving arm, flames) and the smoke over his campfire
// (@wildshard/sdk/looks/smokeColumn: the breadcrumb the intro objective points at, seen from the pier). The palette:
// skin '#c98d62', beard '#cfcac0', straw hat '#d8b867', striped shirt '#e9e3d4' / '#3d6fae', canvas trousers '#b59f77'.
import type { KitMeshRow } from '@wildshard/sdk/kit/kitParts';
import type { SmokeColumnRow } from '@wildshard/sdk/looks/smokeColumn';

/**
 * 42 puffs climbing 21 m over 13 s each (life speeds 0.85–1.15: uneven spacing, a broken column), from 1.2 m over the
 * fire, leaning 5 m downwind by the top along the trade wind off the sea (0.8, 0.55, NPC-local); 0.9–5.3 m puffs, in over
 * the first 8 % of a life, out over the last 45 %; 0.12 opacity close, 0.58 from 30 m; still past 260 m (the whole island).
 */
export const CASTAWAY_SMOKE: SmokeColumnRow = {
  count: 42,
  rise: 21,
  life: 13,
  rate: [0.85, 0.3],
  seedSpread: 10,
  reseed: 1.37,
  seed: 0x5e0c,
  ease: 0.9,
  linear: 0.1,
  base: 1.2,
  lean: 5,
  wind: [0.8, 0.55],
  wanderX: [8, 5, 0.2, 1.1],
  wanderZ: [6.3, 3, 0.2, 0.9],
  size: [0.9, 4.4],
  fadeIn: 0.08,
  fadeOut: 0.45,
  fadePow: 1.3,
  thin: [0.45, 0.55, 7.7],
  color: [0.8, 0.79, 0.77],
  startOpacity: 0.42,
  opacity: [0.12, 0.46],
  opacityFrom: 8,
  opacityTo: 30,
  far: 260,
  bounds: { offset: [2, 9, 1.5], radius: 14 },
  renderOrder: 4,
  name: 'castaway-smoke',
  patch: { id: 'driftwood.castaway-smoke', key: 'castaway-smoke-v2' },
};

/** Wendell's body (turns with the figure): bare feet, rolled trousers, the rope belt and its knot, the striped shirt's bands (a little barrel-chested), the neck, the left arm hanging on the driftwood staff. */
export const CASTAWAY_BODY: KitMeshRow = {
  seed: 0xca57a,
  ao: {"floorY":0,"strength":0.45},
  parts: [
    {"kind":"box","args":[0.11,0.07,0.24],"color":"#c98d62","at":[-0.1,0.035,0.04],"wobble":0.01},
    {"kind":"log","args":[-0.1,0.06,0,-0.1,0.42,0.01,0.05,0.055,6],"color":"#c98d62"},
    {"kind":"log","args":[-0.1,0.4,0.01,-0.1,0.5,0.01,0.085,0.085,7],"color":"#8f7b58"},
    {"kind":"log","args":[-0.1,0.48,0.01,-0.11,0.98,0,0.075,0.095,7],"color":"#b59f77"},
    {"kind":"box","args":[0.11,0.07,0.24],"color":"#c98d62","at":[0.1,0.035,0.04],"wobble":0.01},
    {"kind":"log","args":[0.1,0.06,0,0.1,0.42,0.01,0.05,0.055,6],"color":"#c98d62"},
    {"kind":"log","args":[0.1,0.4,0.01,0.1,0.5,0.01,0.085,0.085,7],"color":"#8f7b58"},
    {"kind":"log","args":[0.1,0.48,0.01,0.11,0.98,0,0.075,0.095,7],"color":"#b59f77"},
    {"kind":"log","args":[0,0.9,0,0,1.02,0,0.19,0.19,8],"color":"#b59f77"},
    {"kind":"torus","args":[0.19,0.022,4,10],"color":"#b9a57a","pre":[["rotateX",1.5707963267948966]],"at":[0,1.02,0]},
    {"kind":"log","args":[0.12,1,0.17,0.14,0.86,0.19,0.018,0.012,4],"color":"#b9a57a"},
    {"kind":"log","args":[0,1.02,0,0,1.095,0,0.19,0.2075,8],"color":"#e9e3d4","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.095,0,0,1.17,0,0.2075,0.22031088913245536,8],"color":"#3d6fae","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.17,0,0,1.2449999999999999,0,0.22031088913245536,0.225,8],"color":"#e9e3d4","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.245,0,0,1.32,0,0.225,0.22031088913245536,8],"color":"#3d6fae","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.32,0,0,1.395,0,0.22031088913245536,0.2075,8],"color":"#e9e3d4","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.395,0,0,1.47,0,0.2075,0.15,8],"color":"#3d6fae","at":[0,0,0,0,0,0,1,1,0.72],"jitter":0.04},
    {"kind":"log","args":[0,1.47,0,0,1.55,0.01,0.07,0.06,6],"color":"#c98d62"},
    {"kind":"log","args":[0.21,1.42,0,0.25,1.15,0.05,0.058,0.05,6],"color":"#e9e3d4"},
    {"kind":"log","args":[0.25,1.15,0.05,0.27,0.93,0.14,0.045,0.04,6],"color":"#c98d62"},
    {"kind":"icosa","args":[0.05,0],"color":"#c98d62","at":[0.27,0.9,0.16]},
    {"kind":"log","args":[0.3,0,0.2,0.26,1.35,0.14,0.03,0.028,5,0.3],"color":"#9a7b58","wobble":0.008},
    {"kind":"rock","args":[0.06,0,1,0.3],"color":"#9a7b58","at":[0.26,1.37,0.14]},
  ],
};

/** The campfire, off the fire's centre (it stays put while he turns): a ring of nine stones, the char, four crossed logs, a log seat and a stick propped over the fire. */
export const CASTAWAY_CAMP: KitMeshRow = {
  seed: 0xca57e,
  ao: {"floorY":0,"strength":0.45},
  parts: [
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#5d5f64","at":[0.55,0.06,0],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#7d7f84","at":[0.4213244437154379,0.06,0.35353318532759664],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#5d5f64","at":[0.09550649771681173,0.06,0.5416442641567144],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#7d7f84","at":[-0.2749999999999999,0.06,0.47631397208144133],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#5d5f64","at":[-0.5168309414322496,0.06,0.1881110788291179],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#7d7f84","at":[-0.5168309414322497,0.06,-0.1881110788291178],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#5d5f64","at":[-0.27500000000000024,0.06,-0.4763139720814412],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#7d7f84","at":[0.0955064977168115,0.06,-0.5416442641567145],"rel":true},
    {"kind":"rock","args":[0.16,0,0.7,0.3],"color":"#5d5f64","at":[0.4213244437154378,0.06,-0.3535331853275968],"rel":true},
    {"kind":"cylinder","args":[0.42,0.45,0.04,9],"color":"#2a2320","at":[0,0.02,0],"rel":true},
    {"kind":"log","args":[0.4012413254327545,0.05,0.1241184867977626,-0.09553364891256061,0.3,-0.029552020666133955,0.05,0.04,5],"color":"#6a4a2e","rel":true},
    {"kind":"log","args":[0.19595543842046811,0.05,0.37148548579109,-0.04665605676677813,0.3,-0.08844892518835476,0.05,0.04,5],"color":"#6a4a2e","rel":true},
    {"kind":"log","args":[-0.1241184867977626,0.05,0.4012413254327545,0.029552020666133955,0.3,-0.09553364891256061,0.05,0.04,5],"color":"#6a4a2e","rel":true},
    {"kind":"log","args":[-0.3714854857910899,0.05,0.19595543842046823,0.08844892518835475,0.3,-0.046656056766778156,0.05,0.04,5],"color":"#6a4a2e","rel":true},
    {"kind":"log","args":[-1.1,0.16,0.6,-1.1,0.16,-0.7,0.17,0.16,7],"color":"#6a4a2e","rel":true},
    {"kind":"plank","args":[0.9,0.05,0.03],"color":"#9a7b58","at":[0.3,0.4,-0.35,0.6,0,0.5],"rel":true},
  ],
};

/** The code head (pivot at the neck; the generated head replaces it once loaded): face, nose, eyes, bushy brows, the beard hanging from the jaw, the moustache, the straw hat tipped back. */
export const CASTAWAY_HEAD: KitMeshRow = {
  seed: 0xca57b,
  ao: false,
  parts: [
    {"kind":"icosa","args":[0.115,1],"color":"#c98d62","at":[0,0.11,0,0,0,0,0.92,1.05,0.95],"wobble":0.006},
    {"kind":"cone","args":[0.03,0.07,4],"color":"#a8704a","pre":[["rotateX",1.5707963267948966]],"at":[0,0.1,0.12]},
    {"kind":"box","args":[0.028,0.02,0.01],"color":"#1d1a18","at":[-0.042,0.135,0.108]},
    {"kind":"box","args":[0.028,0.02,0.01],"color":"#1d1a18","at":[0.042,0.135,0.108]},
    {"kind":"box","args":[0.05,0.016,0.02],"color":"#a9a39a","at":[-0.042,0.162,0.105,0,0,-0.15]},
    {"kind":"box","args":[0.05,0.016,0.02],"color":"#a9a39a","at":[0.042,0.162,0.105,0,0,0.15]},
    {"kind":"cone","args":[0.1,0.26,7],"color":"#cfcac0","pre":[["rotateX",3.141592653589793]],"at":[0,-0.06,0.075,0,-0.3],"wobble":0.012,"jitter":0.12},
    {"kind":"box","args":[0.16,0.035,0.03],"color":"#cfcac0","at":[0,0.075,0.115]},
    {"kind":"cylinder","args":[0.3,0.32,0.025,10],"color":"#d8b867","at":[0,0.2,0,0,0.08],"wobble":0.02,"jitter":0.1},
    {"kind":"cylinder","args":[0.1,0.13,0.13,8],"color":"#b8964a","at":[0,0.27,-0.01,0,0.08],"wobble":0.01},
    {"kind":"cylinder","args":[0.132,0.132,0.03,8],"color":"#7a3b2a","at":[0,0.225,-0.005,0,0.08]},
  ],
};

/** The waving right arm (pivot at the shoulder, hanging along −Y): sleeve, forearm, hand. */
export const CASTAWAY_ARM: KitMeshRow = {
  seed: 0xca57c,
  ao: false,
  parts: [
    {"kind":"log","args":[0,0,0,-0.03,-0.27,0.02,0.058,0.05,6],"color":"#e9e3d4"},
    {"kind":"log","args":[-0.03,-0.27,0.02,-0.04,-0.5,0.04,0.045,0.04,6],"color":"#c98d62"},
    {"kind":"icosa","args":[0.05,0],"color":"#c98d62","at":[-0.04,-0.55,0.04]},
  ],
};

/** The flames (unlit, bloom): an ember cone, two flame tongues, a bright core. */
export const CASTAWAY_FLAMES: KitMeshRow = {
  seed: 0xca57d,
  ao: false,
  parts: [
    {"kind":"cone","args":[0.26,0.7,6],"color":"#ff7a2a","at":[0,0.35,0],"wobble":0.03,"jitter":0.12},
    {"kind":"cone","args":[0.15,0.55,5],"color":"#ffc15a","at":[0.08,0.3,0.04,0.4],"wobble":0.02},
    {"kind":"cone","args":[0.13,0.5,5],"color":"#ffc15a","at":[-0.09,0.27,-0.05,1.2],"wobble":0.02},
    {"kind":"cone","args":[0.08,0.6,5],"color":"#fff0b0","at":[0,0.32,0],"wobble":0.01},
  ],
};
