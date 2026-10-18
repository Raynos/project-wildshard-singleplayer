import { declaredSceneBake } from '@wildshard/game/shardfile/sceneSources';
import type { LoadedMeshBake } from '@wildshard/game/shardfile/bakedKinds';

/** The original baked kinds, byte resources and placement rows. */
export const WORLD = declaredSceneBake('sunscar-dunes', 'bakes');
export type BakedWorld = LoadedMeshBake<string>;
