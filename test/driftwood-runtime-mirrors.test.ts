import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/driftwood-isle/data/runtimeMirrors';
import * as runtimeConst from '../src/shards/driftwood-isle/runtime/const';
import { ISLAND_KNOBS } from '../src/shards/driftwood-isle/tiers';
import { ISLAND_KNOBS as RUNTIME_ISLAND_KNOBS } from '../src/shards/driftwood-isle/runtime/tiers';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/data/modelFiles';
import { FIXED_MODEL_FILES as NAMED_MODELS } from '../src/shards/driftwood-isle/runtime/const';
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_OUTPUT } from '../src/shards/driftwood-isle/data/output';
import { DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES } from '../src/shards/driftwood-isle/data/bootFiles';
import { GPU_FILES } from '../src/shards/driftwood-isle/ktx2.generated';
import { resolveBootSources } from '../src/engine/boot/filePolicy';
import { bootSources } from '../src/shards/driftwood-isle/runtime/boot/sources';

// P2a spec §2.3 / review item 8: Driftwood's runtime/const.ts copies must equal the data/ values they mirror.
test('Driftwood runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});

// The runtime models read runtime/tiers.ts; the build-time generators still read the legacy root tiers.ts.
test('Driftwood runtime/tiers.ts mirrors the root tier knobs exactly', () => {
  expect(RUNTIME_ISLAND_KNOBS).toEqual(ISLAND_KNOBS);
});

test('all 83 named fixed draws retain the assembler identities and admitted blobs', () => {
  const source: Readonly<Record<string, string>> = FIXED_MODEL_FILES;
  const names = new Set(DRIFTWOOD_OUTPUT.blobs.map(row => row.name));
  expect(Object.keys(NAMED_MODELS)).toHaveLength(83);
  expect(Object.keys(NAMED_MODELS)).toEqual(Object.keys(FIXED_MODEL_FILES));
  for (const [key, name] of Object.entries(NAMED_MODELS)) {
    const url = source[key];
    if (url === undefined) throw new Error('Missing authored source draw');
    expect(name).toBe(DRIFTWOOD_ASSET_NAMES[url]);
    expect(names.has(name)).toBe(true);
    expect(name.slice(name.lastIndexOf('/') + 1, -4)).toBe(url.slice(url.lastIndexOf('/') + 1, -4));
  }
});

test('both tier and texture choices retain every ordered public boot source', () => {
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    expect(bootSources(tier, mode)).toEqual(resolveBootSources(DRIFTWOOD_BOOT_FILES, DRIFTWOOD_BOOT_SOURCES, tier, mode, GPU_FILES));
  }
});
