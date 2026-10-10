// oxlint-disable-next-line import/no-nodejs-modules -- The transitional native witness reads exactly the same committed terrain/navmesh as the parent.
import { readFileSync } from 'node:fs';
import type { PrepareHeadlessRuntime } from '../../../src/sdk/headlessRuntime';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime as prepareNalati } from '../../../src/shards/nalati-grasslands/runtime/headless';

/** Worker proof transport for Nalati's still-path-addressed native inputs. No simulation, grants or restore law is replaced.
 * These bytes must eventually be declared hash-addressed shardfile assets before the whole shard is compatible.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = preparation => {
  const assets = new Map(preparation.assets);
  for (const name of [NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET]) assets.set(name, new Uint8Array(readFileSync(new URL(`../../../${name}`, import.meta.url))));
  return prepareNalati({ ...preparation, assets });
};
