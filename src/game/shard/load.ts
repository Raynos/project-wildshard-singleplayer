import type { ShardManifest } from './manifest';
import type { Ktx2Table } from '#engine';

const tables = new WeakMap<ShardManifest, Promise<void>>();

/** Install optional shard-owned mappings before any boot manifest or asset loader reads them. */
export function prepareShardAssets(manifest: ShardManifest, register: (table: Ktx2Table) => void): Promise<void> {
  let ready = tables.get(manifest);
  if (ready === undefined) {
    ready = manifest.ktx2 === undefined ? Promise.resolve() : manifest.ktx2().then((module) => { register(module.GPU_FILES); return undefined; });
    tables.set(manifest, ready);
    void ready.catch(() => { tables.delete(manifest); });
  }
  return ready;
}
