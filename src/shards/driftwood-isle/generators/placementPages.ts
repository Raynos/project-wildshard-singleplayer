import { worldScenePlacement, worldScenePlacementPages } from '@wildshard/sharddev/worldScenes';
import { driftwoodPierScenes } from './pierScenesBank';
import { driftwoodFoliageScenes, foliageLogPlacements } from './foliageScenesBank';
import type { DriftwoodFixedLayouts } from './fixedLayouts';
import { uprightPoses } from './worldPlacements';

/** The original pier/log/foliage rows share bounded native transport. Keep
 * their old JSON normalization, row order and complete collider/resource data. */
export function driftwoodPlacementPages(layouts: DriftwoodFixedLayouts): ReturnType<typeof worldScenePlacementPages> {
  const foliage = { ...driftwoodFoliageScenes(), ...foliageLogPlacements(layouts) };
  const page = (id: string, rows: readonly unknown[]): ReturnType<typeof worldScenePlacementPages> =>
    worldScenePlacementPages(id, rows.map(row => {
      // Match the previous standalone writer's JSON wire, including signed zero.
      const serialized = JSON.stringify(row);
      const wire: unknown = JSON.parse(serialized);
      return worldScenePlacement(wire);
    }));
  const groups = [page('harbour', [...driftwoodPierScenes().placements, foliage.logPlacement, foliage.wreckLogPlacement])];
  for (const tier of ['phone', 'desktop'] as const) {
    const rows = [];
    for (const kind of ['palms', 'hibiscus'] as const) rows.push({
      ...foliage.placements[tier][kind], poses: uprightPoses(foliage.placements[tier][kind].poses),
      id: `foliage.${kind === 'palms' ? 'palms' : 'bushes'}.${tier}`,
    });
    groups.push(page(`foliage-${tier}`, rows));
  }
  return { files: groups.flatMap(group => group.files), placements: groups.flatMap(group => group.placements) };
}
