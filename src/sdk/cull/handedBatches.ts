import { cullHandedBatches as platformCullHandedBatches } from '@wildshard/game/systems/cull/handedBatches';

/** Hand every batch `place` gave a shard's own culler to the instance culler: per instance past a radius or with a distance LOD (SHARD-PLATFORM M3). */
export const cullHandedBatches: typeof platformCullHandedBatches = platformCullHandedBatches;
