import { expect, it } from 'vitest';
import { Rng as RuntimeRng } from '../src/engine/core/rng';
import { Rng, type RngState } from '@wildshard/sdk/random';

it('preserves runtime Mulberry32 draws, continuation and both fork modes exactly', () => {
  for (const scrambled of [false, true]) for (const seed of [0, 1, 9, 17, 301, -1, 0x9d2a, 0xffffffff]) {
    const old = scrambled ? RuntimeRng.scrambled(seed) : new RuntimeRng(seed);
    const author = scrambled ? Rng.scrambled(seed) : new Rng(seed);
    for (let tick = 0; tick < 500; tick++) {
      expect(author.next()).toBe(old.next());
      expect(author.range(-25, 250)).toBe(old.range(-25, 250));
      expect(author.int(-8, 16)).toBe(old.int(-8, 16));
      expect(author.pick(['a', 'b', 'c'])).toBe(old.pick(['a', 'b', 'c']));
      expect(author.chance(0.26)).toBe(old.chance(0.26));
      expect(author.weighted([['a', 0.3], ['b', 0.5], ['c', 0.2]])).toBe(old.weighted([['a', 0.3], ['b', 0.5], ['c', 0.2]]));
      for (const salt of [900 + tick, 'facade:九龍']) {
        const a = author.fork(salt), b = old.fork(salt);
        expect(a.snapshot()).toEqual(b.snapshot());
        expect(a.next()).toBe(b.next());
      }
      if (tick % 97 === 0) {
        const saved: RngState = old.snapshot();
        author.restore(saved); old.restore(saved);
      }
      expect(author.snapshot()).toEqual(old.snapshot());
      expect(JSON.stringify(author.snapshot())).toBe(JSON.stringify(old.snapshot()));
    }
  }
  expect(() => new Rng(1).weighted([])).toThrow('Rng.weighted on an empty list');
  expect(new Rng(1).pick([])).toBeUndefined();
});
