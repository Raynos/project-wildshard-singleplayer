/** Authored collectible parts occupy contiguous vertex ranges in the kit's build order. */
export interface SlotRange { readonly start: number; readonly count: number }

/** Record original non-indexed ranges as geometry grows; no live geometry or renderer is needed. */
export function recordVertexSlots(counter: { readonly triangleCount: number }): {
  readonly ranges: SlotRange[]; mark: () => number;
} {
  const ranges: SlotRange[] = [];
  let at = counter.triangleCount * 3;
  return { ranges, mark: () => {
    const end = counter.triangleCount * 3;
    ranges.push({ start: at, count: end - at });
    at = end;
    return ranges.length - 1;
  } };
}
