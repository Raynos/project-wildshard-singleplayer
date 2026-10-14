import { resolveBootSources } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from '../data/bootFiles';

export const bootSources = (tier: Tier, tex: TexMode = 'img'): ReturnType<typeof resolveBootSources> => resolveBootSources(DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, tier, tex, GPU_FILES);
