import type { ShardManifest } from '../../src/game/shard/manifest';
import type { BakedGrid } from '../../src/engine/world/BakedTerrain';
/** Preconfigure live samplers from original native bytes before authored terrain/forest/model construction. */
export function prepareNativeTerrain(def: ShardManifest, options: { root: string; bytes: Uint8Array }): Promise<BakedGrid>;
