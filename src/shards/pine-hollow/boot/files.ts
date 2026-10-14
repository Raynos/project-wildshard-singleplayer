import { resolveBootSources } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from '../data/bootFiles';

let table: typeof GPU_FILES = GPU_FILES;
/** The boot's KTX2 stage supplies its actual ASTC overlay before any list resolves. */
export function usePineGpuFiles(next: typeof GPU_FILES): void { table = next; }
export const BAKED_UNREAD = /\/fur-[^/]*$/;
export const bootSources = (tier: Tier, tex: TexMode = 'img'): ReturnType<typeof resolveBootSources> => resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES,
  tier, tex, table, { pages: { coats: coatPages.tiers }, aliases: { props: authored.propMaterials } });
export const bootFiles = (tier: Tier): readonly string[] => Object.values(bootSources(tier)).flat();
