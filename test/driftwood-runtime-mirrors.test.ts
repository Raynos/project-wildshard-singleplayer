import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/driftwood-isle/data/runtimeMirrors';
import * as runtimeConst from '../src/shards/driftwood-isle/runtime/const';

// P2a spec §2.3 / review item 8: Driftwood's runtime/const.ts copies must equal the data/ values they mirror.
test('Driftwood runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});
