// A Developer harness moves a player from the page, but on a worker page the server owns the position. This is the move as it
// crosses their own port: a lap's start, or a stuck walker moved on. Both halves import it; shell.ts must reach no server module.

/** Where to put this player, in the world it stands in. */
export interface HarnessPlace { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
/** How hard this player's blows land, for a harness that walks a long fight to its end by real ones. */
export interface HarnessHits { readonly hits: number }
/** Raise one of this player's flags, for a door whose quest step a proof can't reach in its minutes (a thrall hunt at night). */
export interface HarnessFlag { readonly flag: string }
/** Stand the day at an hour, for what comes out at night, where a proof can't wait for dusk. */
export interface HarnessHour { readonly hour: number }
export const isHarnessHour = (value: unknown): value is HarnessHour => typeof value === 'object' && value !== null && 'hour' in value && typeof value.hour === 'number';
export const isHarnessFlag = (value: unknown): value is HarnessFlag => typeof value === 'object' && value !== null && 'flag' in value && typeof value.flag === 'string';
/** A proof's second client: it stands here in this cell, on the port that comes with this message. `player` names it after that. */
export interface HarnessJoin { readonly join: string; readonly x: number; readonly y: number; readonly z: number }
/** Move a joined client's body. */
export interface HarnessMove extends HarnessPlace { readonly move: string }
export const isHarnessJoin = (value: unknown): value is HarnessJoin => typeof value === 'object' && value !== null && 'join' in value && typeof value.join === 'string' && 'x' in value && typeof value.x === 'number' && 'y' in value && typeof value.y === 'number' && 'z' in value && typeof value.z === 'number';
export const isHarnessHits = (value: unknown): value is HarnessHits => typeof value === 'object' && value !== null && 'hits' in value && typeof value.hits === 'number';
export const isHarnessPlace = (value: unknown): value is HarnessPlace => typeof value === 'object' && value !== null
  && 'x' in value && typeof value.x === 'number' && 'y' in value && typeof value.y === 'number'
  && 'z' in value && typeof value.z === 'number' && 'yaw' in value && typeof value.yaw === 'number';
export const isHarnessMove = (value: unknown): value is HarnessMove => typeof value === 'object' && value !== null && 'move' in value && typeof value.move === 'string' && isHarnessPlace(value);
