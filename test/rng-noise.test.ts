// src/core/rng.ts + src/core/noise.ts — every tree, rock, herd and hill in a shard derives from these two, and the
// baked terrain (public/assets/baked/*/terrain.bin) is only valid while they produce the same numbers.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Noise2D, clamp, lerp, smoothstep } from '../src/core/noise';

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng.next());

describe('Rng (mulberry32)', () => {
  it('is deterministic: the same seed replays the same stream', () => {
    expect(take(new Rng(1337), 1000)).toEqual(take(new Rng(1337), 1000));
  });

  it('pins the first outputs for seed 1337 (a change here re-shuffles every shard)', () => {
    const r = new Rng(1337);
    expect([r.next(), r.next(), r.next()]).toEqual([0.1844118325971067, 0.18998925131745636, 0.8104719922412187]);
  });

  it('different seeds give different streams', () => {
    expect(take(new Rng(1), 8)).not.toEqual(take(new Rng(2), 8));
  });

  it('coerces the seed to uint32', () => {
    expect(take(new Rng(-1), 16)).toEqual(take(new Rng(0xffffffff), 16));
    expect(take(new Rng(2 ** 32 + 5), 16)).toEqual(take(new Rng(5), 16));
  });

  it('next() stays in [0, 1) with a mean near 0.5', () => {
    const xs = take(new Rng(42), 20000);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('range(a, b) stays in [a, b)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 2000; i++) { const v = r.range(-3, 5); expect(v).toBeGreaterThanOrEqual(-3); expect(v).toBeLessThan(5); }
  });

  it('int(a, b) is inclusive at both ends and hits every value', () => {
    const r = new Rng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) { const v = r.int(2, 6); expect(Number.isInteger(v)).toBe(true); seen.add(v); }
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
  });

  it('pick() returns members and reaches all of them', () => {
    const r = new Rng(11);
    const arr = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) { const v = r.pick(arr); expect(arr).toContain(v); seen.add(v); }
    expect(seen.size).toBe(3);
  });
});

describe('Noise2D (seeded simplex)', () => {
  it('is deterministic per seed', () => {
    const a = new Noise2D(1337), b = new Noise2D(1337);
    for (let i = 0; i < 200; i++) { const x = i * 0.37 - 20, y = i * 0.53 + 3; expect(a.get(x, y)).toBe(b.get(x, y)); }
  });

  it('pins sample values for seed 1337 (the baked Pine Hollow terrain depends on them)', () => {
    const n = new Noise2D(1337);
    expect(n.get(12.3, 45.6)).toBe(-0.19119303002064056);
    expect(n.fbm(0.37, -1.2)).toBe(-0.2651998145897217);
    expect(n.ridged(3.3, 4.4)).toBe(0.16717672710621312);
  });

  it('different seeds give different fields', () => {
    const a = new Noise2D(1), b = new Noise2D(2);
    let differ = 0;
    for (let i = 0; i < 50; i++) if (a.get(i * 0.71, i * 0.29) !== b.get(i * 0.71, i * 0.29)) differ++;
    expect(differ).toBeGreaterThan(40);
  });

  it('get / fbm stay in [-1, 1] and ridged in [0, 1]', () => {
    const n = new Noise2D(99);
    for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
      const x = i * 0.173 - 5, y = j * 0.211 + 7;
      const g = n.get(x, y), f = n.fbm(x, y), r = n.ridged(x, y);
      expect(Math.abs(g)).toBeLessThanOrEqual(1);
      expect(Math.abs(f)).toBeLessThanOrEqual(1);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: a tiny step moves the value a tiny amount', () => {
    const n = new Noise2D(5);
    for (let i = 0; i < 100; i++) {
      const x = i * 0.41, y = i * 0.17;
      expect(Math.abs(n.get(x + 1e-4, y) - n.get(x, y))).toBeLessThan(1e-2);
    }
  });

  it('is actually varied (not a constant field)', () => {
    const n = new Noise2D(3);
    const vs = Array.from({ length: 100 }, (_, i) => n.get(i * 0.37, i * 0.91));
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(0.5);
  });
});

describe('smoothstep / clamp / lerp', () => {
  it('smoothstep clamps outside the edges and is 0.5 at the middle', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBe(0.5);
  });

  it('smoothstep with reversed edges falls from 1 to 0 (used for "near → far" masks)', () => {
    expect(smoothstep(10, 0, 0)).toBe(1);
    expect(smoothstep(10, 0, 10)).toBe(0);
    expect(smoothstep(10, 0, 2)).toBeGreaterThan(smoothstep(10, 0, 8));
  });

  it('clamp and lerp', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
    expect(lerp(2, 6, 0)).toBe(2);
    expect(lerp(2, 6, 1)).toBe(6);
    expect(lerp(2, 6, 0.25)).toBe(3);
  });
});
