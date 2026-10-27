// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the lint runner through an isolated fake CLI.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Test artifacts stay in the repository scratch root.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real runner before creating its fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the fixture's pinned CLI with the current runtime.
import { env, execPath } from 'node:process';
import { expect, test } from 'vitest';

test('one typed process covers the full selection and each partition, and propagates failure', () => {
  mkdirSync('tmp', { recursive: true });
  const fixture = mkdtempSync(resolve('tmp', 'lint-all-'));
  const binary = resolve(fixture, 'node_modules/oxlint/bin'), calls = resolve(fixture, 'calls.txt');
  mkdirSync(binary, { recursive: true });
  writeFileSync(resolve(binary, '../package.json'), JSON.stringify({ type: 'module' }));
  const runner = resolve(fixture, 'scripts/lint-all.mjs');
  mkdirSync(resolve(runner, '..'));
  writeFileSync(runner, readFileSync('scripts/lint-all.mjs', 'utf8'));
  const files = Array.from({ length: 1025 }, (_, index) => resolve(fixture, `source ${index}.ts`));
  for (const file of files) writeFileSync(file, 'export const value = 0;');
  const selection = resolve(fixture, 'files.txt');
  writeFileSync(selection, files.join('\n'));
  const cli = resolve(binary, 'oxlint');
  writeFileSync(cli, String.raw`import * as fs from 'node:fs';
const args = process.argv.slice(2);
if (args.join(' ') === '--debug files') {
  process.stdout.write(fs.readFileSync(process.env.LINT_ALL_SELECTION, 'utf8'));
} else {
  if (args[0] !== '--type-aware') process.exit(9);
  const threads = Number(args[2]);
  if (args[1] !== '--threads' || !Number.isSafeInteger(threads) || threads < 1 || threads > 8) process.exit(9);
  const goThreads = Number(process.env.GOMAXPROCS);
  if (!Number.isSafeInteger(goThreads) || goThreads < 1 || goThreads > threads) process.exit(9);
  if (process.env.LINT_ALL_EXPECT_GO && process.env.GOMAXPROCS !== process.env.LINT_ALL_EXPECT_GO) process.exit(9);
  if (!process.env.LINT_ALL_EXPECT_GO && goThreads !== Math.min(process.platform === 'darwin' ? 4 : 8, threads)) process.exit(9);
  for (const name of ['GOGC', 'GOMEMLIMIT']) {
    const expected = process.env['LINT_ALL_EXPECT_' + name];
    if (expected && process.env[name] !== expected) process.exit(9);
  }
  if (process.platform === 'darwin' && !process.env.LINT_ALL_EXPECT_GOGC && process.env.GOGC !== '200') process.exit(9);
  if (process.platform === 'darwin' && !process.env.LINT_ALL_EXPECT_GOMEMLIMIT && process.env.GOMEMLIMIT !== '5GiB') process.exit(9);
  fs.appendFileSync(process.env.LINT_ALL_CALLS, args.slice(3).join('\n') + '\n--batch--\n');
  if (process.env.LINT_ALL_FAIL === 'yes' && args.some(file => file.endsWith('source 256.ts'))) process.exit(7);
}
`, { mode: 0o755 });
  const run = (failure: boolean, args: readonly string[] = [], settings: { workers?: string; gc?: string; memory?: string } = {}): ReturnType<typeof spawnSync> => spawnSync(execPath, [runner, ...args], {
    encoding: 'utf8', env: { ...Object.fromEntries(Object.entries(env).filter(([key]) => !['GOMAXPROCS', 'GOGC', 'GOMEMLIMIT'].includes(key))),
      ...(settings.workers === undefined ? {} : { GOMAXPROCS: settings.workers, LINT_ALL_EXPECT_GO: settings.workers }),
      ...(settings.gc === undefined ? {} : { GOGC: settings.gc, LINT_ALL_EXPECT_GOGC: settings.gc }),
      ...(settings.memory === undefined ? {} : { GOMEMLIMIT: settings.memory, LINT_ALL_EXPECT_GOMEMLIMIT: settings.memory }),
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
    expect(run(false, [], { workers: '1', gc: '100', memory: '3GiB' }).status).toBe(0);
    for (const invalid of ['--shard=0/4', '--shard=5/4', '--shard=1/0', '--shard=bad']) {
      expect(run(false, [invalid]).status).toBe(2);
    }
    expect([1, 2, 3, 4, 5].map(part => run(true, [`--shard=${part}/5`]).status ?? -1).sort((a, b) => a - b)).toEqual([0, 0, 0, 0, 7]);
    writeFileSync(selection, 'missing-lint-source.ts');
    expect(run(false).status).toBe(1);
    rmSync(cli);
    expect(run(false).status).toBe(1);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('CI runs all five typed partitions beside one types and fast job', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const job = workflow.split('\n  typecheck-lint:')[1]?.split('\n  derived-docs:')[0] ?? '';
  expect(job).toContain('shard: [types, fast, 1, 2, 3, 4, 5]');
  expect(job).toContain("if: matrix.shard != 'types' && matrix.shard != 'fast'");
  expect(job).toMatch(/\/usr\/bin\/time -v pnpm run lint:typed --shard=\$\{\{ matrix.shard \}\}\/5/u);
  expect(job).toContain('run: python3 scripts/ci-fail-fast.py -- pnpm run lint:fast');
  expect(job).toContain('fail-fast: false');
  expect(job).not.toContain('fail-fast: true');
  expect(job.match(/pnpm exec tsc --noEmit\n/gu)).toHaveLength(1);
  expect(job).toContain('python3 scripts/ci-products.py unpack-generated');
});
