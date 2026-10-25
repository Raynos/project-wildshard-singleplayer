import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalPhysics, SIGNAL_PHYSICS } from '../src/shards/sunscar-dunes/generators/physics';

test('source physics preserves every original collider, actor, RNG seed and prompt byte', () => {
  for (const value of [signalPhysics(), SIGNAL_PHYSICS]) {
    const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
    expect(bytes.length).toBe(23200);
    expect(hashImmutableBytes(bytes)).toBe('bdbf2c00ba7f6dbc57a8b9e99cfed893b144a58099fa15501fbdd55be6e60cbc');
  }
});
