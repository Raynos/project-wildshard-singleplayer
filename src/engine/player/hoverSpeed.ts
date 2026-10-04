/** Board tuning port: standalone keeps 14 m/s; the grid may supply a finite cap up to 30 m/s. */
export function hoverSpeed(limit?: number): number {
  if (limit === undefined) return 14;
  if (!Number.isFinite(limit) || limit <= 0 || limit > 30) throw new RangeError('Invalid hover speed cap');
  return limit;
}
