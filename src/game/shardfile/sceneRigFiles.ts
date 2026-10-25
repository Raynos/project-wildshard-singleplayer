import type { ModelLibraryRows } from '../plugin/geometry';
import type { ShardProduct } from './shardProduct';

/** Resolve existing product-owned names for the URL-only skinned loader.
 * Ordinary public URLs and the original descriptor remain untouched. */
export function sceneRigFiles(rows: ModelLibraryRows<string, string>, product: Pick<ShardProduct, 'hasFile' | 'url'>): ModelLibraryRows<string, string> {
  const rigs = rows.rigs;
  if (rigs === undefined) return rows;
  let urls: Record<string, string> | undefined;
  for (const [creature, source] of Object.entries(rigs.bodies.urls)) {
    if (!product.hasFile(source)) continue;
    urls ??= { ...rigs.bodies.urls };
    urls[creature] = product.url(source);
  }
  return urls === undefined ? rows : { ...rows, rigs: { ...rigs, bodies: { ...rigs.bodies, urls } } };
}
