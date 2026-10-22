/** Native arena/riding refusal; storage and its numeric law live in CellField. */
import { CellField } from '../systems/cellField';
import type { Scope } from '@wildshard/engine/app/scope';

/** Pure spatial refusal against a declared ring and an admitted field. Rule
 * enablement comes from the encounter's last bounded decision. */
export function arenaBlockedAt(field: CellField, point: { readonly x: number; readonly z: number },
  boundary: { readonly x: number; readonly z: number; readonly radius: number }, mask: number): boolean {
  return ((mask & 1) !== 0 && Math.hypot(point.x - boundary.x, point.z - boundary.z) > boundary.radius)
    || ((mask & 2) !== 0 && field.activeAt(point.x, point.z));
}

/** A real entered field and the latest AS refusal mask, lent as numeric data. */
export interface ArenaBoundary { readonly field: CellField; readonly boundary: { readonly x: number; readonly z: number; readonly radius: number }; mask: number }
const boundaries = new WeakMap<Scope, Set<ArenaBoundary>>();
/** Riding borrows fields directly; no author refusal callback is installed. */
export function installArenaBoundary(scope: Scope, boundary: ArenaBoundary): void {
  if (scope.disposed || !(boundary.field instanceof CellField) || !Object.values(boundary.boundary).every(Number.isFinite)) throw new Error('Invalid native arena boundary');
  const rows = boundaries.get(scope) ?? new Set<ArenaBoundary>();
  if (rows.has(boundary) || rows.size>=8) throw new Error('Duplicate or excessive arena boundary');
  rows.add(boundary); boundaries.set(scope,rows); scope.onDispose(() => { rows.delete(boundary); });
}
/** Sample each entered field at the riding owner's actual look-ahead point. */
export function arenaBoundaryBlocked(scope: Scope, x: number, z: number): boolean {
  for (const row of boundaries.get(scope) ?? []) if (arenaBlockedAt(row.field,{ x,z },row.boundary,row.mask)) return true;
  return false;
}

