import { CHUNK_HALF } from '@wildshard/format/contentBounds';
import type { GridCell } from './assembly';

/** The near tier holds at most four cell presentations, independent of grid size. */
export const NEAR_PLACEHOLDER_CELLS = 4;
/** A held cell ranks this many metres nearer, so two cells at nearly the same distance don't swap every step. */
export const NEAR_HOLD_MARGIN = 15;
/** A visual-only streaming request; no simulation, collision or save state enters this plan. */
export interface NearPlaceholderPlan {
  /** nearest first: at most `NEAR_PLACEHOLDER_CELLS`, each within one grid pitch of the eye */
  readonly cells: readonly { readonly instance: string; readonly distance: number }[];
}
/** What the plan should keep (held: drawn or loading now) or pass over (skip: no near placeholder to draw). */
export interface NearPlanOptions {
  readonly held?: ReadonlySet<string>; readonly skip?: ReadonlySet<string>;
  /** G380 / G385 C (the hero captures only): every cell, with no reach or count limit */
  readonly every?: boolean;
}

/** Metres from `point` to the cell's content square (0 inside it). */
function squareDistance(cell: GridCell, point: Readonly<{ x: number; z: number }>): number {
  return Math.hypot(Math.max(0, Math.abs(point.x - cell.origin.x) - CHUNK_HALF), Math.max(0, Math.abs(point.z - cell.origin.z) - CHUNK_HALF));
}

/**
 * G371: the cells nearest the eye (the drawn camera, so a lifted or free camera plans from where it looks), diagonals
 * included: every cell whose content square lies within one grid pitch of the eye, ranked by that distance (then by its
 * centre's distance, then its instance), with the entered cell and the `skip` cells left out, capped at
 * `NEAR_PLACEHOLDER_CELLS`. At a crossroads that is the four cells round it; over a cell's centre, its four nearest
 * neighbours (a cardinal neighbour 55 m off the road beats a diagonal one, a diagonal beats a cell two away).
 */
export function planNearPlaceholders(cells: readonly GridCell[], pitch: number,
  point: Readonly<{ x: number; z: number }>, entered: string | null, options: NearPlanOptions = {}): NearPlaceholderPlan {
  if (!Number.isFinite(pitch) || pitch <= CHUNK_HALF * 2 || !Number.isFinite(point.x) || !Number.isFinite(point.z))
    throw new RangeError('Invalid near-placeholder coordinates');
  const identities = new Set<string>(), addresses = new Set<string>();
  for (const cell of cells) {
    const address = cell.cell.join(',');
    if (cell.instance.length === 0 || identities.has(cell.instance) || addresses.has(address) ||
      !cell.cell.every(Number.isSafeInteger) || cell.origin.x !== cell.cell[0] * pitch || cell.origin.z !== cell.cell[1] * pitch)
      throw new RangeError('Invalid near-placeholder cell');
    identities.add(cell.instance); addresses.add(address);
  }
  const held = options.held ?? new Set<string>(), skip = options.skip ?? new Set<string>();
  const ranked = cells.filter(cell => cell.instance !== entered && !skip.has(cell.instance)).map(cell => {
    const distance = squareDistance(cell, point);
    return { instance: cell.instance, distance, rank: held.has(cell.instance) ? distance - NEAR_HOLD_MARGIN : distance,
      centre: Math.hypot(point.x - cell.origin.x, point.z - cell.origin.z) };
  }).filter(row => options.every === true || row.distance <= pitch);
  ranked.sort((a, b) => a.rank - b.rank || a.centre - b.centre || a.instance.localeCompare(b.instance));
  return { cells: ranked.slice(0, options.every === true ? ranked.length : NEAR_PLACEHOLDER_CELLS).map(({ instance, distance }) => ({ instance, distance })) };
}
