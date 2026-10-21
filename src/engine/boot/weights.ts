/** Row weights are measured wall milliseconds, rather than equal legacy step counts. */
export interface WeightedLoadingRow { key: string; state: 'todo' | 'on' | 'ok'; ms: number; fraction?: number }
export interface LoadingTimingKey { tier: 'phone' | 'desktop'; path: string; identity: string }
export type LoadingTimings = Readonly<Record<string, number>>;
export interface LoadingCalibration {
  tier: string; path: string; identity: string; source: string; samples: number; ms: LoadingTimings;
}
/** Missing measurements remain explicit fallbacks; a different path or identity cannot supply device history. */
export function loadingExpectations(steps: readonly { key: string; weight: number }[], baseline: LoadingTimings = {}, own: LoadingTimings = {}): Record<string, number> {
  return Object.fromEntries(steps.map(step => [step.key, Math.max(1, own[step.key] ?? baseline[step.key] ?? step.weight * 300)]));
}
/** Real counts drive counted stages; other running stages ease through their measured share. */
export function loadingFraction(rows: readonly WeightedLoadingRow[], expected: LoadingTimings, complete = false): number {
  if (complete) return 1;
  let earned = 0, total = 0;
  for (const row of rows) {
    const ms = Math.max(1, expected[row.key] ?? 300);
    const running = typeof row.fraction === 'number' && Number.isFinite(row.fraction)
      ? Math.max(0, row.fraction) : -Math.expm1(-row.ms / ms);
    total += ms;
    earned += ms * (row.state === 'ok' ? 1 : row.state === 'on' ? Math.min(1 - Number.EPSILON, running) : 0);
  }
  return total > 0 ? Math.min(1 - Number.EPSILON, earned / total) : 0;
}
/** Blend like-for-like local runs; zero-duration completed rows retain a one-millisecond weight. */
export function blendLoadingTimings(previous: LoadingTimings, measured: LoadingTimings): Record<string, number> {
  return Object.fromEntries(Object.entries(measured).filter(([, ms]) => Number.isFinite(ms) && ms >= 0).map(([key, ms]) => {
    const before = previous[key], next = Math.max(1, ms);
    return [key, before === undefined ? next : (before + next) / 2];
  }));
}
export const loadingTimingKey = (key: LoadingTimingKey): string => `boot.path.times:${key.tier}:${key.path}:${key.identity}`;
