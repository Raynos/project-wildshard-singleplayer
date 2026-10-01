/** Every Signal Dunes coordinate, in metres (origin at the slab centre; the player faces −Z at yaw 0). */
export const SPAWN = { x: 0, z: 46, yaw: 0 };
/** The wooden signal tower on the far crest; its stair climbs the south face to the deck. */
export const TOWER = { x: 8, z: -78, deck: 6, half: 2.2 };
/** The brazier on the deck: the quest's interact point. */
export const FIRE = { x: TOWER.x, z: TOWER.z - 0.6 };
/** Where the dune ray circles before it notices the player. */
export const RAY_HOME = { x: -6, z: 4, radius: 22 };
/** The one road: spawn crest → the tower's foot (a new shard's trail starts in the spawn area). */
export const TRAIL: [number, number][][] = [[[SPAWN.x, SPAWN.z], [4, 0], [7, -40], [TOWER.x, TOWER.z + 12]]];
/** The slab's soft-respawn box. */
export const BOUNDS = { x0: -240, x1: 240, z0: -240, z1: 240, floor: -20 };
