import { describe, expect, it } from 'vitest';
import { parseMemoryRun, settledMemory, type SettledSample } from '../scripts/gpu-perf/report.mjs';

const sample = (seconds: number, nativeGB: number): SettledSample => ({ seconds, nativeGB, inspectorGB: nativeGB + 0.2 });
const native = (peak: number) => JSON.stringify({ type: 'summary', phases: { play: { gameHighGB: peak } }, lost: [] });
const inspector = (samples: SettledSample[]) => [
  { kind: 'settled', phase: 'play', result: settledMemory(samples) },
  { kind: 'summary', result: { inspectorPeakGB: { play: 0.9 } } },
].map((row) => JSON.stringify(row)).join('\n');

describe('Simulator phase settling', () => {
  it('takes the median of the last three samples, so one phase-entry spike drops out (E388: no settle tolerance)', () => {
    const spiked = settledMemory([sample(1, 0.589), sample(2, 0.439), sample(3, 0.440)]);
    expect(spiked?.nativeGB).toBe(0.440);
    expect(spiked?.spreadGB).toBeCloseTo(0.15);
    const readings = [sample(1, 0.589), sample(2, 0.439), sample(3, 0.440), sample(4, 0.438)];
    expect(settledMemory(readings.slice(0, 2))).toBeNull();
    const result = settledMemory(readings);
    expect(result?.nativeGB).toBe(0.439);
    expect(result?.inspectorGB).toBeCloseTo(0.639);
    expect(result?.minGB).toBe(0.438);
    expect(result?.maxGB).toBe(0.440);
    expect(result?.spreadGB).toBeCloseTo(0.002);
    expect(result?.spreadPercent).toBeCloseTo(0.002 / 0.439 * 100);
    expect(result?.samples).toEqual(readings.slice(1));
    expect(result?.seconds).toBe(4);
  });

  it('rejects incomplete or invalid readings', () => {
    expect(settledMemory([sample(20, 0.4), sample(21, 0.4)])).toBeNull();
    expect(settledMemory([sample(18, 0.4), sample(19, Number.NaN), sample(20, 0.4)])).toBeNull();
    expect(settledMemory([sample(18, 0.4), sample(19, 0.4), { seconds: 20, nativeGB: 0.4, inspectorGB: 0 }])).toBeNull();
  });

  it('uses the median, reports growth without gating it (E388) and retains the native peak', () => {
    const readings = [sample(1, 0.589), sample(2, 0.439), sample(3, 0.440), sample(4, 0.438)];
    const row = parseMemoryRun(native(0.589), inspector(readings), 'nine', { play: 0.4 }).find((entry) => entry.phase === 'play');
    expect(row?.verdict).toBe('success');
    expect(row?.nativeGB).toBe(0.439);
    expect(row?.nativePeakGB).toBe(0.589);
    expect(row?.measurement).toBe('settled-median-3');
    expect(row?.settling?.spreadGB).toBeCloseTo(0.002);
    const grown = parseMemoryRun(native(0.589), inspector(readings), 'nine', { play: 0.39 }).find((entry) => entry.phase === 'play');
    expect(grown?.verdict).toBe('success');
    expect(grown?.reason).toBe('within the device limit');
  });

  it('still fails an absolute-cap spike even when the settled median is low and growth is pending', () => {
    const readings = [sample(1, 0.439), sample(2, 0.440), sample(3, 0.438)];
    const row = parseMemoryRun(native(1.001), inspector(readings), 'nine', { play: 0.4 }, [{ fields: ['memory.nine.play'] }]).find((entry) => entry.phase === 'play');
    expect(row?.verdict).toBe('failure');
    expect(row?.reason).toBe('absolute limit');
  });

  it('requires the raw native peak as evidence for the absolute cap', () => {
    const readings = [sample(1, 0.439), sample(2, 0.440), sample(3, 0.438)];
    const incomplete = JSON.stringify({ type: 'summary', phases: {}, lost: [] });
    expect(parseMemoryRun(incomplete, inspector(readings), 'nine').find((row) => row.phase === 'play')?.reason).toBe('missing measurement');
  });
});
