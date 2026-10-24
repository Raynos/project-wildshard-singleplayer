import * as v from 'valibot';
import { expect, test } from 'vitest';
import { completeL0Tiles } from '@wildshard/sdk/bake/tileGrid';
import { FilesSchema, TilesSchema } from '@wildshard/format/shardSections';
import { PropsSchema } from '@wildshard/format/props';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the retained producer's actual metadata without importing a generated module.
import { readFileSync } from 'node:fs';
import { skyIsleProps } from '../src/shards/far-reach/generators/isleProps';
import { tileBakeCensus } from '../scripts/tile-bakes.mjs';

test('Sky ships every L0 square without changing any island payload or geometry-reader list', () => {
  const shipping = v.parse(v.object({ tiles: TilesSchema, props: PropsSchema, files: FilesSchema }),
    JSON.parse(readFileSync('src/shards/far-reach/data/props.json', 'utf8')));
  const baked = skyIsleProps(), tiles = v.parse(TilesSchema, shipping.tiles);
  const occupied = baked.tiles.slice().sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  expect(tiles).toEqual(completeL0Tiles(occupied));
  expect(tiles.filter(row => row.lod === 0)).toHaveLength(64);
  expect(tiles.filter(row => row.files.length > 0)).toEqual(occupied);
  expect(tiles.filter(row => row.files.length === 0)).toHaveLength(42);
  expect(shipping.props).toEqual(baked.props);
  expect(shipping.files).toEqual(baked.files.slice().sort((a, b) => a.hash.localeCompare(b.hash)));
  for (const tile of tiles.filter(row => row.files.length === 0)) {
    expect([tile.compressed, tile.decoded, tile.gpu, tile.triangles, tile.draws]).toEqual([0, 0, 0, 0, 0]);
  }
  const census = tileBakeCensus(tiles, shipping.files);
  expect(Object.keys(census.debt).filter(key => key.startsWith('missing/0/'))).toEqual([]);
  expect(census.l1).toBe(0);
  expect(Object.keys(census.debt).filter(key => key.startsWith('missing/1/'))).toHaveLength(16);
});
