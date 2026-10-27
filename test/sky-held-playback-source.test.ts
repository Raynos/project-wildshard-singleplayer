import { expect, test } from 'vitest';
import { heldPlayback } from '../src/shards/far-reach/generators/heldPlayback';
import { FAN_HELD_RECIPE } from '../src/shards/far-reach/generators/rows/heldWeapon';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('the held fan consumes complete original source channels without a scheduler handoff', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(heldPlayback())}\n`);
  expect(bytes().byteLength).toBe(11_155);
  expect(hashImmutableBytes(bytes())).toBe('0de0615987f8d44b9fc1bcf36e98c0778b169f80f6b650372ebe1ce808c94c27');
  expect(FAN_HELD_RECIPE.playback).toEqual(heldPlayback());
  const changed = heldPlayback(); changed['swing']?.splice(0);
  expect(hashImmutableBytes(bytes())).toBe('0de0615987f8d44b9fc1bcf36e98c0778b169f80f6b650372ebe1ce808c94c27');
});
