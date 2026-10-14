import { resolveBootFiles } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import { DRIFTWOOD_BOOT_FILES } from '../data/bootFiles';

export const lateReads = (tier: Tier, tex: TexMode = 'img'): string[] => resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, tex, GPU_FILES);
