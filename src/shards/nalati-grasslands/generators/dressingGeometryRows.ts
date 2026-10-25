import { DRESSING_GEOS } from './dressingGeos';
import { join, writeGeometry, type PlaceGeometryRow } from './geometryWriter';

/** Build the original native dressing variants without allocating scene materials or installing runtime owners.
 * The returned rows and binary own their bytes; temporary geometry is disposed after copying its channels. */
export function bakeDressing(): { readonly rows: readonly { readonly key: string; readonly geometry: PlaceGeometryRow }[]; readonly bin: Uint8Array } {
  const blocks: Uint8Array[] = [];
  const rows = DRESSING_GEOS.map(([key, build]) => {
    const geometry = build();
    try { return { key, geometry: writeGeometry(geometry, blocks, `dressing ${key}`) }; }
    finally { geometry.dispose(); }
  });
  return { rows, bin: join(blocks) };
}
