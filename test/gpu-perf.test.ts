import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createProbeNav } from '../src/engine/debug/probe';
import { memoryVerdict, parseMemoryRun, soakLimits, soakVerdict, flakedFields, type SoakSample } from '../scripts/gpu-perf/report.mjs';

describe('nightly memory gate', () => {
  it('uses decimal phase limits, inclusive boundaries, and the native footprint', () => {
    expect(memoryVerdict('a', 'loading', 1.8, 2, undefined).verdict).toBe('success');
    expect(memoryVerdict('a', 'play', 1.001, 0.5, undefined).reason).toBe('absolute limit');
    expect(memoryVerdict('a', 'explorer', 1, 0.5, undefined).verdict).toBe('success');
  });
  it('reports growth but fails only on the device limit (E388: no invented growth band)', () => {
    const pending = [{ fields: ['memory.a.play'] }];
    const grown = memoryVerdict('a', 'play', 0.96, 0.6, 0.8);
    expect(grown.verdict).toBe('success'); expect(grown.growth).toBeCloseTo(0.2);
    expect(memoryVerdict('a', 'explorer', 0.99, 0.6, 0.5, pending).verdict).toBe('success');
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

describe('soak navmesh adapter', () => {
  it('uses an independent seeded stream and serializable corners on the player radius layer', () => {
    const mesh = {
      randomPointNear: (_near: Vector3 | { x: number; y: number; z: number }, distance: number, radius: number, rand: () => number) => { expect(radius).toBe(0.38); return new Vector3(distance, rand(), 0); },
      findPath: (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, radius: number) => { expect(radius).toBe(0.38); return [new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z)]; },
    };
    const a = createProbeNav(mesh, 7), b = createProbeNav(mesh, 7), origin = { x: 0, y: 0, z: 0 };
    const target = a.randomPoint(origin, 30, 80);
    expect(target).toEqual(b.randomPoint(origin, 30, 80));
    if (!target) throw new Error('expected reachable target');
    expect(a.path(origin, target)).toEqual([origin, target]);
    expect(a.path(origin, target)?.[0]).not.toBeInstanceOf(Vector3);
  });
  it('rejects out-of-band navcat points and handles absent paths', () => {
    const mesh = { randomPointNear: () => new Vector3(1, 0, 0), findPath: () => null };
    const nav = createProbeNav(mesh, 1), origin = { x: 0, y: 0, z: 0 };
    expect(nav.randomPoint(origin, 30, 80)).toBeNull();
    expect(nav.path(origin, origin)).toBeNull();
    expect(() => nav.randomPoint(origin, 80, 30)).toThrow(RangeError);
  });
});

const samples = (gpuPerSecond = 0): SoakSample[] => Array.from({ length: 41 }, (_, i) => ({
  seconds: i * 30, gpuBytes: 100_000_000 + i * 30 * gpuPerSecond, heapBytes: 10_000_000,
  geometries: 100, textures: 100, fps: i > 30 ? 15 : 60,
}));
// E388: three clean soaks of the shard set every growth limit (median + 2 × spread); no invented limit remains.
const clean = [
  { gpuGrowthBytes: 0, heapGrowthBytes: 10_000, geometryGrowth: 0, textureGrowth: 0 },
  { gpuGrowthBytes: 2 * 1024 ** 2, heapGrowthBytes: 30_000, geometryGrowth: 1, textureGrowth: 0 },
  { gpuGrowthBytes: 1024 ** 2, heapGrowthBytes: 20_000, geometryGrowth: 0, textureGrowth: 1 },
];
describe('soak growth rules', () => {
  it('derives each limit from the clean soaks: their median + 2 × their spread', () => {
    const limits = soakLimits(clean);
    expect(limits?.['gpuGrowthBytes']).toEqual({ median: 1024 ** 2, spread: 2 * 1024 ** 2, limit: 5 * 1024 ** 2, runs: 3 });
    expect(limits?.['heapGrowthBytes']?.limit).toBe(60_000);
    expect(limits?.['textureGrowth']?.limit).toBe(2);
    expect(soakLimits([])).toBeNull();
    expect(soakLimits([{ gpuGrowthBytes: 0 }])).toBeNull();
  });
  it('ignores startup growth and reports fps without gating it', () => {
    const rows = samples(); rows[0] = { seconds: 0, gpuBytes: 0, heapBytes: 0, geometries: 0, textures: 0, fps: 60 };
    expect(soakVerdict(rows, [], [], clean).verdict).toBe('success');
    expect(soakVerdict(rows, [], [], clean).fpsLast).toBe(15);
  });
  it('detects the 1 MiB/10 s leak plant with a least-squares window', () => {
    const result = soakVerdict(samples(1024 ** 2 / 10), [], [], clean);
    expect(result.gpuGrowthBytes).toBeCloseTo(90 * 1024 ** 2);
    expect(result.failures.some((failure) => failure.startsWith('gpuGrowthBytes '))).toBe(true);
  });
  it('fails without a clean reference rather than guessing a limit', () => {
    expect(soakVerdict(samples(), [], []).failures).toEqual(['no clean soak reference for this shard (budgets/soak-reference.json)']);
  });
  it('fails errors, stuck states, missing tail, heap and resource growth', () => {
    expect(soakVerdict(samples().slice(0, 20), [], [], clean).verdict).toBe('failure');
    expect(soakVerdict(samples(), ['boom'], [{}], clean).failures).toContain('stuck states');
    const rows = samples();
    for (const row of rows) row.heapBytes = 10_000_000 + row.seconds * 2000;
    const last = rows.at(-1); if (last) last.textures = 106;
    const failures = soakVerdict(rows, [], [], clean).failures;
    expect(failures.some((failure) => failure.startsWith('heapGrowthBytes '))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('textureGrowth 6 > 2 '))).toBe(true);
  });
  it('fails closed on invalid byte or resource measurements', () => {
    const rows = samples(); const first = rows[0]; if (first) first.gpuBytes = Number.NaN;
    expect(soakVerdict(rows, [], [], clean).failures).toContain('invalid sample measurement');
  });
  it('tallies F2 retry fields once per shard and tier', () => {
    expect(flakedFields({ boot: { shard: 'pine-hollow', tier: 'phone' }, flaked: ['poses.cabin.ssim'], fields: [{ field: 'poses.cabin.ssim', verdict: 'flaked' }] })).toEqual(['pine-hollow/phone/poses.cabin.ssim']);
  });
});
