import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalPhysics, SIGNAL_PHYSICS } from '../src/shards/sunscar-dunes/generators/physics';

// QB15 (2026-10-29): the well's crank crack radius 0.8 → 1.7 m and its use prompt 2.6 → 3.6 m are the only changed bytes
test('source physics preserves every original collider, actor, RNG seed and prompt byte', () => {
  for (const value of [signalPhysics(), SIGNAL_PHYSICS]) {
    const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
    expect(bytes.length).toBe(23200);
    expect(hashImmutableBytes(bytes)).toBe('26d5a61de784db45a723026dc7409bddb8870b811a1d088055a86fd2ac4d6b83');
  }
});
