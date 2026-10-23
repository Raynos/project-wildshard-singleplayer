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
