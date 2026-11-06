// A Developer harness moves a player from the page, but on a worker page the server owns the position. This is the move as it
// crosses their own port: a lap's start, or a stuck walker moved on. Both halves import it; shell.ts must reach no server module.

/** Where to put this player, in the world it stands in. */
export interface HarnessPlace { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
export const isHarnessPlace = (value: unknown): value is HarnessPlace => typeof value === 'object' && value !== null
  && 'x' in value && typeof value.x === 'number' && 'y' in value && typeof value.y === 'number'
  && 'z' in value && typeof value.z === 'number' && 'yaw' in value && typeof value.yaw === 'number';
