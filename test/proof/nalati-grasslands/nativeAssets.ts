// oxlint-disable-next-line import/no-nodejs-modules -- The native witnesses read Nalati's committed native inputs.
import { readFileSync } from 'node:fs';
import type { Shardfile } from '../../../src/sdk/shardfile';
import { NALATI_TERRAIN_ASSET } from '../../../src/shards/nalati-grasslands/runtime/headless';

const root = new URL('../../../', import.meta.url);
const read = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(path, root)));
/** Nalati's declared shardfile assets by hash: the admitted navigation row's original WSNM bytes, from their retained
 *  source copy (generators/navigation.ts). */
export function nalatiDeclaredAssets(source: Pick<Shardfile, 'navigation'>): Map<string, Uint8Array> {
  return new Map(source.navigation === null ? [] : [[source.navigation.file, read(`src/shards/nalati-grasslands/assets/navigation-${source.navigation.file}`)]]);
}
/** Nalati's native inputs: its declared assets (unless the host handed them over) and the terrain grid, still by path. */
export function nalatiNativeAssets(source: Pick<Shardfile, 'navigation'>, assets: ReadonlyMap<string, Uint8Array> = new Map()): Map<string, Uint8Array> {
  const result = new Map([...nalatiDeclaredAssets(source), ...assets]);
  result.set(NALATI_TERRAIN_ASSET, read(NALATI_TERRAIN_ASSET));
  return result;
}
