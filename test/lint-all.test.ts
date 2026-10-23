// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the lint runner through an isolated fake CLI.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Test artifacts stay in the repository scratch root.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real runner before creating its fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the subprocess with the fixture CLI first on PATH.
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';

test('one typed process covers the full selection and each partition, and propagates failure', () => {
  mkdirSync('tmp', { recursive: true });
  const fixture = mkdtempSync(resolve('tmp', 'lint-all-'));
  const binary = resolve(fixture, 'bin'), calls = resolve(fixture, 'calls.txt');
  mkdirSync(binary);
  const files = Array.from({ length: 1025 }, (_, index) => resolve(fixture, `source ${index}.ts`));
  for (const file of files) writeFileSync(file, 'export const value = 0;');
  const selection = resolve(fixture, 'files.txt');
  writeFileSync(selection, files.join('\n'));
  writeFileSync(resolve(binary, 'pnpm'), String.raw`#!/usr/bin/env node
import * as fs from 'node:fs';
const args = process.argv.slice(2);
if (args.join(' ') === 'exec oxlint --debug files') {
  process.stdout.write(fs.readFileSync(process.env.LINT_ALL_SELECTION, 'utf8'));
} else {
  if (args[2] !== '--type-aware') process.exit(9);
  fs.appendFileSync(process.env.LINT_ALL_CALLS, args.slice(3).join('\n') + '\n--batch--\n');
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
    expect(batches.map(batch => batch.length)).toEqual([1025]);
    writeFileSync(calls, '');
    expect(run(true).status).toBe(7);
    expect(readFileSync(calls, 'utf8').match(/--batch--/gu)).toHaveLength(1);
    expect(readFileSync(calls, 'utf8')).toContain('source 1024.ts');
    const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
    const sortedFiles = [...files].sort(compare);
    for (const total of [4, 5]) {
      const partitioned: string[] = [];
      for (let part = 1; part <= total; part++) {
        writeFileSync(calls, '');
        const result = run(false, [`--shard=${part}/${total}`]);
        expect(result.status, result.stderr.toString()).toBe(0);
        const actual = readFileSync(calls, 'utf8').split('\n').filter(line => line.length > 0 && line !== '--batch--');
        expect(readFileSync(calls,'utf8').match(/--batch--/gu)).toHaveLength(1);
        expect(actual).toEqual(sortedFiles.filter((_, index) => index % total === part - 1));
        partitioned.push(...actual);
      }
      expect(new Set(partitioned).size).toBe(files.length);
      expect([...partitioned].sort(compare)).toEqual(sortedFiles);
    }
    writeFileSync(calls,'');
    expect(run(false,['--shard=1/1']).status).toBe(0);
    expect(readFileSync(calls,'utf8').match(/--batch--/gu)).toHaveLength(1);
    for (const invalid of ['--shard=0/4', '--shard=5/4', '--shard=1/0', '--shard=bad']) {
      expect(run(false, [invalid]).status).toBe(2);
    }
    expect([1, 2, 3, 4, 5].map(part => run(true, [`--shard=${part}/5`]).status ?? -1).sort((a, b) => a - b)).toEqual([0, 0, 0, 0, 7]);
    writeFileSync(selection, 'missing-lint-source.ts');
    expect(run(false).status).toBe(1);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('CI runs all five typed partitions beside one types and fast job', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const job = workflow.split('\n  typecheck-lint:')[1]?.split('\n  generated-inputs:')[0] ?? '';
  expect(job).toContain('shard: [types, fast, 1, 2, 3, 4, 5]');
  expect(job).toContain("if: matrix.shard != 'types' && matrix.shard != 'fast'");
  expect(job).toMatch(/\/usr\/bin\/time -v pnpm run lint:typed --shard=\$\{\{ matrix.shard \}\}\/5/u);
  expect(job).toContain('run: pnpm run lint:fast');
  expect(job.match(/pnpm exec tsc --noEmit\n/gu)).toHaveLength(1);
  expect(job).toContain('python3 scripts/ci-products.py unpack-generated');
});
