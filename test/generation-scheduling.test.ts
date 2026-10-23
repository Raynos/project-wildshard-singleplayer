import { expect, test } from 'vitest';
import { defaultGenerationConcurrency, generationConcurrency, generationOrder } from '../scripts/generation-scheduling.mjs';

test('every default reserves four CPUs and clamps to one through four', () => {
  expect([1, 2, 4, 5, 6, 8, 18].map(defaultGenerationConcurrency)).toEqual([1, 1, 1, 1, 2, 4, 4]);
  expect(generationConcurrency(['--proof'], 18)).toBe(4);
  expect(generationConcurrency(['--build-inputs'], 4)).toBe(1);
  for (const cores of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => defaultGenerationConcurrency(cores)).toThrow('CPU count');
});

test('explicit CI concurrency stays four and ambiguous or unbounded requests refuse', () => {
  expect(generationConcurrency(['--parallel=4'], 4)).toBe(4);
  expect(generationConcurrency(['--parallel'], 4)).toBe(4);
  expect(generationConcurrency(['--parallel=2'], 18)).toBe(2);
  for (const args of [['--parallel=0'], ['--parallel=5'], ['--parallel=1.5'], ['--parallel=NaN'], ['--parallel', '--parallel=2']])
    expect(() => generationConcurrency(args, 18)).toThrow();
});

test('audited long work ranks first; equal and unknown work keeps catalogue ties', () => {
  expect(generationOrder(['unknown-a', 'nalati-species', 'nine-layout', 'open-plots-world', 'unknown-b'])).toEqual([2, 3, 1, 0, 4]);
  expect(generationOrder(['short', 'long', 'tie'], { short: 1, long: 5, tie: 5 })).toEqual([1, 2, 0]);
});
