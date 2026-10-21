import type { PlatformCell, StripProfile } from '@wildshard/engine/sim/strips';
import { ENTRY_WIDTH } from '@wildshard/engine/core/config';
import type { GridAssembly } from './assembly';

/** The platform's cells: the shards' real edge rows and observations (loaded once by `create`, before this one generation),
 *  each cell at road level as the fallback, and G198's open plots (road-level ground with an open entry on all four sides,
 *  its showroom facing each one). */
export function platformInputs(assembly: GridAssembly, edges: readonly PlatformCell[] | undefined): { readonly cells: readonly PlatformCell[]; readonly flat: readonly PlatformCell[]; readonly empty: StripProfile } {
  const empty = assembly.emptyNeighbour.edge;
  const flat = assembly.cells.map((cell): PlatformCell => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z },
    edges: { north: empty, east: empty, south: empty, west: empty } }));
  const entry = { entryWidth: ENTRY_WIDTH, geometry: 'ground' } as const;
  const plots = assembly.plots.map((plot): PlatformCell => ({ instance: plot.instance, cell: plot.cell, origin: { x: plot.origin.x, z: plot.origin.z },
    edges: { north: empty, east: empty, south: empty, west: empty }, observations: { north: entry, east: entry, south: entry, west: entry } }));
  return { cells: [...(edges ?? flat), ...plots], flat: [...flat, ...plots], empty };
}
