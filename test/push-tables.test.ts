// oxlint-disable-next-line import/no-nodejs-modules -- Own a tiny source-only schema fixture under ./tmp.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the fixture's literal paths.
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { manifestTypeTables, sectionTables } from '../scripts/push-tables.mjs';
import { writeSectionSchemaBridge } from '../scripts/bake-section-schemas.mjs';
import { sourceWalker } from '../scripts/push-inputs.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';

test('metadata discovery emits the same checked TypeScript table', () => {
  expect(authoredManifestSource(resolve('.'), '_template', { metadataOnly: true }))
    .toBe(authoredManifestSource(resolve('.'), '_template'));
});

test('standard ignored bindings borrow the defining admitted contracts', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/push-binding-types-'));
  try {
    manifestTypeTables(root, 'example', { bindings: {
      poses: { module: './data/poses.generated.json' },
      boot: { sources: { module: './data/sources.generated.json' } },
    } }, new Set(['src/shards/example/data/poses.generated.json', 'src/shards/example/data/sources.generated.json']));
    expect(readFileSync(join(root, 'src/shards/example/data/poses.generated.d.json.ts'), 'utf8')).toContain('parseCapturePoses>');
    expect(readFileSync(join(root, 'src/shards/example/data/sources.generated.d.json.ts'), 'utf8')).toContain("AuthoredShardBindings['bootBindings']>[\"sources\"]");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('push declarations equal the product producer without reading data WIP', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/push-tables-test-'));
  try {
    const shard = join(root, 'src/shards/example');
    mkdirSync(join(shard, 'generators'), { recursive: true });
    mkdirSync(join(shard, 'data'));
    mkdirSync(join(root, 'src/format'), { recursive: true });
    writeFileSync(join(root, 'src/format/package.json'), '{"exports":{}}');
    writeFileSync(join(shard, 'generators/sections.ts'), `
import * as v from 'valibot';
export const RowSchema = v.object({ id: v.string(), point: v.tuple([v.number(),v.number()]) });
export const SECTIONS = { 'custom/rows': v.array(RowSchema) };
export const FILE_SCHEMAS = { 'data/example.json': RowSchema };
`);
    const data = join(shard, 'data/example.json');
    writeFileSync(data, '{"id":"one","point":[1,2]}');
    await writeSectionSchemaBridge(root, 'example');
    const paths = ['runtime/productSections.generated.d.ts', 'data/example.d.json.ts'];
    const expected = paths.map(path => readFileSync(join(shard, path), 'utf8'));
    writeFileSync(data, 'invalid uncommitted data');
    await sectionTables(root, 'example');
    expect(paths.map(path => readFileSync(join(shard, path), 'utf8'))).toEqual(expected);
    await expect(writeSectionSchemaBridge(root, 'example')).rejects.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('runtime cache follows mixed value imports but not metadata file labels', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/push-runtime-walk-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/entry.ts'), "import type { Row } from './rows';\nimport { value } from './rows';\nexport const label = 'src/unexecuted.ts';\nexport { value };");
    writeFileSync(join(root, 'src/rows.ts'), 'export const value = 1; export interface Row { value: number }');
    writeFileSync(join(root, 'src/unexecuted.ts'), 'export const unused = true;');
    expect(sourceWalker(root, true)(['src/entry.ts'])).toEqual(['src/entry.ts', 'src/rows.ts']);
    expect(sourceWalker(root)(['src/entry.ts'])).toContain('src/unexecuted.ts');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('runtime JSON imports read data rather than its type declaration graph', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/push-json-runtime-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), '{"compilerOptions":{"resolveJsonModule":true,"moduleResolution":"bundler","module":"esnext","allowArbitraryExtensions":true}}');
    writeFileSync(join(root, 'entry.ts'), "import rows from './rows.json'; export default rows;");
    writeFileSync(join(root, 'rows.json'), '{"value":1}');
    writeFileSync(join(root, 'rows.d.json.ts'), "declare const value: import('./type-only').Row; export default value;");
    writeFileSync(join(root, 'type-only.ts'), 'export interface Row { value: number }');
    expect(sourceWalker(root, true)(['entry.ts'])).toEqual(['entry.ts', 'rows.json']);
    expect(sourceWalker(root)(['entry.ts'])).toContain('type-only.ts');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
