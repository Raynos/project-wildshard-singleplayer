// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real SDK project reader at its defining author folder.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';


import { hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { decisionLegacyLines } from '../scripts/decision-legacy-lines.mjs';
import { navigation, generated } from './fixtures/sunscar-source-program';
import { SIGNAL_DUNES_MAP } from '../src/shards/sunscar-dunes/generators/minimap';
import { BUDGETS } from '../src/shards/sunscar-dunes/generators/rows/budgets';
import { SIGNAL_DEV_POSES } from '../src/shards/sunscar-dunes/generators/rows/devPoses';
import cues from '../src/shards/sunscar-dunes/data/cues.json' with { type: 'json' };
import { LATE_READS, BOOT_FILES, BOOT_SOURCES } from '../src/shards/sunscar-dunes/generators/rows/boot';
import { REST_URLS } from '../src/shards/sunscar-dunes/generators/rows/restFiles';
import { SAND_FILES } from '../src/shards/sunscar-dunes/generators/rows/sand';
import { DUNE_RIG_URLS, BAKED_URLS } from '../src/shards/sunscar-dunes/generators/rows/files';

test('computed discovery removes only the retired public rig/world/rest/skirt URLs in both tiers', () => {
  const rigs = new Set([...Object.values(DUNE_RIG_URLS), ...Object.values(BAKED_URLS), ...REST_URLS]);
  const expected = { tiers: { phone: { ...BOOT_SOURCES.tiers.phone, terrain: BOOT_SOURCES.tiers.phone.terrain.filter(url => url !== SAND_FILES.skirt), props: BOOT_SOURCES.tiers.phone.props.filter(url => !rigs.has(url)) },
    desktop: { ...BOOT_SOURCES.tiers.desktop, terrain: BOOT_SOURCES.tiers.desktop.terrain.filter(url => url !== SAND_FILES.skirt), props: BOOT_SOURCES.tiers.desktop.props.filter(url => !rigs.has(url)) } } };
  expect(generated.discovery).toEqual({ navigation, mapPalette: SIGNAL_DUNES_MAP, budgets: BUDGETS, poses: SIGNAL_DEV_POSES, audioCues: cues, 'boot.lateReads': LATE_READS, 'boot.sources': expected, 'boot.files': { ...BOOT_FILES, sources: expected } });
});

test('the SDK source entry admits its owned named resources', async () => {
  const lines = decisionLegacyLines(resolve('.'), 'sunscar-dunes');
  if (lines === undefined) throw new Error('Missing Sunscar decision line basis');
  const loaded = await readProjectAssets(resolve('src/shards/sunscar-dunes'), undefined, { folder: 'sunscar-dunes', imageRoots: [{ prefix: '/assets/', directory: resolve('public/assets') }] }, { decisionLegacyLines: lines });
  for (const file of loaded.output.namedFiles ?? []) {
    const bytes = loaded.assets.get(file.hash);
    if (bytes === undefined) throw new Error('Missing owned named resource');
    expect(bytes.byteLength).toBe(file.compressed);
    expect(hashImmutableBytes(bytes)).toBe(file.hash);
  }
  const map = loaded.output.namedFiles?.find(file => file.name === 'ui/map');
  expect(map).toBeDefined();
  expect(loaded.shard.map?.image).toBe(map?.hash);
});
