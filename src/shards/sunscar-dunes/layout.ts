/** Every coordinate in Signal Dunes, in metres. The spawn faces −Z (yaw 0), towards the tower. */
export const SEED = 5363;
export const SPAWN = { x: 0, z: 70, yaw: 0 };
/** The wooden signal tower on the far crest, 145 m ahead of the spawn. */
export const TOWER = { x: 8, z: -75, deck: 7, half: 1.8 };
/** Where the dune ray first glides in. */
export const RAY_HOME = { x: -18, z: 30 };
/** The half-buried caravan, west of the spawn: the logbook lies on its tailboard. `yaw` turns the wagon's long axis. */
export const CARAVAN = { x: -78, z: 28, yaw: 0.55 };
/** The dry well in the east hollow: a stone ring, a windlass the whip can pull, an oil jar in its bucket. */
export const WELL = { x: 84, z: -6 };
/** The boss basin north of the tower: a sand bowl, flat for `floor` metres, its rim at `r`. */
export const BASIN = { x: -14, z: -150, floor: 26, r: 56 };
/** Three braziers on the way to the tower: oiled by hand, lit by a whip crack. */
export const BRAZIERS: readonly { x: number; z: number }[] = [{ x: 58, z: -34 }, { x: -44, z: -22 }, { x: 34, z: -102 }];
/** The crest top the tower stands on: levelled `lift` metres over its own dune height, eased over `r`. The spawn needs
 *  none: the dunes are phased so a crest runs through it (P2), and it looks down over the rows to the tower. */
export const CRESTS = [{ x: TOWER.x, z: TOWER.z, r: 20, lift: 7 }];
/** Small flat pads (metres): the caravan's and the well's ground, eased to the dune height at their centre. */
export const PADS = [{ x: CARAVAN.x, z: CARAVAN.z, r: 14 }, { x: WELL.x, z: WELL.z, r: 12 }];
/** The crest paths: spawn → tower (the first, the entry trail), spawn → caravan, spawn → well, tower → basin. */
export const TRAIL: [number, number][][] = [
  [[SPAWN.x, SPAWN.z], [4, 0], [TOWER.x, TOWER.z + 6]],
  [[SPAWN.x, SPAWN.z], [-36, 52], [CARAVAN.x + 8, CARAVAN.z + 4]],
  [[SPAWN.x, SPAWN.z], [44, 40], [WELL.x - 6, WELL.z + 4]],
  [[TOWER.x - 2, TOWER.z - 6], [BASIN.x + 8, BASIN.z + BASIN.r - 6]],
];
/** Wind-cut sandstone ridges (yardangs): long low rock spines along the north wind. `len` along `yaw`, `h` tall. */
export const RIDGES: readonly { x: number; z: number; yaw: number; len: number; h: number }[] = [
  { x: -40, z: 100, yaw: 0.15, len: 22, h: 3.2 }, { x: 46, z: 92, yaw: -0.1, len: 16, h: 2.4 },
  { x: -110, z: -30, yaw: 0.25, len: 30, h: 4.2 }, { x: -96, z: -60, yaw: 0.2, len: 18, h: 2.8 },
  { x: 120, z: 50, yaw: -0.2, len: 26, h: 3.6 }, { x: 128, z: -70, yaw: 0.05, len: 34, h: 4.8 },
  { x: -70, z: -118, yaw: 0.3, len: 22, h: 3.4 }, { x: 52, z: -150, yaw: -0.25, len: 28, h: 4 },
  { x: -150, z: 120, yaw: 0.1, len: 30, h: 4.4 }, { x: 150, z: 140, yaw: -0.15, len: 24, h: 3.6 },
];
/** Where the skitterer packs burrow, and the striders' grazing grounds. */
export const PACKS: readonly { x: number; z: number; n: number }[] = [{ x: -40, z: 40, n: 3 }, { x: 60, z: 10, n: 3 }, { x: -20, z: -40, n: 4 }];
export const STRIDERS: readonly { x: number; z: number }[] = [{ x: 100, z: -50 }, { x: -100, z: 0 }];
/** The playable square and the painted ground around it. */
export const PLAY_HALF = 200;
export const GROUND_HALF = 240;
