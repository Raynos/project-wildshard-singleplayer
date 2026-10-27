// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original metadata and isolate real sealed production.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the actual cold sealed writer cache to repository scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original declaration bytes without expanding assertions.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { PropsSchema } from '../src/format/props';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { discoverGeneration } from '../scripts/generate.mjs';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { SKY_ISLE_TILES, skyIsleTileLibrary } from '../src/shards/far-reach/generators/islandScenes';
import { skyProductRows } from '../src/shards/far-reach/generators/product';

const metadata = 'src/shards/far-reach/data/props.json';
const declarationHash = '2265bbfe4606de60cdc86578d70fe70b481d84184eacf7687b0a45e9e4823f1f';

test('the authored tile bank preserves complete metadata, costs and the original scene library', () => {
  const bytes = readFileSync(metadata);
  expect(Buffer.compare(new TextEncoder().encode(encodeCanonicalJson(SKY_WORLD_TILE_ROWS)), bytes)).toBe(0);
  const original = v.parse(v.object({ props: PropsSchema }), JSON.parse(bytes.toString()));
  expect(SKY_ISLE_TILES).toEqual(skyIsleTileLibrary(original.props.tiles));
});

test('the declaration retains every original field, tile payload identity and admission cost', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyProductRows())}\n`);
  expect(bytes.byteLength).toBe(320_319);
  expect(hashImmutableBytes(bytes)).toBe(declarationHash);
});

test('declaration publication is retired and callers retain isolated complete original values', () => {
  expect(discoverGeneration(resolve('.')).jobs.some(row => row.id === 'sky-declaration')).toBe(false);
  const rows = skyProductRows(); rows.entryways.length = 0; rows.files.length = 0;
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(skyProductRows())}\n`))).toBe(declarationHash);
});
