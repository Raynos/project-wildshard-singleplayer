/** Every coordinate of Signal Dunes (metres, chunk space; yaw 0 faces -z). */
export const SPAWN = { x: 0, z: 70, yaw: 0 };
/** The far dune crest and the wooden signal tower on it. */
export const CREST = { x: 12, z: -78, r: 34, h: 20 };
export const TOWER = { x: 12, z: -78 };
/** Where the dune ray first circles. */
export const RAY = { x: -10, z: 10, altitude: 16 };
export const BOUNDS = { x0: -125, x1: 125, z0: -125, z1: 125, floor: -10 };
/** The painted ground: the playable dunes plus a ring of far dunes under the fog. */
export const GROUND = { size: 420, segments: 168 };
export const TRAIL: [number, number][][] = [[[0, 70], [-8, 40], [-4, 5], [6, -30], [6, -52], [12, -70]]];
