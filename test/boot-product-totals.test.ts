import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the tiny output metadata fixture.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve that compiler fixture without changing cwd.
import { resolve } from 'node:path';
import { emptyShardfile } from '@wildshard/sdk/author';
import { bootProductTotals, productDownloadTotal } from '../vite/bootProducts';

const source = emptyShardfile({ slug: 'total-test', name: 'Total', author: 'Test', revision: 1, seed: 9 });
const hash = '0'.repeat(64);
const index = { format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity,
  requires: source.requires, build: { sourceHash: hash, validator: 'test' },
  admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
  sections: [{ name: 'custom/first', path: 'sections/custom/first.json', schema: 'schemas/custom/first.schema.json', hash, bytes: 40 }],
  schemas: [{ path: 'schemas/custom/first.schema.json', hash, bytes: 15 }],
  files: [{ kind: 'bin', path: `blobs/bin/${hash}.bin`, hash, compressed: 30, decoded: 300, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }], runtime: null };

test('uses index, section, custom-schema and encoded blob bytes, never decoded/GPU budgets', () => {
  expect(productDownloadTotal(index, 20)).toEqual([20, 105]);
  expect(() => productDownloadTotal({ ...index, files: [{ ...index.files[0], path: '../foreign.bin' }] }, 20)).toThrow();
  expect(() => productDownloadTotal(index, -1)).toThrow('Invalid product download total');
});
test('the shell contains only directory totals; complete file banks stay in their products', () => {
  mkdirSync('tmp/vite-boot-products', { recursive: true });
  const root = mkdtempSync(resolve('tmp/vite-boot-products/case-'));
  try {
    expect(bootProductTotals(root)).toEqual({});
    mkdirSync(resolve(root, 'out/total-test'), { recursive: true });
    const text = JSON.stringify(index);
    writeFileSync(resolve(root, 'out/total-test/shard.json'), text);
    const rows = bootProductTotals(root);
    expect(rows).toEqual({ '/shardfiles/total-test/': [Buffer.byteLength(text), Buffer.byteLength(text) + 85] });
    expect(JSON.stringify(rows)).not.toContain('custom/first');
    expect(JSON.stringify(rows)).not.toContain(hash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
