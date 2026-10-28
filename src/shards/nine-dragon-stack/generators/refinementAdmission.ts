import type { AuthorWorldScenes } from '@wildshard/sdk/worldScenes';

/** D179 B's fine library already has a controlled refinement reader and coarse
 * coverage. Keep its otherwise-exclusive bodies out of the eager library copy;
 * ordinary shared consumers retain their original before-control admission. */
export function nineRefinementFiles(libraries: AuthorWorldScenes['libraries']): { hash: string }[] {
  const ordinary = new Set<string>(), fine = new Set<string>();
  for (const library of libraries) if (library.kind === 'whole' && library.load !== 'explorer') {
    const target = library.load === 'refine' ? fine : ordinary;
    for (const model of library.models) for (const file of model.files) target.add(file);
  }
  return [...fine].filter(hash => !ordinary.has(hash)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map(hash => ({ hash }));
}
