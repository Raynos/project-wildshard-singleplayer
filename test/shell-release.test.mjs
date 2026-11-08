import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { checkLegacyImports } from '../scripts/check-shell.mjs';
const root = resolve(import.meta.dirname, '..');
test('legacy imports must be explicitly frozen and cannot enter the release path', () => {
  const file = 'test/legacy.ts', blobs = new Map([[file, 'original']]);
  const archive = { schema: 1, files: [{ path: file, blob: 'original', reason: 'Inactive pre-split fixture' }] };
  const read = () => "import { old } from '" + "../src/game/old" + "';";
  assert.throws(() => checkLegacyImports(blobs, read, { schema: 1, files: [] }, ''), /Unrecorded legacy/u);
  checkLegacyImports(blobs, read, archive, '');
  assert.throws(() => checkLegacyImports(blobs, read, archive, `node ${file}`), /Inactive source on release path/u);
  assert.throws(() => checkLegacyImports(new Map([[file, 'changed']]), read, archive, ''), /Changed inactive source/u);
});
function fixture(run) {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const cwd = mkdtempSync(join(root, 'tmp/shell-release-'));
  try { run(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}
test('Vercel packaging runs the output check only and restores config even on native failure', () => fixture(cwd => {
  const bin = join(cwd, 'bin'); mkdirSync(bin);
  const config = '{\n  "buildCommand": "original", "headers": []\n}\n';
  writeFileSync(join(cwd, 'vercel.json'), config);
  writeFileSync(join(bin, 'vercel'), `#!/usr/bin/env node
import fs from 'node:fs';
fs.writeFileSync('observed.json', JSON.stringify({args:process.argv.slice(2),config:JSON.parse(fs.readFileSync('vercel.json'))}));
process.exit(Number(process.env.NATIVE_EXIT));
`);
  chmodSync(join(bin, 'vercel'), 0o755);
  for (const code of [0, 23]) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/build-vercel-output.mjs')], {
      cwd, encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, VERCEL_BUILD_TOKEN: 'fixture-only', NATIVE_EXIT: String(code) },
    });
    assert.equal(result.status, code, result.stderr);
    assert.equal(readFileSync(join(cwd, 'vercel.json'), 'utf8'), config);
    const observed = JSON.parse(readFileSync(join(cwd, 'observed.json'), 'utf8'));
    assert.deepEqual(observed.args, ['build', '--standalone', '--prod', '--scope', 'raynos-projects', '--token', 'fixture-only']);
    assert.equal(observed.config.buildCommand, 'node scripts/check-release-output.mjs');
    assert.equal(observed.config.installCommand, 'true');
    assert.equal(observed.config.outputDirectory, 'dist');
  }
}));
test('the retired rollback refuses before Git, network or pin mutation', () => fixture(cwd => {
  mkdirSync(join(cwd, '.github'));
  const file = join(cwd, '.github/deploy-pin.json'), original = '{"mode":"pinned","sha":"held"}\n';
  writeFileSync(file, original);
  const result = spawnSync(process.execPath, [join(root, 'scripts/deploy-pin.mjs'), 'rollback', 'old', '--go', 'fixture'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /retired by J179.*Fix forward.*manual vercel rollback/u);
  assert.equal(readFileSync(file, 'utf8'), original);
}));
for (const name of ['shell-prebuilt.py', 'shell-stage.py']) test(`${name}: real shell release controller boundaries`, () => {
  const result = spawnSync('python3', [join(root, 'test', name)], { cwd: root, encoding: 'utf8', timeout: 4000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
