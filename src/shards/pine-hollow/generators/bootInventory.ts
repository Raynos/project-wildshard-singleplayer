import { resolveBootSources } from '@wildshard/engine/boot/filePolicy';
import type { BootModeRows } from '@wildshard/engine/level/spec';
import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { GPU_FILES } from '../ktx2.generated';
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from './bootFiles';

/** Resolve both existing page modes offline, preserving ordered URLs and duplicates. */
export function pineBootInventory(inventory: Readonly<Record<string, number | true>>, astc: Readonly<Record<string, string>>): {
  standalone: BootModeRows<ChunkFiles>; grid: BootModeRows<ChunkFiles>;
} {
  const inputs = { inventory, pages: { coats: coatPages.tiers }, aliases: { props: authored.propMaterials } };
  const resolve = (table: typeof GPU_FILES): BootModeRows<ChunkFiles> => ({ modes: {
    phone: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'ktx2', table, inputs) },
    desktop: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'ktx2', table, inputs) },
  } });
  return { standalone: resolve(GPU_FILES), grid: resolve({ phone: { ...GPU_FILES.phone, ...astc }, desktop: GPU_FILES.desktop }) };
}
