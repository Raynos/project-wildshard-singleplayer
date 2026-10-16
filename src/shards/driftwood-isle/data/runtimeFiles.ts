import { FIXED_MODEL_FILES } from './modelFiles';
import { GROUND_FILES } from './groundFiles';
import { HIBISCUS_FILES } from './hibiscusFiles';
import { PALM_FILES } from './palmFiles';
import { REEF_FILES } from './reefFiles';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from './bootFiles';
import { GPU_FILES } from '../ktx2.generated';
import { DRIFTWOOD_ASSET_NAMES } from './output';

function named(url: string): string {
  const name = DRIFTWOOD_ASSET_NAMES[url];
  if (name === undefined) throw new Error(`Driftwood file table has no named blob: ${url}`);
  return name;
}
const records = (files: Readonly<Record<string, string>>): Record<string, string> => Object.fromEntries(Object.entries(files).map(([key, url]) => [key, named(url)]));

/** Author-only projection. The client mirrors logical names, never the
 * authoring URL tables. Boot policy retains its original shared/public reads. */
export const DRIFTWOOD_FILE_MIRRORS = {
  FIXED_MODEL_FILES: records(FIXED_MODEL_FILES),
  GROUND_FILES: records(GROUND_FILES),
  HIBISCUS_FILES: { phone: records(HIBISCUS_FILES.phone), desktop: records(HIBISCUS_FILES.desktop) },
  PALM_FILES: { phone: records(PALM_FILES.phone), desktop: records(PALM_FILES.desktop) },
  REEF_FILES: { coral: records(REEF_FILES.coral), weed: records(REEF_FILES.weed), star: records(REEF_FILES.star), world: named(REEF_FILES.world) },
  DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, GPU_FILES,
};
