// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real CLI against owned source fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures stay under the repository scratch root.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the CLI before changing its fixture working directory.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the test worker's Node runtime for the subprocess.
import { execPath } from 'node:process';
import { expect, test } from 'vitest';
import { checkShardLayout } from '../scripts/check-shards.mjs';

test('ownership declaration suffixes preserve the module existence check', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'path-hygiene-'));
  const put = (path: string, content: string): void => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content);
  };
  const run = (): ReturnType<typeof spawnSync> => spawnSync(execPath, [resolve('scripts/check-paths.mjs')], { cwd: root, encoding: 'utf8' });
  try {
    put('src/live.ts', 'export const live = 1;');
    put('scripts/shard-components.mjs', "const owner = 'src/live.ts#live';");
    put('scripts/documented.py', '"""A retired path: src/deleted.ts"""\npattern = r"test/scripts/[^/]+\\.test\\.ts"\n');
    expect(run().status).toBe(0);
    put('scripts/shard-components.mjs', "const owner = 'src/deleted.ts#live';");
    expect(run().status).toBe(1);
    put('scripts/shard-components.mjs', "const owner = 'src/live.ts#live';");
    put('scripts/consumer.mjs', "const source = 'src/missing.ts';");
    expect(run().status).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('frozen layout accepts only explicitly inventoried legacy entries', () => {
  const config = { requiredFiles: [], allowedFiles: [], folders: [], legacy: {} };
  const frozen = { shards: { 'sample-legacy': { primary: 'sample', files: { 'retired.ts': 'hash' } } } };
  expect(checkShardLayout({ 'sample-legacy': ['retired.ts'] }, config, undefined, {}, frozen)).toEqual([]);
  expect(checkShardLayout({ 'sample-legacy': ['unlisted.ts'] }, config, undefined, {}, frozen)).toEqual(['sample-legacy/unlisted.ts: outside the canonical shard layout']);
});
