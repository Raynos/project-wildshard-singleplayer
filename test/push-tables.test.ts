// oxlint-disable-next-line import/no-nodejs-modules -- Own a tiny source-only schema fixture under ./tmp.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the fixture's literal paths.
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { sourceWalker } from '../scripts/push-inputs.mjs';
import { untypedLintConfig } from '../scripts/push-lint-config.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';

test('cache-miss lint retains architecture rules and ordinary options', () => {
  const original = { options: { typeAware: true, denyWarnings: true }, jsPlugins: ['./lint/guard.js'],
    rules: { 'no-eval': 'error' }, overrides: [{ files: ['src/**'], rules: { 'local/guard': 'error' } }] };
  expect(untypedLintConfig(original)).toEqual({ ...original, options: { typeAware: false, denyWarnings: true, reportUnusedDisableDirectives: 'off' } });
  expect(original.options.typeAware).toBe(true);
});

test('metadata discovery emits the same checked TypeScript table', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/push-discovery-parity-'));
  try {
    const folder = join(root, 'src/shards/example');
    mkdirSync(join(folder, 'data'), { recursive: true });
    writeFileSync(join(folder, 'data/budgets.json'), '{}');
    writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ slug: 'example', bindings: {
      accent: 'sea', budgets: { module: './data/budgets.json', export: 'default' },
    } }));
    expect(authoredManifestSource(root, 'example', { metadataOnly: true }))
      .toBe(authoredManifestSource(root, 'example'));
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
