import type { BootModeRows } from '@wildshard/engine/level/spec';
import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { assetFiles, bootSources, lateReads } from './bootFiles';
import { BOOT_STEPS } from './bootSteps';

/** Pre-admission metadata preserves ordered tier/texture selections and loading weights. */
export function nalatiBootInventory(inventory?: Readonly<Record<string, number | true>>): { sources: BootModeRows<ChunkFiles>; files: BootModeRows<readonly string[]>; lateReads: BootModeRows<readonly string[]>; steps: typeof BOOT_STEPS; assetFiles: typeof assetFiles } {
  const resolve = (tier: 'phone' | 'desktop', tex: 'img' | 'ktx2') => {
    const sources = bootSources(tier, tex, inventory);
    return { sources, files: Object.values(sources).flat(), lateReads: lateReads(tier, tex, inventory) };
  };
  const phone = { img: resolve('phone', 'img'), ktx2: resolve('phone', 'ktx2') };
  const desktop = { img: resolve('desktop', 'img'), ktx2: resolve('desktop', 'ktx2') };
  return {
    sources: { modes: { phone: { img: phone.img.sources, ktx2: phone.ktx2.sources }, desktop: { img: desktop.img.sources, ktx2: desktop.ktx2.sources } } },
    files: { modes: { phone: { img: phone.img.files, ktx2: phone.ktx2.files }, desktop: { img: desktop.img.files, ktx2: desktop.ktx2.files } } },
    lateReads: { modes: { phone: { img: phone.img.lateReads, ktx2: phone.ktx2.lateReads }, desktop: { img: desktop.img.lateReads, ktx2: desktop.ktx2.lateReads } } },
    steps: BOOT_STEPS, assetFiles,
  };
}
