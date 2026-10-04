import { describe, expect, it } from 'vitest';
import { selectTier, parseTierPick, mobileDevice, type TierPick } from '../../src/engine/render/tierSelect';
import { gpuClass, GPU_CLASSES } from '../../src/engine/render/gpuClasses';
import { desktopFloor, DESKTOP_REFERENCE } from '../../src/engine/render/desktopReference';

const cached: TierPick = { v: 1, renderer: 'unknown', tier: 'desktop', via: 'bench', score: 800, at: 123 };
function fixture(renderer = 'unknown', score = 800) {
  let benchmarks = 0, rendererReads = 0;
  const options = { mobile: false, renderer: () => { rendererReads++; return renderer; }, cached: null, benchmark: () => { benchmarks++; return Promise.resolve(score); }, desktopFloor: 800, now: () => 123 };
  return { options, count: () => ({ benchmarks, rendererReads }) };
}
describe('GPU tier selection', () => {
  it('keeps harness overrides first and never probes phones or iPadOS', async () => {
    const f = fixture();
    expect(await selectTier({ ...f.options, mobile: true, harness: 'desktop' })).toMatchObject({ tier: 'desktop', via: 'harness' });
    expect(await selectTier({ ...f.options, mobile: true })).toMatchObject({ tier: 'phone', via: 'mobile' });
    expect(f.count()).toEqual({ benchmarks: 0, rendererReads: 0 });
    expect(mobileDevice('Mozilla iPhone', 'iPhone', 1)).toBe(true);
    expect(mobileDevice('Macintosh', 'MacIntel', 5)).toBe(true);
    expect(mobileDevice('Macintosh', 'MacIntel', 0)).toBe(false);
    expect(mobileDevice('Android', 'Linux', 1)).toBe(true);
  });
  it('preserves the existing explicit quality choice', async () => {
    const f = fixture('Intel UHD 630');
    expect(await selectTier({ ...f.options, preference: 'desktop' })).toMatchObject({ tier: 'desktop', via: 'setting' });
    expect(f.count().benchmarks).toBe(0);
  });
  it('reuses the same renderer and re-picks on GPU/driver change', async () => {
    const f = fixture();
    expect(await selectTier({ ...f.options, cached })).toMatchObject({ tier: 'desktop', pick: cached });
    expect(f.count().benchmarks).toBe(0);
    const changed = fixture('new driver', 799);
    expect(await selectTier({ ...changed.options, cached })).toMatchObject({ tier: 'phone', via: 'bench' });
    expect(changed.count().benchmarks).toBe(1);
  });
  it.each([
    ['NVIDIA GeForce GTX 1660 Ti', 'phone'], ['NVIDIA GeForce RTX 2060 SUPER', 'phone'],
    ['ANGLE NVIDIA GeForce RTX 3050', 'phone'], ['ANGLE NVIDIA GeForce RTX 3060 Direct3D11', 'desktop'],
    ['AMD Radeon RX 6600', 'phone'], ['AMD Radeon RX 6700 XT', 'desktop'], ['AMD Radeon RX 6800', 'desktop'],
  ] as const)('classifies %s through cited FP32 data', async (renderer, tier) => {
    const f = fixture(renderer);
    expect(await selectTier(f.options)).toMatchObject({ tier, via: 'table' });
    expect(f.count().benchmarks).toBe(0);
    expect(gpuClass(renderer)?.source).toMatch(/^https:\/\//);
  });
  it.each(['Apple GPU', 'Apple M1', 'Apple M2 Pro', 'Apple M3 Max', 'Apple M4 Max', 'ANGLE Metal Renderer: Apple M5 Max', 'Intel UHD 630', 'Intel Iris Xe', 'Intel Arc A770', 'AMD Radeon 780M', 'NVIDIA GeForce RTX 3060 Laptop GPU', 'RTX 4070 Max-Q'])('benchmarks ambiguous/power-variable %s', async (renderer) => {
    const f = fixture(renderer);
    expect(await selectTier(f.options)).toMatchObject({ tier: 'desktop', via: 'bench' });
    expect(f.count().benchmarks).toBe(1);
  });
  it('uses the inclusive measured floor, and persists only validated picks', async () => {
    expect(await selectTier(fixture('masked', 799.99).options)).toMatchObject({ tier: 'phone' });
    expect(await selectTier(fixture('masked', 800).options)).toMatchObject({ tier: 'desktop', pick: { renderer: 'masked', v: 1, score: 800, at: 123 } });
    expect(parseTierPick(cached)).toEqual(cached);
    expect(parseTierPick({ ...cached, score: Number.NaN })).toBeNull();
    expect(parseTierPick({ ...cached, tier: 'ultra' })).toBeNull();
    expect(parseTierPick({ ...cached, v: 2 })).toBeNull();
  });
  it('rejects missing throughput and documents the M5 projection above its floor', async () => {
    await expect(selectTier(fixture('masked', 0).options)).rejects.toThrow('positive');
    expect(DESKTOP_REFERENCE.m5Score).toBeGreaterThan(desktopFloor());
    expect(desktopFloor()).toBeCloseTo(762.2606794, 2);
    expect(GPU_CLASSES.every((row) => row.tflops > 0 && row.source.startsWith('https://'))).toBe(true);
  });
});
