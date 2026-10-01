/** Every coordinate in Signal Dunes (metres; π yaw faces +Z, the compass north). */
export const SPAWN = { x: -45, z: -160, yaw: Math.atan2(-70, -145) };
export const TOWER = { x: 25, z: -15, yaw: 0.35 };
/** The tower's deck height above its pad, the stair's run and where the fire sits on the deck. */
export const DECK = { height: 5.4, half: 1.7, stairRun: 6.4, stairWidth: 1.2 };
export const RAY_HOME = { x: 0, z: -95 };
export const TRAIL: [number, number][][] = [[[SPAWN.x, SPAWN.z], [-30, -120], [0, -70], [TOWER.x, TOWER.z - 9]]];
/** Capture poses for the board (eye height above the feet is 1.6 m). */
export const POSES = {
  spawn: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0.02 },
  ray: { x: -20, z: -110, yaw: Math.PI, pitch: 0.25 },
  tower: { x: 18, z: -36, yaw: Math.PI * 1.1, pitch: 0.12 },
};
