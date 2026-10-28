import { expect, test } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import original from './fixtures/nalati-taming-poses-original.json' with { type: 'json' };
import { nalatiTamingPoseRows } from '../src/shards/nalati-grasslands/generators/tamingPoseRows';

const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

test('the taming handoff retains its original pose-array pin and declared horse extension', () => {
  // d09828c5e6 intentionally added numeric horse drawing, changing the writer's
  // root from poses[] to {poses,horse}; its scheduler retained the array pin.
  const poses = bytes(original.poses), handoff = bytes(original);
  expect(poses.byteLength).toBe(32764);
  expect(hashImmutableBytes(poses)).toBe('44aa3290d263ba0b05ca743b2cc5ce89164c03074e6c8c642033436fffc4d7fe');
  expect(handoff.byteLength).toBe(85858);
  expect(hashImmutableBytes(handoff)).toBe('93d2101b641c092d213b0485dc9b831e0b809b56a5531d36fb9ddee66dd1a28a');
  expect(nalatiTamingPoseRows()).toEqual(original);
});
