import type { Scope } from '@wildshard/engine/app/scope';
import { installGeometrySource } from '@wildshard/engine/models/geometrySources';
import { GeometryPack, fetchDeflated, type PackedGeometryRows } from '../kit/geometryPack';

/** Register a lazy packed bake by id. Client-only presentation; returned geometries are independent copies.
 * The authoring codec stays usable in the isolated baker; the SDK owns all runtime decoder behavior. */
export function registerPackedGeometrySource(scope: Scope, id: string, row: {
  readonly url: string; readonly rows: PackedGeometryRows; readonly label: string;
}): void {
  installGeometrySource(scope, id, { geometries: async indices => {
    const pack = new GeometryPack(await fetchDeflated(row.url), row.rows, row.label);
    return indices.map(index => pack.geometry(index));
  } });
}
