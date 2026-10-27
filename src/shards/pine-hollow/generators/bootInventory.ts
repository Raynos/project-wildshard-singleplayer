import { resolveBootSources } from '@wildshard/engine/boot/filePolicy';
import type { BootModes, BootSources, BootGpuFiles } from '@wildshard/sdk/bootInventory';
import { GPU_FILES } from '../ktx2.generated';
import policy from '../data/pagePolicy.json' with { type: 'json' };
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from './bootFiles';

/** Resolve both existing page modes offline, preserving ordered URLs and duplicates. */
export function pineBootInventory(inventory: Readonly<Record<string, number | true>>, astc: Readonly<Record<string, string>>): {
  shard: BootModes<BootSources>; grid: BootModes<BootSources>; bakedUnreadPrefixes: readonly string[];
} {
  // GR8 G37: the prop and cabin material payloads are product files now (their aliases name them), so the boot pack keeps
  // the original prop payloads, as it already did for the heroes
  const inputs = { inventory, aliases: { props: {} } };
  const resolve = (table: typeof GPU_FILES): BootModes<BootSources> => ({ modes: {
    phone: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'phone', 'ktx2', table, inputs) },
    desktop: { img: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'img', table, inputs),
      ktx2: resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, 'desktop', 'ktx2', table, inputs) },
  } });
  const tables = pineKtx2Tables(astc);
  return { shard: resolve(tables.shard), grid: resolve(tables.grid), bakedUnreadPrefixes: ['fur-'] };
}

/** GPU rows remain a separate lazy payload; the desktop map is never overlaid. */
export function pineKtx2Tables(astc: Readonly<Record<string, string>>): { readonly shard: BootGpuFiles; readonly grid: BootGpuFiles } {
  const trimmed = { phone: { ...GPU_FILES.phone, ...astc }, desktop: GPU_FILES.desktop };
  return { shard: policy.memoryTrim.shard ? trimmed : GPU_FILES, grid: policy.memoryTrim.grid ? trimmed : GPU_FILES };
}
