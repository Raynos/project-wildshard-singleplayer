import manifest from '../data/manifest.json' with { type: 'json' };
import discovery from '../data/discovery.json' with { type: 'json' };
import { bootSources } from './bootFiles';
import { MOCKUP_CAMERAS } from './mockupCameras';

/** The original four discovery values, computed without publication or filesystem access. */
export function nineBootDiscovery(inventory: Readonly<Record<string, number | true>>): {
  readonly 'boot.files': typeof manifest.BOOT_FILES;
  readonly 'boot.sources': { readonly modes: {
    readonly phone: { readonly img: ReturnType<typeof bootSources>; readonly ktx2: ReturnType<typeof bootSources> };
    readonly desktop: { readonly img: ReturnType<typeof bootSources>; readonly ktx2: ReturnType<typeof bootSources> };
  } };
  readonly 'boot.explore': { readonly art: string[] };
  readonly poses: typeof MOCKUP_CAMERAS;
} {
  if (discovery.compareImages.length !== manifest.COMPARE_ROWS.length) throw new Error('Comparison rows require one image pair each');
  const explore = { ...discovery.explore, compare: manifest.COMPARE_ROWS.map((row, index) => {
    const images = discovery.compareImages[index]; if (images === undefined) throw new Error('Missing Nine comparison image pair');
    return { ...row, ...images };
  }) };
  const sources = { modes: {
    phone: { img: bootSources('phone', 'img', manifest.BOOT_FILES, inventory), ktx2: bootSources('phone', 'ktx2', manifest.BOOT_FILES, inventory) },
    desktop: { img: bootSources('desktop', 'img', manifest.BOOT_FILES, inventory), ktx2: bootSources('desktop', 'ktx2', manifest.BOOT_FILES, inventory) },
  } };
  return { 'boot.files': manifest.BOOT_FILES, 'boot.sources': sources,
    'boot.explore': { art: [...Object.values(explore.art), ...explore.compare.flatMap(({ live, image }) => [live, image]), ...discovery.extraArt] },
    poses: MOCKUP_CAMERAS };
}
