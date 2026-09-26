// Lantern Square's plan (metres; y = altitude in the 500 m cube, x east, z south). Looking north from the spawn: the
// Yamen Well opens on the left behind a stone balustrade, the paifang stands ahead, the banyan and the mahjong tables
// on the right, the street runs on north through the gate under a skybridge, the monorail and the Cable Deck's screens.

/** Lantern Square's datum (stratum 6, +125 m) */
export const Y0 = 125;

/** the Yamen Well's shaft */
export const WELL = { x0: -28, x1: 0, z0: -44, z1: 16, water: -245 } as const;

/** the open plaza (the Well's balustrade is its west edge) */
export const PLAZA = { x0: 0, x1: 30, z0: -24, z1: 20 } as const;

/** the paifang: centre x, z, bay posts */
export const GATE = { x: 6.5, z: -22, posts: [0.9, 4.3, 8.7, 12.1] as const } as const;

/** the street north through the gate */
export const STREET = { x0: 0.5, x1: 12.5, z1: -24, z0: -230 } as const;

/** the stair-street climbing east out of the square */
export const STAIR = { z0: 2, z1: 10, x0: 30, x1: 78, rise: 21 } as const;

export const BANYAN = { x: 17.2, z: -14.2, r: 4.1 } as const;

export const STALL = { x0: 20, x1: 28.5, z0: -23.8, z1: -20.2 } as const;

/** the nine strata's street levels (altitude of each ring walkway in the Well) */
export const STRATA = [-245, -150, -70, 0, 70, 125, 167, 210, 240] as const;

/** where the player may walk (simple bounds, no physics) */
export function walkable(x: number, z: number): boolean {
  const inPlaza = x > PLAZA.x0 + 0.6 && x < PLAZA.x1 - 0.8 && z > PLAZA.z0 + 0.8 && z < PLAZA.z1 - 0.8;
  const inGate = x > STREET.x0 + 1.4 && x < STREET.x1 - 0.6 && z <= PLAZA.z0 + 0.8 && z > -120;
  const inStair = z > STAIR.z0 + 0.6 && z < STAIR.z1 - 0.6 && x >= PLAZA.x1 - 0.8 && x < STAIR.x0 + 6;
  if (!(inPlaza || inGate || inStair)) return false;
  const bx = x - BANYAN.x, bz = z - BANYAN.z;
  if (bx * bx + bz * bz < (BANYAN.r + 0.6) ** 2) return false;
  if (x > STALL.x0 - 0.5 && x < STALL.x1 + 0.5 && z < STALL.z1 + 1.4) return false;
  for (const px of GATE.posts) if (Math.abs(x - px) < 0.8 && Math.abs(z - GATE.z) < 0.9) return false;
  return true;
}
