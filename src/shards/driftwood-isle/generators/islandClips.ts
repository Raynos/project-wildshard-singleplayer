import ISLAND_GRID from '../data/islandClipRows.json' with { type: 'json' };

/** Retained index runs of the native grid outside the authored baked island. */
export function islandClipFacts(grid: { vertices: number; x0: number; x1: number; z0: number; z1: number } = ISLAND_GRID): { sourceVertices: number; sourceIndices: number; outputIndices: number; ranges: { start: number; count: number }[] } {
  const n = grid.vertices - 1, ranges: { start: number; count: number }[] = [];
  const { x0, x1, z0, z1 } = grid;
  if (x0 < 0 || x1 > n || x1 <= x0 || z0 < 0 || z1 > n || z1 <= z0) throw new Error('Baked island lies outside its terrain grid');
  const add = (start: number, count: number): void => {
    if (count === 0) return;
    const previous = ranges.at(-1);
    if (previous !== undefined && previous.start + previous.count === start) previous.count += count;
    else ranges.push({ start, count });
  };
  for (let z = 0; z < n; z++) {
    if (z < z0 || z >= z1) add(z * n * 6, n * 6);
    else { add(z * n * 6, x0 * 6); add((z * n + x1) * 6, (n - x1) * 6); }
  }
  return { sourceVertices: grid.vertices ** 2, sourceIndices: n * n * 6,
    outputIndices: ranges.reduce((sum, row) => sum + row.count, 0), ranges };
}

/** The native grid's index with the baked island's cells dropped (its terrain tiles stand there), the retained runs in
 *  order, so every kept triangle keeps its provoking vertex. */
export function islandClippedIndex(index: ArrayLike<number>, clip = islandClipFacts()): Uint16Array {
  if (index.length !== clip.sourceIndices) throw new Error('Baked island terrain topology differs');
  const out = new Uint16Array(clip.outputIndices); let at = 0;
  for (const { start, count } of clip.ranges) for (let i = start; i < start + count; i++) out[at++] = index[i] ?? 0;
  return out;
}
