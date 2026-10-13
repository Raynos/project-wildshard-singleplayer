// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual CI composition root in an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture products and executables are owned temporary files.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Allocate an isolated temporary repository.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Compose platform-correct fixture paths and executable search paths.
import { dirname, delimiter, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the actual Node and tool environment for child processes.
import { env, execPath } from 'node:process';
import { expect, it } from 'vitest';

function fixture(fail: 'none' | 'generation' | 'products'): void {
  const root = mkdtempSync(join(tmpdir(), 'ci-product-order-'));
  const put = (file: string, text: string, mode = 0o644) => {
    const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text, { mode });
  };
  try {
    put('package.json', JSON.stringify({ scripts: { 'test:checks': 'pnpm gen && node scripts/read-check.mjs' } }));
    put('bin/pnpm', `#!/bin/sh\n${fail === 'generation' ? 'exit 23' : 'printf ready > generation-ready'}\n`, 0o755);
    put('scripts/build-shardfiles.mjs', `import {readFileSync,writeFileSync} from 'node:fs';
if(readFileSync('generation-ready','utf8')!=='ready')throw Error('Generation was not ready');
${fail === 'products' ? "throw Error('Product compilation refused');" : "writeFileSync('compiled-product','verified');"}`);
    for (const name of ['check', 'build']) put(`scripts/read-${name}.mjs`, `import {readFileSync,writeFileSync} from 'node:fs';
if(readFileSync('compiled-product','utf8')!=='verified')throw Error('Canonical product missing');
writeFileSync('${name}-consumed','yes');`);
    copyFileSync(resolve('scripts/ci-checks.mjs'), join(root, 'scripts/ci-checks.mjs'));
    const result = spawnSync(execPath, ['scripts/ci-checks.mjs', 'node scripts/read-build.mjs'], {
      cwd: root, encoding: 'utf8', env: { ...env, PATH: `${join(root, 'bin')}${delimiter}${env['PATH'] ?? ''}` },
    });
    expect(result.status, result.stdout + result.stderr).toBe(fail === 'none' ? 0 : 1);
    for (const name of ['check', 'build']) expect(existsSync(join(root, `${name}-consumed`))).toBe(fail === 'none');
    expect(existsSync(join(root, 'compiled-product'))).toBe(fail === 'none');
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('publishes generated products before both canonical readers and the application build start', () => { fixture('none'); });
it.each(['generation', 'products'] as const)('refuses failed %s before starting any reader or build', (phase) => { fixture(phase); });
