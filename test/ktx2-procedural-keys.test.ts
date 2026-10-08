// oxlint-disable-next-line import/no-nodejs-modules -- This CLI fixture writes an isolated built asset inventory.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary build fixtures belong in the host's scratch directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- CLI fixtures resolve host paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { checkAssetCase } from '../scripts/check-asset-case.mjs';
import { splitKtx2 } from '../scripts/ktx2-tables.mjs';
import { registerGpuFiles, standIn } from '../src/engine/boot/gpuFiles';
import { TIER } from '../src/engine/core/tier';
import { viewmodelBakeUrl } from '../src/engine/player/viewmodelTextures';
import { GPU_FILES } from '../src/shards/pine-hollow/ktx2.generated';
import { pineCoatUrl } from '../src/shards/pine-hollow/species/rigs';
import coats from '../scripts/bake-pine-coats.json';
import sets from '../scripts/bake-viewmodel-sets.json';

it('keeps procedural fallback pixels distinct from real compressed files on both tiers', () => {
  for (const tier of ['phone', 'desktop'] as const) {
    const coat = pineCoatUrl('bear-black', 'bear', 'black', tier);
    expect(coat.startsWith('procedural:')).toBe(true);
    expect(GPU_FILES[tier][coat]).toEqual(new Map(Object.entries(coats[tier])).get(coat));
    for (const name of ['bolt', 'brushed-steel', 'gunmetal', 'leather'] as const) for (const plane of ['col', 'nrm', 'arm'] as const) {
      const key = viewmodelBakeUrl('pine-hollow', name, plane);
      expect(GPU_FILES[tier][key]).toBeDefined();
      expect(GPU_FILES[tier][key]).toEqual(new Map(Object.entries(sets[tier])).get(key));
    }
  }
  registerGpuFiles(GPU_FILES);
  const key = pineCoatUrl('bear-black', 'bear', 'black', TIER);
  expect(standIn(key, 'img')).toBeUndefined(); // Images draws the pixels; it never fetches the lookup key.
  expect(standIn(key, 'ktx2')).toBe(GPU_FILES[TIER][key]);
});

it('keeps procedural keys shard-owned when the encoder partitions its tables', () => {
  const key = viewmodelBakeUrl('pine-hollow', 'bolt', 'col');
  const target = GPU_FILES.phone[key];
  if (target === undefined) throw new Error('Missing baked plane');
  const result = splitKtx2({ phone: { [key]: target }, desktop: {} }, [{ slug: 'pine-hollow' }]);
  expect(result.get('pine-hollow')?.phone).toEqual({ [key]: target });
  expect(result.get('engine')?.phone).toEqual({});
});

it('checks real baked targets without demanding nonexistent source PNGs or hiding a missing target', () => {
  const root = mkdtempSync(join(tmpdir(), 'procedural-asset-case-'));
  const key = viewmodelBakeUrl('pine-hollow', 'bolt', 'col'), target = '/assets/gpu/bolt.ktx2';
  try {
    mkdirSync(join(root, 'assets/gpu'), { recursive: true });
    writeFileSync(join(root, 'assets/gpu/bolt.ktx2'), 'fixture');
    writeFileSync(join(root, 'table.js'), `const table = ${JSON.stringify({ [key]: target })};`);
    expect(checkAssetCase(root)).toMatchObject({ checked: 1, missing: [] });
    rmSync(join(root, 'assets/gpu/bolt.ktx2'));
    expect(checkAssetCase(root).missing.map(row => row.url)).toEqual([target]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
