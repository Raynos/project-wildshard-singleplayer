import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { generated } from './fixtures/sunscar-source-program';

test('the source program retains every byte of the retired declaration handoff', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(generated.shard)}\n`);
  expect(bytes.length).toBe(196187);
  expect(hashImmutableBytes(bytes)).toBe('dcf9a22c356ac6a13abf921fb82a00b371cc79b8544d68dee6981c2618f8137b');
});
