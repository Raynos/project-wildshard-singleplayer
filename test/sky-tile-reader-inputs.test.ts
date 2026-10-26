// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original metadata and isolate real sealed production.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the actual cold sealed writer cache to repository scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original declaration bytes without expanding assertions.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { PropsSchema } from '../src/format/props';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { SKY_ISLE_TILES, skyIsleTileLibrary } from '../src/shards/far-reach/generators/islandScenes';
import { skyProductRows } from '../src/shards/far-reach/generators/product';

const metadata = 'src/shards/far-reach/data/props.json';
const declaration = 'src/shards/far-reach/data/product.generated.json';

test('the authored tile bank preserves complete metadata, costs and the original scene library', () => {
  const bytes = readFileSync(metadata);
  expect(Buffer.compare(new TextEncoder().encode(encodeCanonicalJson(SKY_WORLD_TILE_ROWS)), bytes)).toBe(0);
  const original = v.parse(v.object({ props: PropsSchema }), JSON.parse(bytes.toString()));
  expect(SKY_ISLE_TILES).toEqual(skyIsleTileLibrary(original.props.tiles));
});

test('the declaration retains every original field, tile payload identity and admission cost', () => {
  expect(Buffer.compare(new TextEncoder().encode(`${JSON.stringify(skyProductRows())}\n`), readFileSync(declaration))).toBe(0);
});

test('the real cold sealed declaration preserves its complete output without the tile metadata handoff', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-declaration');
  if (job === undefined) throw new Error('Missing retained Sky declaration writer');
  expect(job.inputRoots).not.toContain(metadata);
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/worldTileRows.ts');
  const expected = hashImmutableBytes(readFileSync(declaration)), cacheDir = mkdtempSync(resolve('tmp/sky-tile-reader-inputs-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [declaration]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
