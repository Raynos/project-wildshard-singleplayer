import { expect, test } from 'vitest';
import { driftwoodFixedBank } from './fixtures/driftwood-fixed-bank';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/driftwood-faceted-author-original.json' with { type: 'json' };

test('owned faceted authors retain every original fixed, tile, layout and terrain byte', async () => {
  const files = await driftwoodFixedBank();
  expect([...files].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: hashImmutableBytes(bytes) }))).toEqual(original);
});
