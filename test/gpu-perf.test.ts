import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createProbeNav } from '../src/engine/debug/probe';
import { memoryVerdict, parseMemoryRun, flakedFields } from '../scripts/gpu-perf/report.mjs';

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

describe('probe navmesh adapter', () => {
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

describe('flake tally', () => {
  it('tallies F2 retry fields once per shard and tier', () => {
    expect(flakedFields({ boot: { shard: 'pine-hollow', tier: 'phone' }, flaked: ['poses.cabin.ssim'], fields: [{ field: 'poses.cabin.ssim', verdict: 'flaked' }] })).toEqual(['pine-hollow/phone/poses.cabin.ssim']);
  });
});
