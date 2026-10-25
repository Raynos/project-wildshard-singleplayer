import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as layout from '../src/shards/sunscar-dunes/generators/layout';
import * as dunes from '../src/shards/sunscar-dunes/generators/duneRows';
import { SIGNAL_DUNES_MAP } from '../src/shards/sunscar-dunes/generators/minimap';

// The retired writer sorted only top-level export names; keep its complete wire
// bytes, including every derived point, trail, terrain input and palette mark.
for (const [label, rows, length, hash] of [
  ['layout', layout, 1921, 'e3f6d74bb9d4490cd0ebfc6de9e08d6c2841c87a9533af89b1e4b0f0ce8a84b4'],
  ['dunes', dunes, 1537, 'fd51144d056a86d962aaa992a7bc57ac6ab796d27f9f03fa6ec64a60cb3aac42'],
  ['palette', SIGNAL_DUNES_MAP, 3095, '15b0b3239026b8cf451de71cd9dbe19325137dfa747dec30de0c61eb151b448a'],
] as const) {
  test(`source ${label} retains every original fixed-layout byte`, () => {
    const value = Object.fromEntries(Object.entries(rows).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
    expect(bytes.length).toBe(length);
    expect(hashImmutableBytes(bytes)).toBe(hash);
  });
}
