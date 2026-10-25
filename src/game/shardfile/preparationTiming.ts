import { diagnosticNow } from '@wildshard/engine/core/clock';
import { isDev } from '@wildshard/engine/core/devMode';

/** Developer-only spans retain one result per product/step, including failed preparation. */
export async function timeClientPreparation<T>(slug: string, step: string, work: () => T | Promise<T>): Promise<T> {
  if (!isDev()) return work();
  const name = `wildshard.prepare:${slug}:${step}`, start = diagnosticNow();
  try { return await work(); }
  finally {
    performance.clearMeasures(name);
    performance.measure(name, { start, end: diagnosticNow() });
  }
}

interface PreparationPhase { start: number | undefined; end: number; calls: number; failures: number; elapsedMs: number; longestMs: number }
interface PreparationBatch<Phase extends string> {
  readonly run: <T>(phase: Phase, work: () => Promise<T>) => Promise<T>;
  readonly sync: <T>(phase: Phase, work: () => T) => T;
  readonly finish: () => void;
}
/** Developer-only, bounded phase totals for a multi-file preparation. Await all work before finish().
 * Each measure spans its first call through its last; detail.elapsedMs sums the individual elapsed calls,
 * including async waits, and is not CPU time. Public mode allocates no batch and reads no clocks. */
export function clientPreparationBatch<Phase extends string>(slug: string, step: string, phases: readonly Phase[]): PreparationBatch<Phase> | undefined {
  if (!isDev()) return undefined;
  const rows = new Map<Phase, PreparationPhase>(phases.map(phase => [phase, { start: undefined, end: 0, calls: 0, failures: 0, elapsedMs: 0, longestMs: 0 }]));
  let finished = false;
  const begin = (phase: Phase) => {
    if (finished) throw new Error('Client preparation batch is finished');
    const row = rows.get(phase);
    if (row === undefined) throw new Error('Unknown client preparation phase');
    return row;
  };
  const record = (row: PreparationPhase, start: number, failed: boolean): void => {
    const end = diagnosticNow(), elapsed = end - start;
    row.start = row.start === undefined ? start : Math.min(row.start, start); row.end = Math.max(row.end, end);
    row.calls++; row.failures += failed ? 1 : 0; row.elapsedMs += elapsed; row.longestMs = Math.max(row.longestMs, elapsed);
  };
  return {
    run: async (phase, work) => {
      const row = begin(phase), start = diagnosticNow(); let failed = true;
      try { const result = await work(); failed = false; return result; }
      finally { record(row, start, failed); }
    },
    sync: (phase, work) => {
      const row = begin(phase), start = diagnosticNow(); let failed = true;
      try { const result = work(); failed = false; return result; }
      finally { record(row, start, failed); }
    },
    finish: () => {
      if (finished) return; finished = true;
      for (const [phase, row] of rows) {
        const name = `wildshard.prepare:${slug}:${step}.${phase}`;
        performance.clearMeasures(name);
        if (row.start !== undefined) performance.measure(name, { start: row.start, end: row.end,
          detail: { calls: row.calls, failures: row.failures, elapsedMs: row.elapsedMs, longestMs: row.longestMs } });
      }
    },
  };
}
