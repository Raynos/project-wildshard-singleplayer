// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated source graphs, removed after each case.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { liveTestSelection } from '../scripts/push-inputs.mjs';

test('a transitive dynamic import of a missing generated public asset is reported for CI', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/generated-selection-'));
  const put = (path: string, value: string): void => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  try {
    put('scripts/generation-jobs.json', JSON.stringify({ jobs: [{ outputs: ['public/assets/baked/pool.json'] }] }));
    put('tsconfig.json', '{"compilerOptions":{"resolveJsonModule":true,"moduleResolution":"bundler","module":"esnext","allowArbitraryExtensions":true}}');
    put('test/consumer.test.ts', "export async function check(){return import('../src/output');}");
    put('src/output.ts', "import pool from '../public/assets/baked/pool.json'; export {pool};");
    put('test/source.test.ts', "import '../src/missing-author';");
    put('test/types.test.ts', "import type {Row} from '../public/assets/baked/pool.json'; export type {Row};");
    const tests = ['test/consumer.test.ts', 'test/source.test.ts', 'test/types.test.ts'];
    expect(liveTestSelection(root, tests, {})).toEqual({ run: tests.slice(1), deferred: [{ test: tests[0], reason: 'generated inputs: public/assets/baked/pool.json' }] });
    // A verified snapshot that actually supplies the output can run the test.
    put('public/assets/baked/pool.json', '{}');
    expect(liveTestSelection(root, tests, {})).toEqual({ run: tests, deferred: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verified old outputs defer only consumers of changed producer inputs', () => {
  const root = mkdtempSync(resolve('tmp/stale-generation-'));
  const put = (path: string, value: string): void => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  try {
    put('scripts/generation-jobs.json', JSON.stringify({ jobs: [
      { id: 'shape', entry: 'src/bake-shape.mjs', inputRoots: ['src/shape'], outputs: ['src/shape.generated.json'] },
      { id: 'terrain', inputRoots: ['src/shape.generated.json'], outputs: ['src/terrain.generated.json'] },
      { id: 'catalogue', inputRoots: [], catalogueDependencies: ['terrain'], outputs: ['src/catalogue.generated.json'] },
      { id: 'other', inputRoots: ['src/other'], outputs: ['src/other.generated.json'] },
    ] }));
    put('tsconfig.json', '{"compilerOptions":{"resolveJsonModule":true,"moduleResolution":"bundler","module":"esnext"}}');
    for (const name of ['shape', 'terrain', 'catalogue', 'other']) {
      put(`src/${name}.generated.json`, '{}');
      put(`test/${name}.test.ts`, `import value from '../src/${name}.generated.json'; export {value};`);
    }
    put('src/reader.ts', "export async function read(){return import('./shape.generated.json');}");
    put('test/transitive.test.ts', "import '../src/reader';");
    put('test/types.test.ts', "import type {Row} from '../src/shape.generated.json'; export type {Row};");
    const tests = ['test/shape.test.ts', 'test/terrain.test.ts', 'test/catalogue.test.ts', 'test/other.test.ts', 'test/transitive.test.ts', 'test/types.test.ts'];
    expect(liveTestSelection(root, tests, {})).toEqual({ run: tests, deferred: [] });
    // A removed input is still in the outgoing range; no on-disk file is needed.
    for (const changed of ['src/shape/deleted.json', 'src/bake-shape.mjs']) {
      const selection = liveTestSelection(root, tests, {}, [changed]);
      expect(selection.run).toEqual(['test/other.test.ts', 'test/types.test.ts']);
      expect(selection.deferred.map(row => row.test)).toEqual(['test/shape.test.ts', 'test/terrain.test.ts', 'test/catalogue.test.ts', 'test/transitive.test.ts']);
      for (const row of selection.deferred) {
        expect(row.reason).toContain('stale generated inputs:');
        expect(row.reason).toContain(`changed input ${changed}`);
        expect(row.reason).toContain('job ');
        expect(row.reason).toContain('.generated.json');
      }
    }
    // Directory boundaries must not turn a similarly named author path into an input.
    expect(liveTestSelection(root, tests, {}, ['src/shape-other/input.json']))
      .toEqual({ run: tests, deferred: [] });
    const policy = liveTestSelection(root, tests, {}, ['scripts/generation-jobs.json']);
    expect(policy.run).toEqual(['test/types.test.ts']);
    expect(policy.deferred).toHaveLength(5);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
