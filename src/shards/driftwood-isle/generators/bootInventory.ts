import { bootRecipeFiles as resolveBootFiles, bootRecipeSources as resolveBootSources, type BootModes as BootModeRows, type BootSources as ChunkFiles } from '@wildshard/sdk/bootInventory';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from './bootRecipes';
import { GPU_FILES } from '../ktx2.generated';

/** Resolve the original recipes once, preserving source order, duplicates and texture fallbacks. */
export function driftwoodBootInventory(inventory: Readonly<Record<string, number | true>>): {
  sources: BootModeRows<ChunkFiles>; files: BootModeRows<readonly string[]>; lateReads: BootModeRows<readonly string[]>;
} {
  const inputs = { inventory };
  const resolve = (tier: 'phone' | 'desktop', tex: 'img' | 'ktx2') => {
    const sources = resolveBootSources(DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, tier, tex, GPU_FILES, inputs);
    const named = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover', 'island', 'records', 'lights'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, tex, GPU_FILES, inputs)));
    return { sources, files: Object.values(sources).flat(),
      lateReads: resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, tex, GPU_FILES, inputs).filter(url => !named.has(url)) };
  };
  const phone = { img: resolve('phone', 'img'), ktx2: resolve('phone', 'ktx2') };
  const desktop = { img: resolve('desktop', 'img'), ktx2: resolve('desktop', 'ktx2') };
  return {
    sources: { modes: { phone: { img: phone.img.sources, ktx2: phone.ktx2.sources }, desktop: { img: desktop.img.sources, ktx2: desktop.ktx2.sources } } },
    files: { modes: { phone: { img: phone.img.files, ktx2: phone.ktx2.files }, desktop: { img: desktop.img.files, ktx2: desktop.ktx2.files } } },
    lateReads: { modes: { phone: { img: phone.img.lateReads, ktx2: phone.ktx2.lateReads }, desktop: { img: desktop.img.lateReads, ktx2: desktop.ktx2.lateReads } } },
  };
}
