import { expect, test } from 'vitest';
import { heldPlayback } from '../src/shards/far-reach/generators/heldPlayback';
import { FAN_HELD_RECIPE } from '../src/shards/far-reach/generators/rows/heldWeapon';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('the held fan consumes current source channels and isolates caller mutations', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(heldPlayback())}\n`);
  const before = hashImmutableBytes(bytes());
  expect(FAN_HELD_RECIPE.playback).toEqual(heldPlayback());
  const changed = heldPlayback(); changed['swing']?.splice(0);
  expect(hashImmutableBytes(bytes())).toBe(before);
});
