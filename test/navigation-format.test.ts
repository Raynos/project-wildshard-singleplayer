// oxlint-disable-next-line import/no-nodejs-modules -- Validate retained native navigation corpus and immutable bytes.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Independent immutable fixture hash.
import { createHash } from 'node:crypto';
import { describeNavigation, readNavigation } from '@wildshard/format/navigation';
import { decodeNavigation, navigationCost } from '@wildshard/format/navigationBytes';
import { validateShardfileAssets } from '@wildshard/format/assetAdmission';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { emptyShardfile } from '@wildshard/sdk/author';
import { bake } from '@wildshard/sdk/bake';
import { Scene } from 'three';
import { parseNavmesh } from '../src/engine/physics/navmesh';

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
for (const slug of ['sunscar-dunes', 'far-reach', 'driftwood-isle', 'pine-hollow', 'nalati-grasslands']) it(`${slug}: declares original navigation bytes and all query layers`, () => {
  const bytes = new Uint8Array(readFileSync(`public/assets/baked/${slug}/navmesh.bin`)), row = describeNavigation(hash(bytes), bytes);
  const layers = readNavigation(row, bytes), nav = parseNavmesh(Uint8Array.from(bytes).buffer);
  expect(nav).not.toBeNull();
  expect(nav?.layers.map(layer => layer.radius)).toEqual(layers.map(layer => layer.radius).sort((a, b) => a - b));
  expect(layers.map(layer => layer.tiles.map(tile => [tile.tileX, tile.tileY]))).toEqual(row.layers.map(layer => layer.tiles));
  expect(navigationCost(bytes).decoded).toBeGreaterThan(bytes.length);
  const baked = bake(new Scene(), { slug }, { navigation: bytes });
  expect(baked.shardfile.navigation).toEqual(row);
  expect(baked.assets.get(row.file)).toEqual(bytes);
});
it('admits a charged critical navigation root and refuses missing, corrupt or lying declarations', () => {
  const bytes = new Uint8Array(readFileSync('public/assets/baked/far-reach/navmesh.bin'));
  const baked = bake(new Scene(), { slug: 'navigation-fixture' }, { navigation: bytes });
  const base = emptyShardfile({ slug: 'navigation-fixture', name: 'Navigation', author: 'Test', revision: 1, seed: 1 });
  const file = baked.shardfile.files[0]; if (file === undefined) throw new Error('Missing navigation file');
  const source = parseShardfile({ ...base, ...baked.shardfile, budgets: { ...base.budgets, sim: { resident: file.decoded, compressed: file.compressed } } });
  expect(validateShardfileAssets(source, baked.assets, hash).navigation).toEqual(baked.shardfile.navigation);
  expect(() => parseShardfile({ ...source, critical: [] })).toThrow();
  expect(() => validateShardfileAssets(source, new Map(), hash)).toThrow();
  const navigation = source.navigation; if (navigation === null) throw new Error('Missing navigation');
  expect(() => readNavigation({ ...navigation, bounds: [0, 0, 0, 1, 1, 1] }, bytes)).toThrow(/declaration/);
  const wrongGrid = structuredClone(navigation); for (const layer of wrongGrid.layers) layer.tiles = [];
  expect(() => readNavigation(wrongGrid, bytes)).toThrow(/declaration/);
  expect(() => decodeNavigation(bytes.slice(0, -1))).toThrow();
  const trailing = new Uint8Array(bytes.length + 1); trailing.set(bytes); expect(() => decodeNavigation(trailing)).toThrow(/trailing/);
  const huge = Uint8Array.from(bytes); new DataView(huge.buffer).setUint32(8, 0xffffffff, true); expect(() => decodeNavigation(huge)).toThrow(/layer cap/);
  const nan = Uint8Array.from(bytes); new DataView(nan.buffer).setFloat32(12, Number.NaN, true); expect(() => decodeNavigation(nan)).toThrow(/layer/);
});
