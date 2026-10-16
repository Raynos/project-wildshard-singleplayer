// Composition root: only emitted runtime modules enter the application bundle.
// Kept separate from shardList until each migrated source runtime is standalone.
import { compileCatalogRegistry, type CatalogHash, type CatalogRuntimeModule, type RuntimeProductIdentity } from './game/shard/catalogBoot';

const modules = import.meta.glob<CatalogRuntimeModule>('/out/*/runtime/index.ts');
const inventories = import.meta.glob<RuntimeProductIdentity['runtime']>('/out/*/shard.json', { eager: true, import: 'runtime' });
/** The compiled inventory hashes travel with their matching lazy code loaders. */
export function outputRuntimeRegistry(hash: CatalogHash): ReturnType<typeof compileCatalogRegistry> {
  return compileCatalogRegistry(modules, inventories, hash);
}
