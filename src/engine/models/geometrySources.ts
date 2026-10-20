import type { BufferGeometry } from 'three';
import { GeometryPack } from './geometryPack';
import type { PackedGeometryRows } from '@wildshard/format/geometryPack';
import type { Scope } from '../app/scope';

/** Trusted decoder bridge. Shards register rows through the SDK, never implement this service. */
export interface GeometrySource { geometries: (indices: readonly number[]) => Promise<BufferGeometry[]> }
const sources = new WeakMap<Scope, Map<string, GeometrySource>>();

/** Install a trusted decoder under an owner-local id. Runtime SDK factories own this bridge. */
export function installGeometrySource(scope: Scope, id: string, source: GeometrySource): void {
  if (scope.disposed || id.length === 0) throw new Error('Invalid geometry source registration');
  let entries = sources.get(scope);
  if (entries === undefined) { entries = new Map(); sources.set(scope, entries); }
  if (entries.has(id)) throw new Error(`Duplicate geometry source: ${id}`);
  entries.set(id, source);
  scope.onDispose(() => { sources.get(scope)?.delete(id); });
}

/** Borrow fresh owned copies by id; the caller supplies only ids and geometry indices. */
export function readGeometrySource(scope: Scope, id: string, indices: readonly number[]): Promise<BufferGeometry[]> {
  const source = sources.get(scope)?.get(id);
  if (scope.disposed || source === undefined) throw new Error(`Missing geometry source: ${id}`);
  return source.geometries(indices);
}

/** Register a lazy packed source by data identity; each loan owns fresh geometry. */
export function registerPackedGeometrySource(scope: Scope, id: string, row: { readonly url: string; readonly rows: PackedGeometryRows; readonly label: string }): void {
  installGeometrySource(scope, id, { geometries: async indices => {
    const { fetchDeflatedBytes } = await import('../core/deflate');
    const pack = new GeometryPack(await fetchDeflatedBytes(row.url), row.rows, row.label);
    return indices.map(index => pack.geometry(index));
  } });
}
