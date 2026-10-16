import { resolveBootFiles } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../../ktx2.generated';
import { DRIFTWOOD_BOOT_FILES } from '../../data/bootFiles';

export const lateReads = (tier: Tier, tex: TexMode = 'img'): string[] => {
  // These world stages now read verified named product files. Retiring only their
  // old public prefetch avoids downloading the same bytes under two URLs.
  const named = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, tex, GPU_FILES)));
  return resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, tex, GPU_FILES).filter(url => !named.has(url));
};
