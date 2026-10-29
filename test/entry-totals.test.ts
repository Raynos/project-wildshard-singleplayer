import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the isolated compiler fixture.
import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all fixture writes inside the repository.
import {resolve} from 'node:path';
import {entryTotals} from '../scripts/app-build/entryTotals';

test('entry totals union code once and select exact product tiers and grid addresses before IO', () => {
  mkdirSync('tmp/entry-totals', {recursive: true});
  const root = mkdtempSync(resolve('tmp/entry-totals/fixture-'));
  try {
    const input = {common: [['/assets/shared.js', 10]], client: [['/assets/client.js', 20]], grid: [['/assets/shared.js', 10], ['/assets/grid.js', 30]],
      selection: {example: [['/assets/example.js', 4]], other: [['/assets/other.js', 8]]},
      optional: {files: [['/assets/shared.js', 10], ['/assets/model.js', 5]], groups: {'home:/shardfiles/example/': [0, 1]}},
      products: {'/shardfiles/example/': [3, 1000, 100, 200]}, extras: {},
      code: {entries: {example: ['/assets/code/pack.pack', 7, 100, [0]]}}};
    const totals = entryTotals(input, {'100': {example: [{url: '/assets/seam.bin', bytes: 9}]}}, root);
    // The code pack is a transport envelope for these same module bodies.
    expect(totals.client['example']).toEqual([139, 239]);
    expect(totals.grid['100']?.['example']).toEqual([166, 266]);
    expect(() => entryTotals({...input, products: {'/shardfiles/example/': [3, -1]}}, {}, root)).toThrow();
    expect(() => entryTotals({...input, optional: {...input.optional, groups: {'home:/shardfiles/example/': [9]}}}, {}, root)).toThrow('module index');
  } finally {rmSync(root, {recursive: true, force: true});}
});
