import { expect, it } from 'vitest';
import { blendLoadingTimings, loadingExpectations, loadingFraction, loadingTimingKey } from '../src/engine/boot/weights';

it('weights admission by measured time and keeps an overrunning stage below completion', () => {
  const expected = { admission: 9000, world: 1000 };
  const rows = [{ key: 'admission', state: 'ok', ms: 9000 }, { key: 'world', state: 'on', ms: 1000 }] as const;
  const fraction = loadingFraction(rows, expected);
  expect(fraction).toBeGreaterThan(0.9);
  expect(fraction).toBeLessThan(1);
  expect(loadingFraction([{ key: 'world', state: 'on', ms: 1_000_000 }], expected)).toBeLessThan(1);
  expect(loadingFraction(rows, expected, true)).toBe(1);
});

it('blends local measurements and keeps history separated by tier, path and identity', () => {
  expect(blendLoadingTimings({ world: 1000 }, { world: 3000, shaders: 100 })).toEqual({ world: 2000, shaders: 100 });
  expect(loadingExpectations([{ key: 'world', weight: 1 }], { world: 500 }, { world: 2000 })).toEqual({ world: 2000 });
  expect(blendLoadingTimings({ world: 500 }, { world: 2000 })).toEqual({ world: 1250 });
  const key = { tier: 'phone', path: 'grid', identity: 'coast' } as const;
  expect(new Set([loadingTimingKey(key), loadingTimingKey({ ...key, path: 'shardfile' }),
    loadingTimingKey({ ...key, identity: 'forest' }), loadingTimingKey({ ...key, tier: 'desktop' })]).size).toBe(4);
});
