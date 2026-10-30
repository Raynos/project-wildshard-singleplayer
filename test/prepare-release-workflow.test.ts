// oxlint-disable-next-line import/no-nodejs-modules -- Verify the real prepare workflow's shell admission without packaging or a network request.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own one small command fixture under repository scratch.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture's executable and output paths.
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('prepare enables Vercel only on push and binds both packs to the exact source run', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const prepare = workflow.split('\n  prepare:\n')[1]?.split(/\n {2}[a-z][\w-]*:\n/u)[0];
  if (prepare === undefined) throw new Error('Missing prepare producer');
  const pack = prepare.split('      - name: Pack the exact web build for boot smoke\n')[1]?.split('      - uses:')[0];
  const body = /run: \|\n((?: {10}[^\n]*\n)+)/u.exec(pack ?? '')?.[1];
  if (body === undefined) throw new Error('Missing release packaging admission');
  const script = body.split('\n').map(line => line.slice(10)).join('\n');
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/prepare-release-shell-')), output = join(root, 'argv');
  try {
    const executable = join(root, 'python3');
    writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$@" > "$PACK_ARGS"\n');
    chmodSync(executable, 0o755);
    for (const event of ['push', 'pull_request']) {
      const sha = 'a'.repeat(40), run = '123';
      const result = spawnSync('/bin/bash', ['-eu', '-c', script], { encoding: 'utf8', env: {
        ...process.env, PATH: `${root}:/usr/bin:/bin`, PACK_ARGS: output,
        GITHUB_EVENT_NAME: event, GITHUB_SHA: sha, GITHUB_RUN_ID: run,
      } });
      expect(result.status, result.stderr).toBe(0);
      const args = readFileSync(output, 'utf8').trim().split('\n');
      expect(args.slice(0, 4)).toEqual(['scripts/ci-fail-fast.py', '--', 'node', 'scripts/prepare-release-packs.mjs']);
      expect(args.slice(4)).toEqual(['--sha', sha, '--run', run, ...(event === 'push' ? ['--vercel'] : [])]);
    }
    const producer = prepare.indexOf('node scripts/prepare-release-packs.mjs');
    expect(producer).toBeGreaterThan(prepare.indexOf('scripts/check-css.mjs'));
    for (const artifact of ['boot-dist-manifest', 'boot-dist-boot-public', 'boot-dist-boot-developer', 'boot-dist-worlds', 'boot-dist-phone-route', 'vercel-prebuilt'])
      expect(prepare.indexOf(`name: ${artifact}\n`), artifact).toBeGreaterThan(producer);
    expect(prepare).not.toContain('npm install --global vercel');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
