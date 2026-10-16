import { posedAssets } from '@wildshard/game/plugin/geometry';
import { pineBirdFiles } from './species/rigs';
import rows from '../data/ambientBirds.generated.json' with {type:'json'};

/** The tier's posed rest geometry and atlas, as the first-party product's named blobs (generators/birdBlobs.mjs, W2a):
 *  `models/life/birds-rest[.phone].glb` and the atlas's own KTX2 `models/life/birds[.phone].base.ktx2`. A species look's
 *  preload takes no arguments, so this loads the product itself. */
async function productBirds(): Promise<Awaited<ReturnType<typeof posedAssets>>> {
  const product = await (await import('@wildshard/game/shardfile/runtimeProduct')).loadFirstPartyProduct('pine-hollow');
  return posedAssets({ name: rows.name, channels: rows.channels, ranges: rows.ranges, ...pineBirdFiles(product) });
}

/** Required baked frames; a missing asset rejects rather than leaving a stand-in. */
let loading: ReturnType<typeof posedAssets> | null = null;
export const loadBirdModels = (): ReturnType<typeof posedAssets> => (loading ??= productBirds());

export type BirdSet=Awaited<ReturnType<typeof loadBirdModels>>;
