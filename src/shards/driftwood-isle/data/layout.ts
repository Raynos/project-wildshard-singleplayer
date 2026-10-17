/** Authored island sites; native config-derived and terrain laws stay in the manifest. */
/** the sand paths between the POIs (also `trails[4..]`): [pier → hut], [hut → lookout], [fork → wreck], [hut → shrine] */
export const PATHS: [number, number][][] = [

  [[0, -152], [-8, -145], [-18, -143], [-30, -142], [-30, -104], [-24, -80], [-20, -68]],

  [[-20, -68], [-8, -50], [14, -24], [17, 8], [15, 12], [16, 14], [32, 30], [34, 32], [46, 46], [86, 86], [88, 88]],
  [[17, 8], [60, 0], [100, -2], [140, 4]],

  [[-20, -68], [-52, -30], [-72, 20], [-88, 70], [-94, 88], [-87.5, 93.7], [-89.3, 96.1]],
];

/** the pier → hut path's sand bed as the terrain carves it (`trails`), the line it had before E308: the Blender spawn cove
 *  is baked from these heights (blenderArea.ts), so re-cutting the bed along PATHS[0] would lift or sink the cove's
 *  ground by up to 0.35 m at the pier's foot until the cove is re-baked */
export const PIER_PATH_BED: [number, number][] = [[0, -188], [-8, -172], [-30, -142], [-30, -104], [-24, -80], [-20, -68]];

/** the island disc: centre and nominal shoreline radius (the shoreline is noise-warped ±30 m) */
export const ISLAND = { x: 0, z: 12, r: 188 };

/** the hut's plateau: a flat-topped crag in the south-centre; the hut stands at its middle */
export const PLATEAU = { x: -24, z: -62, r: 46, h: 13 };

/** the north-east massif: a tall craggy headland (a broad shoulder + a high top) with the lookout on its summit */
export const HEADLAND = { x: 98, z: 96, r: 48, h: 22, shoulderR: 80, shoulderH: 9 };

/** Wreck Cove: a bay bitten out of the east shore; the wreck lies half sunk on the reef at its mouth, bow run up the sand, heeled toward the beach (Wreck.ts) */
export const COVE = { ang: -0.02, depth: 46, width: 0.5 };

/** the tidal creek across the hut → lookout path (a ravine cut below sea level, so the lagoon runs into it) and the rope bridge over it */
export const GULLY = { x: 24, z: 22, width: 11, depth: 7, length: 64 };

/** E308 (Jake's pick B, art/onboarding/round-1-first-minutes/board-3-start-length.jpg): half way down the pier (it runs
 *  ~100 m, sea end z −250 → the landing on the sand z ≈ −152), facing north up it, so the first frame is still the island
 *  from the sea: 38 s walking / 22 s sprinting to Wendell, was 49 / 27 from 15 m in */

export const SPAWN = { x: 0, y: 1.2, z: -194, yaw: Math.PI };

/** E308: moored beside the south pier, nine metres behind the player's start. */
export const BOAT_MOOR = { x: -4.2, z: SPAWN.z - 9 };

/** metres from the pier's sea end to the piling that flies the pennant (E111; E308 moved it from the sea-end bollard to
 *  half way down, just past the boat's bow — Jake: "also the flag on the pier also halfway down") */
export const PIER_PENNANT_AT = 43.2;

/** the practice crab (E308, Jake's pick A, board-2-practice-target.jpg): one lone small reef crab on the sand path at the
 *  pier's foot, where the landing's fenced corridor turns for the plateau ramp — the first enemy a new player meets */
export const PRACTICE_CRAB = { x: -7, z: -143 };
