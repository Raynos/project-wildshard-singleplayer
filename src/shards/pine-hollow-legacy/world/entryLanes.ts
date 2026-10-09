/** How far in from its edge an entry's lanes must walk clear: the entry proof's walk (runtime/entries.ts), the engine's edge
 *  walk's 50 m (physics/edgeEntries.ts). */
export const ENTRY_LANE_DEPTH = 50;

/** One declared entryway as the shardfile states it (its edge midpoint and opening width). */
export interface EntryLaneSource { readonly edge: 'north' | 'east' | 'south' | 'west'; readonly width: number }

/**
 * Does a solid standing at (x, z) (its centre, widened by `radius`) stand in a declared entry's lanes: within half the
 * opening's width of its midline and within `ENTRY_LANE_DEPTH` of its edge (the cell's rim `half` m from the centre)? The scatter keeps such solids out of the entry
 * canyons, so a player walking in from the grid's road meets nothing in the opening's 50 m; the entry proof (a real capsule
 * through every lane) guards what a centre test cannot see, a solid leaning in from beside the opening.
 */
export function inEntryLanes(entries: readonly EntryLaneSource[], half: number, x: number, z: number, radius = 0): boolean {
  for (const entry of entries) {
    const ns = entry.edge === 'north' || entry.edge === 'south', sign = entry.edge === 'north' || entry.edge === 'east' ? 1 : -1;
    const lateral = ns ? x : z, depth = half - sign * (ns ? z : x);
    if (Math.abs(lateral) < entry.width / 2 + radius && depth > -radius && depth < ENTRY_LANE_DEPTH + radius) return true;
  }
  return false;
}
