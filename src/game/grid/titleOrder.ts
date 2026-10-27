import catalogue from './singleplayer.json' with { type: 'json' };
import { parseGridCatalogue, type GridMode } from './catalogue';
import type { Tier } from '@wildshard/engine/core/tier';

/** iPhone downloads I9 (G737): the phone tier prefetches only the home cell and its ring (iOS cannot tell cellular from
 * wifi); every other cell waits for Settings' download-everything (G727). The desktop keeps the whole set. Pure: the
 * caller passes the tier (the title's static graph never loads the render tiers). */
export function prefetchRing<T extends { readonly cell: readonly [number, number] }>(rows: readonly T[], home: readonly [number, number], tier: Tier): readonly T[] {
  return tier === 'desktop' ? rows : rows.filter(row => Math.max(Math.abs(row.cell[0] - home[0]), Math.abs(row.cell[1] - home[1])) <= 1);
}

/** Only placement data is needed to prefetch from the title, not a world assembly. */
export function titlePrefetchOrder(mode: GridMode, tier: Tier = 'desktop'): readonly string[] {
  const data = parseGridCatalogue(catalogue.grid), selected = new Map(data.cells.map(row => [row.cell.join(','), row]));
  if (mode.developer) for (const row of data.developer) selected.set(row.cell.join(','), row);
  if (mode.devserver && mode.nineDragon !== false) for (const row of data.devserver) selected.set(row.cell.join(','), row);
  const near = [...prefetchRing([...selected.values()], [0, 0], tier)].sort((a, b) => Math.hypot(...a.cell) - Math.hypot(...b.cell));
  return [...new Set(near.map(row => row.slug))];
}
