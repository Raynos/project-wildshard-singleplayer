/** Every coordinate in Signal Dunes, in metres. The spawn faces −Z (yaw 0), towards the tower. */
export const SEED = 5363;
export const SPAWN = { x: 0, z: 70, yaw: 0 };
/** The wooden signal tower on the far crest, 145 m ahead of the spawn. */
export const TOWER = { x: 8, z: -75, deck: 7, half: 1.8 };
/** Where the dune ray first glides in. */
export const RAY_HOME = { x: -18, z: 30 };
/** The crests the spawn and the tower sit on: a raised pad of `r` metres. */
export const CRESTS = [{ x: SPAWN.x, z: SPAWN.z, r: 26, lift: 1.5 }, { x: TOWER.x, z: TOWER.z, r: 28, lift: 2 }];
/** The crest path from the spawn to the tower. */
export const TRAIL: [number, number][][] = [[[SPAWN.x, SPAWN.z], [4, 0], [TOWER.x, TOWER.z + 6]]];
/** The playable square and the painted ground around it. */
export const PLAY_HALF = 150;
export const GROUND_HALF = 240;
