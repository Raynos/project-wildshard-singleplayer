/** Every coordinate in Sky Reach. Islands are discs: centre, walkable top height, radius. North is −z. */
export type IsleId = 'sunrest' | 'mill' | 'fernhold' | 'roost' | 'tern';
export interface Isle { id: IsleId; x: number; z: number; top: number; r: number; depth: number }
export const SUNREST: Isle = { id: 'sunrest', x: 0, z: 0, top: 20, r: 13, depth: 22 };
export const MILL: Isle = { id: 'mill', x: 0, z: -46, top: 23, r: 12, depth: 20 };
export const FERNHOLD: Isle = { id: 'fernhold', x: -41, z: 8, top: 19, r: 10, depth: 17 };
export const ROOST: Isle = { id: 'roost', x: 43, z: -8, top: 20, r: 10, depth: 18 };
export const TERN: Isle = { id: 'tern', x: 9, z: 45, top: 17, r: 9, depth: 15 };
export const ISLES: readonly Isle[] = [SUNREST, MILL, FERNHOLD, ROOST, TERN];

/** Rope bridges are walked; hover bridges carry only a board rider; the fallen bridge is raised by the quest. */
export interface Span { id: string; from: Isle; to: Isle; width: number }
export const ROPE: readonly Span[] = [{ id: 'rope.fernhold', from: SUNREST, to: FERNHOLD, width: 2.4 }];
export const HOVER: readonly Span[] = [{ id: 'hover.roost', from: SUNREST, to: ROOST, width: 3.2 }, { id: 'hover.tern', from: SUNREST, to: TERN, width: 3.2 }];
export const FALLEN: Span = { id: 'rope.mill', from: SUNREST, to: MILL, width: 2.4 };

export const WINCH = { x: -3.2, z: -10.2 };
export const WINDMILL = { x: 1.5, z: -48 };
/** The drift ray circles above the gap between Sunrest and the roost, at an absolute height. */
export const RAY = { x: 20, z: -16, radius: 18, altitude: 34 };
export const SPAWN = { x: 0, z: 5, yaw: 0 };
/** The one trail: from the spawn to the winch at the fallen bridge (B83: a trail starts in the spawn area). */
export const TRAIL: [number, number][][] = [[[SPAWN.x, SPAWN.z], [0, -4], [WINCH.x, WINCH.z]]];
/** The cloud sea's surface; the terrain datum hides just under it; creatures die below KILL_Y; the player soft-respawns below FLOOR_Y. */
export const CLOUD_Y = 0;
export const DATUM_Y = -8;
export const KILL_Y = -40;
export const FLOOR_Y = 6;
export const BOUNDS = { x0: -140, x1: 140, z0: -140, z1: 140 };
/** Far scenery islands (no collision): x, z, top, radius. */
export const FAR_ISLES: readonly [number, number, number, number][] = [
  [-150, -170, 40, 22], [120, -210, 55, 30], [230, -40, 30, 18], [-240, 20, 46, 26], [-120, 210, 25, 16], [160, 180, 38, 24],
  [40, -300, 70, 36], [-60, -120, 8, 8], [95, 70, 6, 6], [-300, -150, 60, 34], [300, 140, 52, 28], [-20, 260, 42, 20],
];
