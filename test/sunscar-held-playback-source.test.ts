import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { heldPlayback } from '../src/shards/sunscar-dunes/generators/heldPlayback';

test('source playback retains every original grip, root and cord expression byte', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(heldPlayback())}\n`);
  expect(bytes.length).toBe(3156);
  expect(hashImmutableBytes(bytes)).toBe('268272fdab9fee58e982376c539a3c08111fba2b2dfeb5b4589b48f3b55e66c5');
});
