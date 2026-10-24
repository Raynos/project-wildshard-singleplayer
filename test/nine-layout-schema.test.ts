import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { layoutWireSchema } from '../src/shards/nine-dragon-stack/generators/layoutBlobs';

test('direct schema projection retains the complete original Nine layout contract', () => {
  // Original nine-section-schemas output, excluding only its trailing newline.
  const bytes = new TextEncoder().encode(JSON.stringify(layoutWireSchema()));
  expect(bytes.length).toBe(14189);
  expect(hashImmutableBytes(bytes)).toBe('3956e282a974860007f0f1ffe551da8c68fde0d7369878fc97b697942298c86b');
});
