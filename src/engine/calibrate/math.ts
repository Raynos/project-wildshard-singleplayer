export interface Point { n: number; ms: number }
export function median(values: readonly number[]): number {
  const a = [...values].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? 0;
}
/** Median pairwise slope resists one compilation/GC outlier without hiding the raw observations. */
export function slope(points: readonly Point[]): number {
  const slopes: number[] = [];
  for (const [i, a] of points.entries()) for (const b of points.slice(i + 1)) if (a.n !== b.n) slopes.push((b.ms - a.ms) / (b.n - a.n));
  const result = median(slopes);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`Calibration slope is unresolved: ${JSON.stringify(points)}`);
  return result;
}
