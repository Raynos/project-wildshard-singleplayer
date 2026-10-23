// oxlint-disable-next-line import/no-nodejs-modules -- Own small source-only dependency fixtures.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the owned fixture paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { importerFiles, deletedReferences } from '../scripts/push-checks.mjs';

test('typed lint follows direct and transitive importers without unrelated files', () => {
  const root = mkdtempSync(resolve('tmp/push-importers-'));
  const put = (name: string, value: string): void => {
    const path = resolve(root, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value);
  };
  try {
    put('src/base.ts', 'export const value = 1;');
    put('src/child.ts', "import {value} from './base'; export const child = value;");
    put('test/child.test.ts', "import {child} from '../src/child'; void child;");
    put('src/unrelated.ts', 'export const other = 2;');
    expect(importerFiles(root, ['src/base.ts'])).toEqual(['src/base.ts', 'src/child.ts', 'test/child.test.ts']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('outgoing deletion grep covers imports, JSON and process paths, ignoring comments and exact allowances', () => {
  const root = mkdtempSync(resolve('tmp/push-deleted-'));
  const put = (name: string, value: string): void => {
    const path = resolve(root, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value);
  };
  try {
    put('src/reader.ts', "// import './gone';\nimport './gone'; import '@wildshard/format/gone';");
    put('src/rows.json', '{"file":"src/format/gone.ts"}');
    put('scripts/job.py', "# 'src/gone.ts'\nrun('src/gone.ts')");
    put('scripts/job.sh', "node 'src/gone.ts'");
    put('test/fixtures/negative.ts', "import '../../src/gone';");
    put('scripts/check-paths.allow.json', JSON.stringify([{ file: 'src/rows.json', path: 'src/format/gone.ts', why: 'negative fixture' }]));
    const deleted = ['src/gone.ts', 'src/format/gone.ts'];
    const found = deletedReferences(root, deleted);
    expect(found).toHaveLength(4);
    expect(found).toContain('src/reader.ts:2: deleted path src/gone.ts');
    expect(found).toContain('src/reader.ts:2: deleted path src/format/gone.ts');
    expect(found.some(line => line.includes('job.py:2'))).toBe(true);
    expect(found.some(line => line.includes('job.sh:1'))).toBe(true);
    put('src/gone.ts', 'export {};'); put('src/format/gone.ts', 'export {};');
    expect(deletedReferences(root, deleted).sort()).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('deleted paths ignore only frozen legacy folders and still refuse active consumers', () => {
  const root = mkdtempSync(resolve('tmp/push-deleted-legacy-'));
  const put = (name: string, value: string): void => {
    const path = resolve(root, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value);
  };
  const deleted = ['src/shards/nalati-grasslands/species/goldenKing.ts'];
  const reference = JSON.stringify({ source: deleted[0] });
  try {
    put('src/shards/nalati-grasslands-legacy/runtime/physics.baked.json', reference);
    put('src/shards/nine-dragon-stack-legacy/runtime/old.ts', `const historical = '${deleted[0]}';`);
    expect(deletedReferences(root, deleted).sort()).toEqual([]);
    put('src/shards/nalati-grasslands/runtime/active.json', reference);
    put('src/shards/nalati-grasslands-legacy-next/runtime/active.json', reference);
    put('src/game/nalati-grasslands-legacy/active.json', reference);
    expect(deletedReferences(root, deleted).sort()).toEqual([
      `src/game/nalati-grasslands-legacy/active.json:1: deleted path ${deleted[0]}`,
      `src/shards/nalati-grasslands-legacy-next/runtime/active.json:1: deleted path ${deleted[0]}`,
      `src/shards/nalati-grasslands/runtime/active.json:1: deleted path ${deleted[0]}`,
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
