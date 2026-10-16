import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/driftwood-isle/data/runtimeMirrors';
import * as runtimeConst from '../src/shards/driftwood-isle/runtime/const';
import { ISLAND_KNOBS } from '../src/shards/driftwood-isle/tiers';
import { ISLAND_KNOBS as RUNTIME_ISLAND_KNOBS } from '../src/shards/driftwood-isle/runtime/tiers';

// P2a spec §2.3 / review item 8: Driftwood's runtime/const.ts copies must equal the data/ values they mirror.
test('Driftwood runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});

// The runtime models read runtime/tiers.ts; the build-time generators still read the legacy root tiers.ts.
test('Driftwood runtime/tiers.ts mirrors the root tier knobs exactly', () => {
  expect(RUNTIME_ISLAND_KNOBS).toEqual(ISLAND_KNOBS);
});
