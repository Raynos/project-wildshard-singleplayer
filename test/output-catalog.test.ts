// oxlint-disable-next-line import/no-nodejs-modules -- Owned output fixtures live under ./tmp.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture paths.
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parseShardCatalog } from '@wildshard/format/shardCatalog';
import { writeOutputCatalog, type OutputCatalogEntry } from '@wildshard/sdk/outputCatalog';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const owned: string[] = [];
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }); });
function directory(): string {
  mkdirSync(resolve('tmp'), { recursive: true });
  const path = mkdtempSync(join(resolve('tmp'), 'catalog-test-')); owned.push(path); return path;
}
function entry(slug: string, order: number): OutputCatalogEntry {
  const image = `${slug}/blobs/image/${'a'.repeat(64)}.webp`;
  return { slug, index: new TextEncoder().encode(`{"identity":{"slug":"${slug}"}}\n`),
    card: { name: slug, label: '(0, 0)', biome: 'Forest', blurb: 'A playable shard.', order, status: 'live',
      thumb: image, portrait: image, landscape: image, accent: 'pink' },
    placement: { instance: slug, grid: [order, 0], size: [500, 500, 500] }, runtime: { entry: 'runtime/index.ts' } };
}
it('writes stable ordering and exact index hashes without mutating the input', () => {
  const destination = directory(), alpha = entry('alpha', 2), beta = entry('beta', 1), entries = [alpha, beta];
  const catalog = writeOutputCatalog(destination, entries), before = readFileSync(join(destination, 'catalog.json'), 'utf8');
  expect(catalog.shards.map(row => row.slug)).toEqual(['beta', 'alpha']);
  expect(catalog.shards[0]?.index).toEqual({ path: 'beta/shard.json', hash: hashImmutableBytes(beta.index) });
  expect(entries.map(row => row.slug)).toEqual(['alpha', 'beta']);
  writeOutputCatalog(destination, [beta, alpha]);
  expect(readFileSync(join(destination, 'catalog.json'), 'utf8')).toBe(before);
  const changed = writeOutputCatalog(destination, [{ ...beta, index: new TextEncoder().encode('{}') }, alpha]);
  expect(changed.shards[0]?.index.hash).not.toBe(catalog.shards[0]?.index.hash);
});
it('supports a data-only template and rejects duplicates, escapes and executable metadata before writing', () => {
  const destination = directory(), template = entry('_template', 0);
  template.runtime = null; template.card.thumb = 'data:image/svg+xml,%3Csvg/%3E';
  const catalog = writeOutputCatalog(destination, [template]);
  expect(catalog.shards[0]?.runtime).toBeNull();
  expect(() => writeOutputCatalog(destination, [template, template])).toThrow('Duplicate');
  expect(() => parseShardCatalog({ ...catalog, formatVersion: 2 })).toThrow();
  expect(() => parseShardCatalog({ ...catalog, shards: [{ ...catalog.shards[0], index: { path: '../elsewhere/shard.json', hash: 'a'.repeat(64) } }] })).toThrow();
  expect(() => writeOutputCatalog(destination, [{ ...entry('alpha', 1), card: { ...template.card, thumb: '/src/shards/alpha/thumb.jpg' } }])).toThrow();
  expect(() => parseShardCatalog({ ...catalog, execute: () => true })).toThrow('JSON data');
  expect(parseShardCatalog(JSON.parse(readFileSync(join(destination, 'catalog.json'), 'utf8')))).toEqual(catalog);
});
