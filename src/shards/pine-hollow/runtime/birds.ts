import { posedAssets } from '@wildshard/game/plugin/geometry';
import rows from '../data/ambientBirds.generated.json' with {type:'json'};

/** Required baked frames; a missing asset rejects rather than leaving a stand-in. */
let loading: ReturnType<typeof posedAssets> | null = null;
export const loadBirdModels = (): ReturnType<typeof posedAssets> => (loading ??= posedAssets(rows));

export type BirdSet=Awaited<ReturnType<typeof loadBirdModels>>;
