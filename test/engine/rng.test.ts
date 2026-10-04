import { describe, expect, it } from 'vitest';
import { Rng, RngService, fnv1a32, pageSeed } from '../../src/engine/core/rng';

// The pre-F8 recurrence, independent of the merged class; its state progression is part of the world data.
function legacy(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
describe('the one RNG', () => {
  it('pins 1,000 old core and facade draws for three seeds', () => {
    for (const seed of [0, 1, 0xffffffff]) {
      const core = new Rng(seed), facade = Rng.scrambled(seed);
      const oldCore = legacy(seed), oldFacade = legacy((seed * 2654435761) >>> 0);
      for (let i = 0; i < 1000; i++) {
        expect(core.next()).toBe(oldCore());
        expect(facade.next()).toBe(oldFacade());
      }
    }
  });
  it('preserves facade numeric fork scrambling after prior draws', () => {
    const parent = Rng.scrambled(31);
    for (let i = 0; i < 7; i++) parent.next();
    const state = (((31 * 2654435761) >>> 0) + 7 * 0x6d2b79f5) >>> 0;
    const old = legacy((((state ^ Math.imul(901, 0x9e3779b1)) >>> 0) * 2654435761) >>> 0);
    const child = parent.fork(900);
    for (let i = 0; i < 1000; i++) expect(child.next()).toBe(old());
  });
  it('seeds independent named streams and reproducible string forks', () => {
    const a = new RngService(42), b = new RngService(42);
    for (let i = 0; i < 100; i++) a.stream('cosmetic').next();
    for (const stream of ['gameplay', 'ai', 'loot', 'spawn'] as const) {
      const expected = new Rng(fnv1a32(`42:${stream}`));
      for (let i = 0; i < 10; i++) expect(a.stream(stream).next()).toBe(expected.next());
    }
    a.seed(42);
    expect(a.stream('gameplay').next()).toBe(b.stream('gameplay').next());
    const p = new Rng(42), q = new Rng(42);
    p.next();
    expect(p.fork('ai').next()).toBe(q.fork('ai').next());
    expect(pageSeed(99, 0)).toBe(0);
  });
  it('keeps the core empty-pick rule and supports facade weighted choices', () => {
    expect(new Rng(1).pick([])).toBeUndefined();
    expect(new Rng(1).weighted([['one', 1], ['zero', 0]])).toBe('one');
    expect(() => new Rng(1).weighted([])).toThrow('empty list');
    expect(new Rng(1).int(2, 2)).toBe(2);
    expect(new Rng(1).chance(1)).toBe(true);
  });
});
