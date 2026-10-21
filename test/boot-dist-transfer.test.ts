// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual CI artifact restore script.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct tiny checksum-protected transfer fixtures.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Each test owns and removes its artifact directory.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the shipped script independently of fixture cwd.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Lend only fixture-specific variables to the restore child.
import { env as nodeEnv } from 'node:process';
import { afterEach, expect, test } from 'vitest';

const script = resolve('scripts/restore-boot-dist.sh'), roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(resolve('tmp/boot-dist-transfer-')); roots.push(root);
  const fresh = join(root, 'fresh'), source = join(root, 'source'), bin = join(root, 'bin'), calls = join(root, 'calls');
  for (const path of [fresh, source, bin]) mkdirSync(path);
  writeFileSync(join(source, 'version.json'), '{"build":"aaaaaaa-fixture"}');
  const packed = spawnSync('tar', ['-cf', join(fresh, 'boot-dist.tar'), '-C', source, '.'], { encoding: 'utf8' });
  if (packed.status !== 0) throw new Error(packed.stderr);
  const checksum = (directory: string): void => {
    const digest = createHash('sha256').update(readFileSync(join(directory, 'boot-dist.tar'))).digest('hex');
    writeFileSync(join(directory, 'boot-dist.sha256'), `${digest}  boot-dist.tar\n`);
  };
  checksum(fresh); writeFileSync(join(fresh, 'boot-dist-proof.json'), '{"sha":"fixture","run":"123"}');
  for (const name of ['boot-dist.tar', 'boot-dist.sha256', 'boot-dist-proof.json']) copyFileSync(join(fresh, name), join(root, name));
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SMOKE_FIXTURE_CALLS"
if [ "$SMOKE_FIXTURE_DOWNLOAD_FAIL" = 1 ]; then exit 23; fi
cp "$SMOKE_FIXTURE_FRESH/boot-dist.tar" "$SMOKE_FIXTURE_FRESH/boot-dist.sha256" "$SMOKE_FIXTURE_FRESH/boot-dist-proof.json" .
if [ "$SMOKE_FIXTURE_CORRUPT" = 1 ]; then printf bad > boot-dist.tar; fi
`, { mode: 0o755 });
  const env = { ...nodeEnv, PATH: `${bin}:${nodeEnv['PATH'] ?? ''}`, GITHUB_RUN_ID: '123', GITHUB_REPOSITORY: 'fixture/repo',
    SMOKE_FIXTURE_CALLS: calls, SMOKE_FIXTURE_FRESH: fresh, SMOKE_FIXTURE_CORRUPT: '0', SMOKE_FIXTURE_DOWNLOAD_FAIL: '0' };
  return { root, env, checksum, restore: () => spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' }),
    calls: () => existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : [] };
}

test('a complete exact-run archive restores without downloading again', () => {
  const f = fixture(), result = f.restore();
  expect(result.status, result.stderr).toBe(0); expect(f.calls()).toEqual([]);
  expect(readFileSync(join(f.root, 'dist/version.json'), 'utf8')).toContain('aaaaaaa-fixture');
});

test('a truncated transfer downloads the same run and named artifact exactly once', () => {
  const f = fixture(), archive = join(f.root, 'boot-dist.tar');
  writeFileSync(archive, readFileSync(archive).subarray(0, 128));
  const result = f.restore();
  expect(result.status, result.stderr).toBe(0);
  expect(f.calls()).toEqual(['run download 123 --repo fixture/repo --name boot-dist --dir .']);
});

test('a checksum-matching tar failure retries and removes partial dist files', () => {
  const f = fixture(); writeFileSync(join(f.root, 'boot-dist.tar'), 'not a tar'); f.checksum(f.root);
  mkdirSync(join(f.root, 'dist')); writeFileSync(join(f.root, 'dist/stale'), 'partial');
  const result = f.restore();
  expect(result.status, result.stderr).toBe(0); expect(f.calls()).toHaveLength(1);
  expect(existsSync(join(f.root, 'dist/stale'))).toBe(false);
  expect(existsSync(join(f.root, 'dist/version.json'))).toBe(true);
});

test('a second corrupt download refuses instead of accepting or retrying indefinitely', () => {
  const f = fixture(); writeFileSync(join(f.root, 'boot-dist.tar'), 'bad'); f.env.SMOKE_FIXTURE_CORRUPT = '1';
  expect(f.restore().status).not.toBe(0); expect(f.calls()).toHaveLength(1);
  expect(existsSync(join(f.root, 'dist/version.json'))).toBe(false);
});

test('a missing initial download can recover from one complete transfer', () => {
  const f = fixture(); unlinkSync(join(f.root, 'boot-dist.sha256'));
  const result = f.restore();
  expect(result.status, result.stderr).toBe(0); expect(f.calls()).toHaveLength(1);
});

test('an unsuccessful replacement download remains fatal', () => {
  const f = fixture(); writeFileSync(join(f.root, 'boot-dist.tar'), 'bad'); f.env.SMOKE_FIXTURE_DOWNLOAD_FAIL = '1';
  expect(f.restore().status).toBe(23); expect(f.calls()).toHaveLength(1);
});
