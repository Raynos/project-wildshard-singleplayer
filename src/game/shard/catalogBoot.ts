import { runtimeInventoryBytes, type CatalogRuntimeFile } from '@wildshard/format/shardCatalog';
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

