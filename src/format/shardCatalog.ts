import * as v from 'valibot';
import { AccentSchema } from './accent';
import { isJsonData } from './json';
import { ShardHashSchema } from './shardSections';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(2048));
const slug = v.pipe(v.string(), v.maxLength(80), v.regex(/^(?:_[a-z]+|[a-z][a-z0-9-]*)$/u));
const integer = v.pipe(v.number(), v.safeInteger());
const image = v.pipe(v.string(), v.minLength(1), v.maxLength(16_384));
const natural = v.pipe(integer, v.minValue(0));
const runtimeFile = v.strictObject({ path: v.pipe(text, v.regex(/^runtime\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.ts$/u)), hash: ShardHashSchema, bytes: natural, lines: natural });
export type CatalogRuntimeFile = v.InferOutput<typeof runtimeFile>;

/** Stable inventory digest input shared by the author writer and compiled registry.
 * Sorted tuples avoid object-key order differences; hashes cover exact TS bytes. */
export function runtimeInventoryBytes(files: readonly CatalogRuntimeFile[]): Uint8Array {
  const checked = v.parse(v.array(runtimeFile), files).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (new Set(checked.map(file => file.path)).size !== checked.length) throw new Error('Duplicate runtime inventory path');
  return new TextEncoder().encode(`${JSON.stringify(checked.map(file => [file.path, file.hash, file.bytes, file.lines]))}\n`);
}

/** The title needs only these JSON fields, never a shard's build-time modules. */
export const ShardCatalogCardSchema = v.strictObject({
  name: text, label: text, biome: text, blurb: text, order: integer,
  status: v.picklist(['live', 'experimental', 'earlyAccess', 'hidden']),
  thumb: image, portrait: image, landscape: image, accent: AccentSchema,
});

/** Index and image paths are relative to out/catalog.json (served as shardfiles/catalog.json). */
export const ShardCatalogEntrySchema = v.pipe(v.strictObject({
  slug,
  identity: v.strictObject({ slug, revision: natural }),
  index: v.strictObject({ path: text, hash: ShardHashSchema }),
  card: ShardCatalogCardSchema,
  placement: v.strictObject({ instance: v.pipe(text, v.regex(/^[a-zA-Z0-9_-]+$/u)),
    grid: v.tuple([integer, integer]), size: v.tuple([v.literal(500), v.literal(500), v.literal(500)]) }),
  runtime: v.nullable(v.strictObject({ entry: v.literal('runtime/index.ts'), filesHash: ShardHashSchema })),
}), v.check(row => row.index.path === `${row.slug}/shard.json`, 'Catalog index must belong to its shard'),
  v.check(row => [row.card.thumb, row.card.portrait, row.card.landscape].every(path => path.startsWith('data:image/')
    || new RegExp(`^${row.slug}/blobs/image/[a-f0-9]{64}\\.(?:webp|jpg|png)$`, 'u').test(path)), 'Catalog images must name shard image blobs'));

/** A bounded, source-free discovery list; unknown versions and duplicate placements refuse. */
export const ShardCatalogSchema = v.pipe(v.strictObject({
  format: v.literal('wildshard.catalog'), formatVersion: v.literal(1),
  shards: v.pipe(v.array(ShardCatalogEntrySchema), v.minLength(1), v.maxLength(256)),
}), v.check(row => new Set(row.shards.map(entry => entry.slug)).size === row.shards.length, 'Duplicate catalog slug'),
  v.check(row => new Set(row.shards.map(entry => entry.identity.slug)).size === row.shards.length, 'Duplicate catalog identity'),
  v.check(row => new Set(row.shards.map(entry => entry.placement.instance)).size === row.shards.length, 'Duplicate catalog instance'),
  v.check(row => new Set(row.shards.map(entry => entry.placement.grid.join(','))).size === row.shards.length, 'Duplicate catalog cell'));

export type ShardCatalog = v.InferOutput<typeof ShardCatalogSchema>;
export type ShardCatalogEntry = v.InferOutput<typeof ShardCatalogEntrySchema>;

/** Parse data only; executable values and unknown fields are never discovery metadata. */
export function parseShardCatalog(input: unknown): ShardCatalog {
  if (!isJsonData(input)) throw new Error('Shard catalog must contain JSON data only');
  return v.parse(ShardCatalogSchema, input);
}
