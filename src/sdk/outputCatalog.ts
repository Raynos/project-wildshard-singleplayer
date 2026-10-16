// oxlint-disable-next-line import/no-nodejs-modules -- The author build writes its owned output catalog.
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Catalog destination is the caller's out directory.
import { resolve } from 'node:path';
import { parseShardCatalog, runtimeInventoryBytes, type CatalogRuntimeFile, type ShardCatalog, type ShardCatalogEntry } from '@wildshard/format/shardCatalog';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';

/** Supply the exact validated shard.json bytes, never its parsed/re-encoded equivalent. */
export type OutputCatalogEntry = Omit<ShardCatalogEntry, 'index' | 'runtime'> & { readonly index: Uint8Array;
  readonly runtime: null | { readonly entry: 'runtime/index.ts'; readonly files: readonly CatalogRuntimeFile[] } };

/** Write deterministic out/catalog.json after the products are emitted. Paths stay catalog-relative;
 * source thumbnail imports, legacy discovery modules and build timestamps never enter this file. */
export function writeOutputCatalog(destination: string, entries: readonly OutputCatalogEntry[]): ShardCatalog {
  const catalog = parseShardCatalog({ format: 'wildshard.catalog', formatVersion: 1,
    shards: entries.map(({ index, runtime, ...entry }) => ({ ...entry, index: { path: `${entry.slug}/shard.json`, hash: hashImmutableBytes(index) },
      runtime: runtime === null ? null : { entry: runtime.entry, filesHash: hashImmutableBytes(runtimeInventoryBytes(runtime.files)) } }))
      .sort((a, b) => a.card.order - b.card.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
  });
  mkdirSync(destination, { recursive: true });
  // Publish the complete regenerated list once. Readers see the old or new file,
  // never a partial write; concurrent builds own separate output roots/locks.
  const temporary = mkdtempSync(resolve(destination, '.catalog-'));
  try {
    const path = resolve(temporary, 'catalog.json'); writeFileSync(path, encodeCanonicalJson(catalog));
    renameSync(path, resolve(destination, 'catalog.json'));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  return catalog;
}
