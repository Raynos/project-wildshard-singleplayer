/** Every coordinate in Sky Reach. Islands float over the cloud sea; their walkable tops sit at `DECK`. */
export const DECK = 30;
/** How far a hover deck's collider starts clear of an island rim (Jake: a hover deck never touches a rim). */
export const HOVER_GAP = 0.6;
/** An island: centre, rim radius (the 12-gon's corner radius) and the depth of its rock keel. */
export interface Isle { readonly id: string; readonly x: number; readonly z: number; readonly r: number; readonly keel: number }
export const SUNREST: Isle = { id: 'sunrest', x: 0, z: 0, r: 17, keel: 22 };
export const WINDMILL: Isle = { id: 'windmill', x: 0, z: -64, r: 16, keel: 26 };
export const ROOST: Isle = { id: 'roost', x: 62, z: -4, r: 13, keel: 18 };
export const GROVE: Isle = { id: 'grove', x: -56, z: -4, r: 12, keel: 16 };
export const ISLES: readonly Isle[] = [SUNREST, WINDMILL, ROOST, GROVE];
/** The apothem of an island's 12-gon top: where the rim edge is nearest the centre. */
export const apothem = (isle: Isle): number => isle.r * Math.cos(Math.PI / 12);

/** A straight bridge between two points on the deck, along one axis. */
export interface Span { readonly id: string; readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number; readonly width: number }
/** Rope bridge, Sunrest → Grove (walkable on foot): it overlaps both rims by a metre. */
export const ROPE_BRIDGE: Span = { id: 'far.rope.grove', x0: -apothem(SUNREST) + 1, z0: -4, x1: GROVE.x + apothem(GROVE) - 1, z1: -4, width: 2.4 };
/** Hover bridge, Sunrest → Roost: board only, starting `HOVER_GAP` clear of each rim. */
export const HOVER_BRIDGE: Span = { id: 'far.hover.roost', x0: apothem(SUNREST) + HOVER_GAP, z0: -4, x1: ROOST.x - apothem(ROOST) - HOVER_GAP, z1: -4, width: 3 };
/** The fallen bridge, Sunrest → the windmill isle; it hangs from its pivot on Sunrest's north rim until the winch raises it. */
export const FALLEN_BRIDGE: Span = { id: 'far.bridge.windmill', x0: 0, z0: -apothem(SUNREST) + 0.6, x1: 0, z1: WINDMILL.z + apothem(WINDMILL) - 1, width: 2.6 };
export const WINCH = { x: 3.2, z: -apothem(SUNREST) + 2.2 };
export const MILL = { x: 2, z: WINDMILL.z - 3 };

export const SPAWN = { x: 0, z: 7, yaw: 0 };
/** The one trail (E357 B83: it starts in the spawn area): Sunrest's path from the spawn to the fallen bridge's pivot. */
export const TRAIL: [number, number][][] = [[[SPAWN.x, SPAWN.z], [0, -13]]];
/** The stand-in terrain's height, far below the islands and the creature death plane. */
export const VOID_Y = -50; // the stand-in ground under the void (G23); the chunk terrain test needs heights above -60
/** The drift rays' circling homes: centre, radius and altitude (world metres). */
export const RAY_HOMES = [{ x: 0, z: -20, r: 22, y: DECK + 14 }, { x: 40, z: -30, r: 18, y: DECK + 16 }] as const;
/** Pine positions per island, as offsets from its centre. */
export const PINES: Readonly<Record<string, readonly (readonly [number, number, number])[]>> = {
  sunrest: [[-11, -6, 1], [-9, 6, 0.8], [11, 7, 0.9], [12, -3, 1.1], [-4, 12, 0.7]],
  windmill: [[-10, 2, 1], [-7, -8, 0.8], [9, 6, 0.9], [-3, 9, 0.75]],
  roost: [[-4, -7, 0.9], [5, 6, 1.1], [7, -4, 0.8]],
  grove: [[-5, -4, 1.2], [-2, 6, 1], [4, -6, 0.9], [6, 3, 0.8], [-7, 3, 0.7]],
};
