import catalogue from './singleplayer.json' with { type: 'json' };
import { parseGridCatalogue, type GridMode } from './catalogue';

/** Only placement data is needed to prefetch from the title, not a world assembly. */
export function titlePrefetchOrder(mode: GridMode): readonly string[] {
  const data = parseGridCatalogue(catalogue.grid), selected = new Map(data.cells.map(row => [row.cell.join(','), row]));
  if (mode.developer) for (const row of data.developer) selected.set(row.cell.join(','), row);
  if (mode.devserver && mode.nineDragon !== false) for (const row of data.devserver) selected.set(row.cell.join(','), row);
  const near = [...selected.values()].sort((a, b) => Math.hypot(...a.cell) - Math.hypot(...b.cell));
  return [...new Set(near.map(row => row.slug))];
}
