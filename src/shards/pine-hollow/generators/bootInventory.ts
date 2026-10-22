import { resolveBootSources } from '@wildshard/engine/boot/filePolicy';
import type { BootModeRows } from '@wildshard/engine/level/spec';
import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { GPU_FILES } from '../ktx2.generated';
import type { PageBootRows, PageKtx2Rows } from '@wildshard/game/shard/pageBoot';
import policy from '../data/pagePolicy.json' with { type: 'json' };
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from './bootFiles';

/** Resolve both existing page modes offline, preserving ordered URLs and duplicates. */
export function pineBootInventory(inventory: Readonly<Record<string, number | true>>, astc: Readonly<Record<string, string>>): {
  shard: BootModeRows<ChunkFiles>; grid: BootModeRows<ChunkFiles>; bakedUnreadPrefixes: readonly string[];
} {
  const inputs = { inventory, pages: { coats: coatPages.tiers }, aliases: { props: authored.propMaterials } };
  const resolve = (table: typeof GPU_FILES): BootModeRows<ChunkFiles> => ({ modes: {
    phone: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'ktx2', table, inputs) },
    desktop: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'ktx2', table, inputs) },
  } });
  const tables = pineKtx2Tables(astc);
  return { shard: resolve(tables.shard), grid: resolve(tables.grid), bakedUnreadPrefixes: ['fur-'] } satisfies PageBootRows;
}

/** GPU rows remain a separate lazy payload; the desktop map is never overlaid. */
export function pineKtx2Tables(astc: Readonly<Record<string, string>>): PageKtx2Rows {
  const trimmed = { phone: { ...GPU_FILES.phone, ...astc }, desktop: GPU_FILES.desktop };
  return { shard: policy.memoryTrim.shard ? trimmed : GPU_FILES, grid: policy.memoryTrim.grid ? trimmed : GPU_FILES };
}
