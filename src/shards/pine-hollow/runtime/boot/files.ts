import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import metadata from '../../data/bootMetadata.generated.json' with { type: 'json' };
import { pageModeValue, pageModeCap } from '@wildshard/game/shard/pagePolicy';

/** The pre-admission policy preserves standalone and grid memory choices. */
export const pineMemoryTrim = (): boolean => pageModeValue(metadata.policy.memoryTrim);
export const pineSetCap = (tierCap: number): number => pageModeCap(metadata.policy.setCap, tierCap);

export const BAKED_UNREAD = /\/fur-[^/]*$/;
/** Read the offline inventory for the same page mode that chooses Pine's GPU table. */
export const bootSources = (tier: Tier, tex: TexMode = 'img'): ChunkFiles =>
  (pineMemoryTrim() ? metadata.grid : metadata.standalone).modes[tier][tex];
export const bootFiles = (tier: Tier): readonly string[] => Object.values(bootSources(tier)).flat();
