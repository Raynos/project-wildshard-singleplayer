// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the lint runner through an isolated fake CLI.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Test artifacts stay in the repository scratch root.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real runner before creating its fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the subprocess with the fixture CLI first on PATH.
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';

test('complete lint batches cover every selected file and propagate a child failure', () => {
  mkdirSync('tmp', { recursive: true });
  const fixture = mkdtempSync(resolve('tmp', 'lint-all-'));
  const binary = resolve(fixture, 'bin'), calls = resolve(fixture, 'calls.txt');
  mkdirSync(binary);
  const files = Array.from({ length: 513 }, (_, index) => resolve(fixture, `source ${index}.ts`));
  for (const file of files) writeFileSync(file, 'export const value = 0;');
  const selection = resolve(fixture, 'files.txt');
  writeFileSync(selection, files.join('\n'));
  writeFileSync(resolve(binary, 'pnpm'), String.raw`#!/usr/bin/env node
import * as fs from 'node:fs';
const args = process.argv.slice(2);
if (args.join(' ') === 'exec oxlint --debug files') {
  process.stdout.write(fs.readFileSync(process.env.LINT_ALL_SELECTION, 'utf8'));
} else {
  fs.appendFileSync(process.env.LINT_ALL_CALLS, args.slice(2).join('\n') + '\n--batch--\n');
  if (process.env.LINT_ALL_FAIL === 'yes' && args.some(file => file.endsWith('source 256.ts'))) process.exit(7);
}
`, { mode: 0o755 });
  const run = (failure: boolean, args: readonly string[] = []): ReturnType<typeof spawnSync> => spawnSync(execPath, [resolve('scripts/lint-all.mjs'), ...args], {
    encoding: 'utf8', env: { ...env, PATH: `${binary}:${env['PATH'] ?? ''}`,
      LINT_ALL_SELECTION: selection, LINT_ALL_CALLS: calls, LINT_ALL_FAIL: failure ? 'yes' : 'no' },
  });
  try {
    const success = run(false);
    expect(success.status, success.stderr.toString()).toBe(0);
    const batches = readFileSync(calls, 'utf8').trim().split('\n--batch--').filter(Boolean).map(batch => batch.trim().split('\n'));
    expect(batches.flat()).toEqual(files);
    expect(batches.map(batch => batch.length)).toEqual([256, 256, 1]);
    writeFileSync(calls, '');
    expect(run(true).status).toBe(7);
    expect(readFileSync(calls, 'utf8')).not.toContain('source 512.ts');
    const partitioned: string[] = [];
    const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
    const sortedFiles = [...files].sort(compare);
    for (const part of [1, 2, 3, 4]) {
      writeFileSync(calls, '');
      const result = run(false, [`--shard=${part}/4`]);
      expect(result.status, result.stderr.toString()).toBe(0);
      const actual = readFileSync(calls, 'utf8').split('\n').filter(line => line.length > 0 && line !== '--batch--');
      expect(actual).toEqual(sortedFiles.filter((_, index) => index % 4 === part - 1));
      partitioned.push(...actual);
    }
    expect(new Set(partitioned).size).toBe(files.length);
    expect([...partitioned].sort(compare)).toEqual(sortedFiles);
    for (const invalid of ['--shard=0/4', '--shard=5/4', '--shard=1/0', '--shard=bad']) {
      expect(run(false, [invalid]).status).toBe(2);
    }
    expect([1, 2, 3, 4].map(part => run(true, [`--shard=${part}/4`]).status ?? -1).sort((a, b) => a - b)).toEqual([0, 0, 0, 7]);
    writeFileSync(selection, 'missing-lint-source.ts');
    expect(run(false).status).toBe(1);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
