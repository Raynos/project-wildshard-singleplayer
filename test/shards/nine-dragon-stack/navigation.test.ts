// oxlint-disable-next-line import/no-nodejs-modules -- Compare admitted navigation with its original immutable oracle.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readNavigation } from '@wildshard/format/navigation';
import { navigationCost } from '@wildshard/format/navigationBytes';
import { emptyShardfile } from '@wildshard/sdk/author';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { sourceManifest } from '../../../src/game/plugin/context';
import { withoutRuntimeRows } from '../../../src/game/plugin/headless';
import { bootSources } from '../../../src/shards/nine-dragon-stack/boot/files';
import manifest from '../../../src/shards/nine-dragon-stack/manifest';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

it('serves the original WSNM bytes once and charges their decoded server residency', () => {
  const row = source.navigation;
  if (row === null) throw new Error('Missing navigation declaration');
  const bytes = new Uint8Array(readFileSync(`src/shards/nine-dragon-stack/assets/${row.file}`));
  const oracle = new Uint8Array(readFileSync('public/assets/baked/nine-dragon-stack/navmesh.bin'));
  expect(bytes).toEqual(oracle);
  expect(hashImmutableBytes(bytes)).toBe(row.file);
  expect(row.file).toBe('2a8083c33ed009f7f1fa122cbec44a2b83e2c457ad8f4dde012736f9e512ea08');
  const layers = readNavigation(row, bytes);
  expect(layers).toHaveLength(1);
  expect(layers[0]?.tiles).toHaveLength(24);
  expect(manifest.navigation).toEqual({ row, url: '/assets/baked/nine-dragon-stack/navmesh.bin' });
  expect(sourceManifest(source, new Map([[row.file, bytes]])).navigation).toEqual({ row, bytes });
  expect(bootSources('phone', 'img', []).physics).toEqual(['/assets/physics/rapier.wasm']);
  expect(source.critical).toContain(row.file);
  expect(withoutRuntimeRows(source).files.map(file => file.hash)).toEqual([row.file]);
  const cost = navigationCost(bytes);
  const base = emptyShardfile(source.identity);
  expect(source.serverBudget.memory - base.serverBudget.memory).toBe(cost.decoded);
  expect(source.budgets.sim).toEqual({ compressed: bytes.length, resident: cost.decoded });
});
