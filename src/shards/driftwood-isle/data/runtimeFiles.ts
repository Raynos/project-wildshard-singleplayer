import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from './bootFiles';
import { GPU_FILES } from '../ktx2.generated';
/** Author-only projection. The client mirrors logical names, never the
 * authoring URL tables. Boot policy retains its original shared/public reads. */
export const DRIFTWOOD_FILE_MIRRORS = {
  DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, GPU_FILES,
};
