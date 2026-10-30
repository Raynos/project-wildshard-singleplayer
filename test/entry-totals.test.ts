import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the isolated compiler fixture.
import {mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all fixture writes inside the repository.
import {resolve} from 'node:path';
import {writeSpawnManifests} from '../scripts/app-build/entryTotals';
import {emptyShardfile} from '@wildshard/sdk/author';
import {outputSectionPayloads} from '../src/format/outputFields';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin this compiler fixture's original bytes.
import {createHash} from 'node:crypto';

test('spawn manifests union code once, keep grid selection and content identity stable', () => {
  mkdirSync('tmp/entry-totals', {recursive: true});
  const root = mkdtempSync(resolve('tmp/entry-totals/fixture-'));
  try {
    const output = resolve(root, 'dist'), product = resolve(root, 'out/example');
    mkdirSync(resolve(output, 'assets'), {recursive: true}); mkdirSync(product, {recursive: true});
    const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
    const source = emptyShardfile({slug: 'example', name: 'Example', author: 'Test', revision: 1, seed: 1});
    const sections = [...outputSectionPayloads(source)].map(([name, value]) => {
      const path = `sections/${name}.json`, text = JSON.stringify(value);
      mkdirSync(resolve(product, path, '..'), {recursive: true}); writeFileSync(resolve(product, path), text);
      return {name, path, bytes: Buffer.byteLength(text), hash: digest(text), schema: `wildshard:${name}@1`};
    });
    const index = JSON.stringify({format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity,
      build: {sourceHash: digest('source'), validator: 'test'}, requires: source.requires,
      admission: {budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps,
        critical: source.critical, library: source.library, late: source.late}, sections, schemas: [], files: [], runtime: null});
    writeFileSync(resolve(product, 'shard.json'), index);
    const metadata = Buffer.byteLength(index) + sections.reduce((sum, row) => sum + row.bytes, 0);
    for (const [name, bytes] of [['shared.js', 10], ['client.js', 20], ['grid.js', 30], ['example.js', 4], ['other.js', 8], ['model.js', 5], ['seam.bin', 9]] as const)
      writeFileSync(resolve(output, 'assets', name), new Uint8Array(bytes));
    const input = {common: [['/assets/shared.js', 10]], client: [['/assets/client.js', 20]], grid: [['/assets/shared.js', 10], ['/assets/grid.js', 30]],
      selection: {example: [['/assets/example.js', 4]], other: [['/assets/other.js', 8]]},
      optional: {files: [['/assets/shared.js', 10], ['/assets/model.js', 5]], groups: {'home:/shardfiles/example/': [0, 1]}},
      products: {'/shardfiles/example/': [3, 1000, 100, 200]}, extras: {},
      code: {entries: {example: ['/assets/code/pack.pack', 7, 100, [0]]}}};
    const strips = {'100': {example: [{url: '/assets/seam.bin', bytes: 9}]}};
    const totals = writeSpawnManifests(output, input, strips, root);
    expect(totals.client['example']?.phone.totalBytes).toBe(metadata + 39);
    expect(totals.grid['100']?.['example']?.phone.totalBytes).toBe(metadata + 66);
    expect(writeSpawnManifests(output, input, strips, root)).toEqual(totals);
    const address = totals.client['example']?.phone; if (address === undefined) throw new Error('Missing manifest');
    const text = readFileSync(resolve(output, address.url.slice(1)), 'utf8');
    expect(address.wireBytes).toBeDefined(); expect(address.wireBytes).toBeLessThan(address.totalBytes);
    expect(text).not.toContain('code/pack.pack'); expect(text).not.toContain('/assets/other.js');
    expect(() => writeSpawnManifests(output, {...input, products: {'/shardfiles/example/': [3, -1]}}, {}, root)).toThrow();
    expect(() => writeSpawnManifests(output, {...input, optional: {...input.optional, groups: {'home:/shardfiles/example/': [9]}}}, {}, root)).toThrow('module index');
  } finally {rmSync(root, {recursive: true, force: true});}
});
