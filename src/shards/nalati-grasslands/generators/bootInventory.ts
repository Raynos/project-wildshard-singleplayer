import type { BootModes as BootModeRows, BootSources as ChunkFiles } from '@wildshard/sdk/bootInventory';
import { bootSources, lateReads, type NalatiBootAssets } from './bootFiles';
import BOOT_STEPS from '../data/bootSteps.json' with { type: 'json' };

/** Pre-admission metadata preserves ordered tier/texture selections and loading weights. */
export function nalatiBootInventory(assetFiles: NalatiBootAssets, inventory: Readonly<Record<string, number | true>>): { sources: BootModeRows<ChunkFiles>; files: BootModeRows<readonly string[]>; lateReads: BootModeRows<readonly string[]>; steps: typeof BOOT_STEPS; assetFiles: NalatiBootAssets } {
  const resolve = (tier: 'phone' | 'desktop', tex: 'img' | 'ktx2') => {
    const sources = bootSources(tier, assetFiles, tex, inventory);
    return { sources, files: Object.values(sources).flat(), lateReads: lateReads(tier, tex, inventory) };
  };
  const phone = { img: resolve('phone', 'img'), ktx2: resolve('phone', 'ktx2') };
  const desktop = { img: resolve('desktop', 'img'), ktx2: resolve('desktop', 'ktx2') };
  return {
    sources: { modes: { phone: { img: phone.img.sources, ktx2: phone.ktx2.sources }, desktop: { img: desktop.img.sources, ktx2: desktop.ktx2.sources } } },
    files: { modes: { phone: { img: phone.img.files, ktx2: phone.ktx2.files }, desktop: { img: desktop.img.files, ktx2: desktop.ktx2.files } } },
    lateReads: { modes: { phone: { img: phone.img.lateReads, ktx2: phone.ktx2.lateReads }, desktop: { img: desktop.img.lateReads, ktx2: desktop.ktx2.lateReads } } },
    steps: BOOT_STEPS, assetFiles: { ...assetFiles },
  };
}
