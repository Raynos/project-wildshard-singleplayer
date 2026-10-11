// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual author recipe in its disposable installed project.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own all generated package and proof bytes.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the already-installed official compiler, not a test substitute.
import { createRequire } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Every fixture is isolated from repository/package state.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact owned fixture paths.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Child proofs use this exact Node executable.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare Node's canonical file URL, including resolved macOS tmp symlinks.
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { compileAuthoringExamples } from './fake/authoringCompiler';

it('typechecks the executing native proof against the public SDK and commons', () => {
  expect(compileAuthoringExamples(join(import.meta.dirname, '..'), [join(import.meta.dirname, '../scripts/docs/author-project/prove-native.ts')])).toEqual([]);
});

it('executes installed commons TS through the documented bundle while preserving SDK worker and three identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'author-proof-bundle-'));
  const require = createRequire(import.meta.url);
  const viteRequire = createRequire(require.resolve('vite/package.json'));
  const compiler = join(dirname(viteRequire.resolve('rolldown/package.json')), 'bin/cli.mjs');
  const put = (file: string, value: string) => {
    const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value);
  };
  try {
    put('package.json', '{"type":"module"}');
    put('node_modules/@wildshard/commons/package.json', '{"type":"module","exports":{"./pack":"./pack.ts"}}');
    put('node_modules/@wildshard/commons/pack.ts', 'export const count: number = 7;');
    put('node_modules/@wildshard/sdk/package.json', '{"type":"module","exports":{"./headless":"./headless.js"}}');
    put('node_modules/@wildshard/sdk/headless.js', 'export const worker = new URL("worker.js", import.meta.url).href;');
    put('node_modules/three/package.json', '{"type":"module","exports":"./index.js"}');
    put('node_modules/three/index.js', 'export const identity = "installed-three";');
    const source = 'import {count} from "@wildshard/commons/pack"; import {worker} from "@wildshard/sdk/headless"; import {identity} from "three"; console.info(JSON.stringify({count,worker,identity}));';
    put('audit.ts', source);
    cpSync('scripts/docs/author-project/proof.config.mjs', join(root, 'proof.config.mjs'));
    const raw = spawnSync(execPath, ['audit.ts'], { cwd: root, encoding: 'utf8' });
    expect(raw.status).not.toBe(0);
    expect(raw.stderr).toContain('ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING');
    execFileSync(execPath, [compiler, '--config', 'proof.config.mjs', '--input', 'audit.ts'], { cwd: root, stdio: 'pipe' });
    const bundle = readFileSync(join(root, 'proof-tools/audit.mjs'), 'utf8');
    expect(bundle).toContain('@wildshard/sdk/headless'); expect(bundle).toContain('from "three"');
    const result: unknown = JSON.parse(execFileSync(execPath, ['proof-tools/audit.mjs'], { cwd: root, encoding: 'utf8' }));
    expect(result).toEqual({ count: 7, worker: pathToFileURL(join(realpathSync(root), 'node_modules/@wildshard/sdk/worker.js')).href, identity: 'installed-three' });
    expect(readFileSync(join(root, 'audit.ts'), 'utf8')).toBe(source);
    expect(readFileSync(join(root, 'node_modules/@wildshard/commons/pack.ts'), 'utf8')).toBe('export const count: number = 7;');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
