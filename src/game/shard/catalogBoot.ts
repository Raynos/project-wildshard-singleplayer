import { runtimeInventoryBytes, type CatalogRuntimeFile, type ShardCatalog, type ShardCatalogEntry } from '@wildshard/format/shardCatalog';
import type { LevelSection } from '@wildshard/format/level';
import type { ShardPlugin } from '../plugin/context';
import type { AuthoredShardBindings, defineShard } from './manifest';

/** Copied runtime entry exports its code-valued discovery bindings. Title boot
 * reads only catalog/level JSON; these functions arrive with selected play code. */
export interface CatalogRuntimeModule {
  readonly default: new () => ShardPlugin;
  readonly discovery?: () => Promise<{ readonly rows: AuthoredShardBindings; readonly native: Parameters<typeof defineShard>[1] }>;
}
export interface CompiledCatalogRuntime { readonly filesHash: string; readonly load: () => Promise<CatalogRuntimeModule> }
export interface RuntimeProductIdentity {
  readonly identity: { readonly slug: string; readonly revision: number };
  readonly runtime: null | { readonly files: readonly CatalogRuntimeFile[] };
}
export type CatalogHash = (bytes: Uint8Array) => Promise<string>;

/** Resolve an output folder or admitted content identity (which need not share
 * its folder spelling). Paths remain relative to the catalog's base URL. */
export function lookupCatalogEntry(catalog: ShardCatalog, slug: string): ShardCatalogEntry | undefined {
  return catalog.shards.find(entry => [entry.slug, entry.identity.slug].includes(slug));
}

/** Join generated glob modules with the inventory baked into this app build.
 * Inputs are the two literal /out globs, never source/runtime or network code. */
export async function compileCatalogRegistry(modules: Readonly<Record<string, () => Promise<CatalogRuntimeModule>>>,
  inventories: Readonly<Record<string, RuntimeProductIdentity['runtime']>>, hash: CatalogHash): Promise<ReadonlyMap<string, CompiledCatalogRuntime>> {
  const registry = new Map<string, CompiledCatalogRuntime>();
  for (const [path, load] of Object.entries(modules)) {
    const match = /^\/out\/([^/]+)\/runtime\/index\.ts$/u.exec(path), outputKey = match?.[1];
    if (outputKey === undefined) throw new Error('Runtime registry accepts only copied output entries');
    const runtime = inventories[`/out/${outputKey}/shard.json`];
    if (runtime === undefined || runtime === null || !runtime.files.some(file => file.path === 'runtime/index.ts')) throw new Error(`Missing compiled runtime inventory: ${outputKey}`);
    const filesHash = await hash(runtimeInventoryBytes(runtime.files)); let loaded: Promise<CatalogRuntimeModule> | undefined;
    registry.set(outputKey, { filesHash, load: () => { loaded ??= load(); return loaded; } });
  }
  for (const [path, runtime] of Object.entries(inventories)) {
    if (runtime === null) continue;
    const outputKey = /^\/out\/([^/]+)\/shard\.json$/u.exec(path)?.[1];
    if (outputKey === undefined || !registry.has(outputKey)) throw new Error(`Missing copied runtime module: ${path}`);
  }
  return registry;
}

/** Refuse stale/offline products before evaluating any selected runtime module.
 * Index-byte integrity belongs to readProductDescriptor's descriptorHash door. */
export async function loadCatalogRuntime(entry: ShardCatalogEntry, product: RuntimeProductIdentity,
  registry: ReadonlyMap<string, CompiledCatalogRuntime>, hash: CatalogHash): Promise<CatalogRuntimeModule | null> {
  const { slug: expectedIdentity, revision: expectedRevision } = entry.identity;
  const { slug: productIdentity, revision: productRevision } = product.identity;
  if (expectedIdentity !== productIdentity || expectedRevision !== productRevision) throw new Error(`Catalog product identity mismatch: ${entry.slug}`);
  if (entry.runtime === null) {
    if (product.runtime !== null || registry.has(entry.slug)) throw new Error(`Unexpected runtime for data-only shard: ${entry.slug}`);
    return null;
  }
  const compiled = registry.get(entry.slug);
  if (compiled === undefined || product.runtime === null || compiled.filesHash !== entry.runtime.filesHash
    || await hash(runtimeInventoryBytes(product.runtime.files)) !== compiled.filesHash) throw new Error(`Catalog runtime inventory mismatch: ${entry.slug}`);
  return compiled.load();
}

export interface CatalogBootEntry { readonly entry: ShardCatalogEntry; readonly level: LevelSection }
/** Async startup barrier. Publish the complete list only after every level read
 * succeeds. This does not evaluate runtime code or mutate the live shard registry. */
export function prepareCatalogBoot(catalog: ShardCatalog,
  readLevel: (entry: ShardCatalogEntry) => Promise<LevelSection>): Promise<readonly CatalogBootEntry[]> {
  return Promise.all(catalog.shards.map(async entry => {
    const level = await readLevel(entry);
    const { slug: levelSlug } = level.manifest;
    if (![entry.identity.slug, entry.slug].includes(levelSlug)) throw new Error(`Catalog level identity mismatch: ${entry.slug}`);
    if (level.manifest.name !== entry.card.name || level.manifest.order !== entry.card.order) throw new Error(`Catalog level card mismatch: ${entry.slug}`);
    return { entry, level };
  }));
}
