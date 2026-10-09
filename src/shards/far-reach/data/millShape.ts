/**
 * The windmill's shape (world/mill.ts draws it, generators/mill.ts builds its code set): the tower's foot and top radius,
 * its height, the cap's height and a sail's length (metres; local frame: base at y 0, the sails face +z), and the painted
 * stone's courses (`tile` m tall, `around` repeats round the tower).
 */
export const MILL_TOWER = { base: 2.5, top: 1.7, height: 8.6, cap: 2.9, sail: 7.4 } as const;
export const MILL_COURSES = { tile: 2.8, around: 5 } as const;
