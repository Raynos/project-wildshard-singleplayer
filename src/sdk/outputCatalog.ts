// oxlint-disable-next-line import/no-nodejs-modules -- The author build writes its owned output catalog.
import { mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Catalog destination is the caller's out directory.
import { resolve } from 'node:path';
import { parseShardCatalog, type ShardCatalog, type ShardCatalogEntry } from '@wildshard/format/shardCatalog';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';

/** Supply the exact validated shard.json bytes, never its parsed/re-encoded equivalent. */
export type OutputCatalogEntry = Omit<ShardCatalogEntry, 'index'> & { readonly index: Uint8Array };

/** Write deterministic out/catalog.json after the products are emitted. Paths stay catalog-relative;
 * source thumbnail imports, legacy discovery modules and build timestamps never enter this file. */
export function writeOutputCatalog(destination: string, entries: readonly OutputCatalogEntry[]): ShardCatalog {
  const catalog = parseShardCatalog({ format: 'wildshard.catalog', formatVersion: 1,
    shards: entries.map(({ index, ...entry }) => ({ ...entry, index: { path: `${entry.slug}/shard.json`, hash: hashImmutableBytes(index) } }))
      .sort((a, b) => a.card.order - b.card.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
  });
  mkdirSync(destination, { recursive: true });
  writeFileSync(resolve(destination, 'catalog.json'), encodeCanonicalJson(catalog));
  return catalog;
}
