import { describe, expect, it } from 'vitest';
import { memoryVerdict, parseMemoryRun, soakVerdict, type SoakSample } from '../scripts/gpu-perf/report.mjs';

describe('nightly memory gate', () => {
  it('uses decimal phase limits, inclusive boundaries, and the native footprint', () => {
    expect(memoryVerdict('a', 'loading', 1.8, 2, undefined).verdict).toBe('success');
    expect(memoryVerdict('a', 'play', 1.001, 0.5, undefined).reason).toBe('absolute limit');
    expect(memoryVerdict('a', 'explorer', 1, 0.5, undefined).verdict).toBe('success');
  });
  it('gates growth strictly above 10%, with a pending exception only below the limit', () => {
    const pending = [{ fields: ['memory.a.play'] }];
    expect(memoryVerdict('a', 'play', 0.88, 0.6, 0.8).verdict).toBe('success');
    expect(memoryVerdict('a', 'play', 0.881, 0.6, 0.8).verdict).toBe('failure');
    expect(memoryVerdict('a', 'play', 0.881, 0.6, 0.8, pending).verdict).toBe('pending');
    expect(memoryVerdict('a', 'explorer', 0.881, 0.6, 0.8, pending).verdict).toBe('failure');
    expect(memoryVerdict('a', 'play', 1.01, 0.6, 0.8, pending).verdict).toBe('failure');
  });
  it('fails closed on incomplete reports or lost WebContent', () => {
    expect(parseMemoryRun('', '', 'a').every((row) => row.verdict === 'failure')).toBe(true);
    const native = JSON.stringify({ type: 'summary', phases: { play: { gameHighGB: 0.6 } }, lost: [{ phase: 'play' }] });
    const inspector = JSON.stringify({ kind: 'summary', result: { inspectorPeakGB: { play: 0.5 } } });
    expect(parseMemoryRun(native, inspector, 'a').find((row) => row.phase === 'play')?.reason).toContain('WebContent lost');
    expect(memoryVerdict('a', 'play', Number.NaN, 0.5, 0.4).verdict).toBe('failure');
  });
});

const samples = (gpuPerSecond = 0): SoakSample[] => Array.from({ length: 41 }, (_, i) => ({
  seconds: i * 30, gpuBytes: 100_000_000 + i * 30 * gpuPerSecond, heapBytes: 10_000_000,
  geometries: 100, textures: 100, fps: i > 30 ? 15 : 60,
}));
describe('soak growth rules', () => {
  it('ignores startup growth and reports fps without gating it', () => {
    const rows = samples(); rows[0] = { seconds: 0, gpuBytes: 0, heapBytes: 0, geometries: 0, textures: 0, fps: 60 };
    expect(soakVerdict(rows).verdict).toBe('success');
    expect(soakVerdict(rows).fpsLast).toBe(15);
  });
  it('detects the 1 MiB/10 s leak plant with a least-squares window', () => {
    const result = soakVerdict(samples(1024 ** 2 / 10));
    expect(result.gpuGrowthBytes).toBeCloseTo(90 * 1024 ** 2);
    expect(result.failures).toContain('GPU-byte growth > 8 MiB');
  });
  it('fails errors, stuck states, missing tail, heap and resource growth', () => {
    expect(soakVerdict(samples().slice(0, 20)).verdict).toBe('failure');
    expect(soakVerdict(samples(), ['boom'], [{}]).failures).toContain('stuck states');
    const rows = samples();
    for (const row of rows) row.heapBytes = 10_000_000 + row.seconds * 2000;
    const last = rows.at(-1); if (last) last.textures = 106;
    expect(soakVerdict(rows).failures).toContain('heap growth > 10%');
    expect(soakVerdict(rows).failures).toContain('geometry/texture growth > 5%');
  });
});
