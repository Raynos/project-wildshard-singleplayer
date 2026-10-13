// oxlint-disable-next-line import/no-nodejs-modules -- The complete product fixture reads bounded authored assets.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture products stay outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve authored sources and isolated fixture outputs.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the pinned source closure in this checkout.
import process from 'node:process';
import { expect, it } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { mapTilesHash } from '../scripts/map-hash.mjs';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import product from '../src/shards/pastel-plain/generators/product';
import config from '../src/shards/pastel-plain/shard.config';
import map from '../src/shards/pastel-plain/data/productMap.json';
import stamp from '../src/shards/pastel-plain/look/map.baked.json';
import { packProjectMap } from '../src/sdk/projectMap';
import { writeProduct, writeAuthoredProduct } from '../src/sdk/productOutput';
import { hashImmutableBytes } from '../src/sdk/immutable';

function inputs(): ReturnType<typeof packProjectMap> & { assets: Map<string, Uint8Array> } {
  const project = resolve('src/shards/pastel-plain');
  const bytes = readFileSync(resolve(project, 'assets/map.webp'));
  const packed = packProjectMap(product, { bytes, tilesHash: map.tilesHash });
  const assets = new Map(packed.shard.files.map(file => [file.hash, file.hash === packed.hash ? bytes : readFileSync(resolve(project, 'assets', file.hash))]));
  return { ...packed, assets };
}

it('keeps the documented config and frozen authored map equal to the committed product inputs', () => {
  expect(config).toEqual(product);
  expect(map).toEqual(stamp);
  expect(mapTilesHash('src/shards/pastel-plain')).toBe(map.tilesHash);
  expect(readFileSync('src/shards/pastel-plain/assets/map.webp')).toEqual(readFileSync('public/assets/pastel-plain/map/top.webp'));
});

it('registers the full authoring closure and pins every charged product file without cache activation', () => {
  const job = discoverGeneration(process.cwd()).jobs.find(row => row.id === 'pastel-product');
  if (job === undefined) throw new Error('Missing whole Pastel product job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(process.cwd(), 'pastel-plain', entry));
  expect(audits.flatMap(row => row.issues)).toEqual([]);
  expectKeyedClosure(job.inputRoots, [...new Set(audits.flatMap(row => row.files))], 'pastel-plain');
  expect(job.buildOutputs).toEqual({});
  expect(job.seedOutputs).toEqual([]);
  const { shard } = inputs();
  const prefix = 'src/shards/pastel-plain/.wildshard/product/';
  expect([...job.outputs].sort()).toEqual([...shard.files.map(file => `${prefix}${file.hash}`), `${prefix}shard.json`].sort());
  expect(Object.keys(job.comparisonOutputs ?? {}).sort()).toEqual([...job.outputs].sort());
});

it('emits every pinned product byte twice and refuses malformed assets before emission', () => {
  const job = discoverGeneration(process.cwd()).jobs.find(row => row.id === 'pastel-product');
  if (job?.comparisonOutputs === undefined) throw new Error('Missing comparison-only product pins');
  const temporary = mkdtempSync(resolve(tmpdir(), 'pastel-product-'));
  try {
    for (const name of ['cold', 'forced']) {
      const { shard, assets } = inputs();
      const destination = resolve(temporary, name);
      if (name === 'cold') writeAuthoredProduct(product, resolve('src/shards/pastel-plain'), destination, { file: 'assets/map.webp', tilesHash: map.tilesHash });
      else writeProduct(shard, assets, destination);
      for (const [path, hash] of Object.entries(job.comparisonOutputs)) {
        const file = path.slice(path.lastIndexOf('/') + 1);
        expect(hashImmutableBytes(readFileSync(resolve(destination, file))), file).toBe(hash);
      }
    }
    const { shard, assets, hash } = inputs();
    assets.set(hash, new Uint8Array([0]));
    expect(() => writeProduct(shard, assets, resolve(temporary, 'refused'))).toThrow();
    expect(existsSync(resolve(temporary, 'refused/shard.json'))).toBe(false);
    expect(() => writeAuthoredProduct(product, '.', resolve(temporary, 'escape'), { file: '../map.webp', tilesHash: map.tilesHash })).toThrow('authored asset path');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
