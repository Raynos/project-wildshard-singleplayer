/** Plain Pine prop records; no runtime constructors or registry imports enter authoring. */
export type PropPose = [number, number, number, number, number, number, number, number];
/** Original ordered boulder, stump and fallen-log placement arrays. */
export interface PropRows { rocks: [number, 0 | 1, ...PropPose][]; stumps: PropPose[]; logs: PropPose[] }
/** Declared entry openings used by the original native scatter exclusion. */
export interface EntryLaneSource { readonly edge: 'north' | 'east' | 'south' | 'west'; readonly width: number }
/** Native fifty-metre entry-lane centre law, with the original strict comparisons. */
export function inEntryLanes(entries: readonly EntryLaneSource[], half: number, x: number, z: number, radius = 0): boolean {
  for (const entry of entries) {
    const ns = entry.edge === 'north' || entry.edge === 'south', sign = entry.edge === 'north' || entry.edge === 'east' ? 1 : -1;
    const lateral = ns ? x : z, depth = half - sign * (ns ? z : x);
    if (Math.abs(lateral) < entry.width / 2 + radius && depth > -radius && depth < 50 + radius) return true;
  }
  return false;
}
