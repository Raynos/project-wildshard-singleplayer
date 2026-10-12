import { CHUNK_HALF } from '@wildshard/format/contentBounds';
import type { GridCell } from './assembly';

/** The initial G342 tier holds at most four cell presentations, independent of grid size. */
export const NEAR_PLACEHOLDER_CELLS = 4;
/** Keep the last crossroads while crossing its decision boundary inside the road strip. */
export const NEAR_CROSSROADS_MARGIN = 15;
/** A crossroads is identified by the integer coordinates of its south-west cell. */
export type NearCrossroads = readonly [number, number];
/** A visual-only streaming request; no simulation, collision or save state enters this plan. */
export interface NearPlaceholderPlan {
  readonly mode: 'crossroads' | 'adjacent';
  readonly crossroads: NearCrossroads | null;
  readonly cells: readonly { readonly instance: string; readonly distance: number }[];
}

/** Select the surrounding crossroads cells or an interior cell's four cardinal neighbours. */
export function planNearPlaceholders(cells: readonly GridCell[], pitch: number,
  point: Readonly<{ x: number; z: number }>, entered: string | null,
  previous: NearCrossroads | null = null): NearPlaceholderPlan {
  if (!Number.isFinite(pitch) || pitch <= CHUNK_HALF * 2 || !Number.isFinite(point.x) || !Number.isFinite(point.z))
    throw new RangeError('Invalid near-placeholder coordinates');
  if (previous !== null && !previous.every(Number.isSafeInteger)) throw new RangeError('Invalid near-placeholder crossroads');
  const identities = new Set<string>(), addresses = new Set<string>();
  for (const cell of cells) {
    const address = cell.cell.join(',');
    if (cell.instance.length === 0 || identities.has(cell.instance) || addresses.has(address) ||
      !cell.cell.every(Number.isSafeInteger) || cell.origin.x !== cell.cell[0] * pitch || cell.origin.z !== cell.cell[1] * pitch)
      throw new RangeError('Invalid near-placeholder cell');
    identities.add(cell.instance); addresses.add(address);
  }
  const interior = cells.find(cell => Math.abs(point.x - cell.origin.x) <= CHUNK_HALF && Math.abs(point.z - cell.origin.z) <= CHUNK_HALF);
  let crossroads: NearCrossroads | null = null;
  if (interior === undefined) {
    const retain = previous !== null && point.x >= previous[0] * pitch - NEAR_CROSSROADS_MARGIN &&
      point.x <= (previous[0] + 1) * pitch + NEAR_CROSSROADS_MARGIN &&
      point.z >= previous[1] * pitch - NEAR_CROSSROADS_MARGIN && point.z <= (previous[1] + 1) * pitch + NEAR_CROSSROADS_MARGIN;
    crossroads = retain ? previous : [Math.floor(point.x / pitch), Math.floor(point.z / pitch)];
  }
  const selected = cells.filter(cell => {
    if (cell.instance === entered) return false;
    if (interior !== undefined)
      return Math.abs(cell.cell[0] - interior.cell[0]) + Math.abs(cell.cell[1] - interior.cell[1]) === 1;
    return crossroads !== null && cell.cell[0] >= crossroads[0] && cell.cell[0] <= crossroads[0] + 1 &&
      cell.cell[1] >= crossroads[1] && cell.cell[1] <= crossroads[1] + 1;
  }).map(cell => ({ instance: cell.instance, distance: Math.hypot(point.x - cell.origin.x, point.z - cell.origin.z) }));
  selected.sort((a, b) => a.distance - b.distance || a.instance.localeCompare(b.instance));
  if (selected.length > NEAR_PLACEHOLDER_CELLS) throw new Error('Near-placeholder selection exceeds its bound');
  return { mode: interior === undefined ? 'crossroads' : 'adjacent', crossroads, cells: selected };
}
