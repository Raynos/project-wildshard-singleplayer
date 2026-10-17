import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/driftwood-isle/data/runtimeMirrors';
import * as runtimeConst from '../src/shards/driftwood-isle/runtime/const';
import { ISLAND_KNOBS } from '../src/shards/driftwood-isle/generators/tiers';
import { driftwoodTierShadows, driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { _buildAs } from '../src/engine/core/tier';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/generators/modelFiles';
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_OUTPUT, DRIFTWOOD_FIXED_SOURCES as NAMED_MODELS } from '../src/shards/driftwood-isle/generators/assets';

// P2a spec §2.3 / review item 8: Driftwood's runtime/const.ts copies must equal the data/ values they mirror.
test('Driftwood runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});

test('admitted shadow tiers retain both original view choices', () => {
  admitDriftwoodFixtureRows();
  const rows = driftwoodRows('custom/fixedLayouts').shadowTiers;
  try {
    for (const tier of ['phone','desktop'] as const) {
      _buildAs(tier);
      expect(driftwoodTierShadows()).toBe(rows[tier]);
      expect(driftwoodTierShadows()).toEqual({bush:ISLAND_KNOBS[tier].bushShadows,boulder:ISLAND_KNOBS[tier].boulderShadows});
    }
  } finally { _buildAs(null); }
});

test('all 86 named fixed draws retain the assembler identities and admitted blobs', () => {
  const source: Readonly<Record<string, string>> = FIXED_MODEL_FILES;
  const names = new Set(DRIFTWOOD_OUTPUT.blobs.map(row => row.name));
  expect(Object.keys(NAMED_MODELS)).toHaveLength(86);
  expect(Object.keys(NAMED_MODELS)).toEqual(Object.keys(FIXED_MODEL_FILES));
  for (const [key, name] of Object.entries(NAMED_MODELS)) {
    const url = source[key];
    if (url === undefined) throw new Error('Missing authored source draw');
    expect(name).toBe(DRIFTWOOD_ASSET_NAMES[url]);
    expect(names.has(name)).toBe(true);
    expect(name.slice(name.lastIndexOf('/') + 1, -4)).toBe(url.slice(url.lastIndexOf('/') + 1, -4));
  }
});
