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
