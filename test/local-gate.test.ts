import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real bounded process owner in an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths belong to this test and are removed in finally.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place owned fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual gate helper rather than a mock.
import { join, resolve } from 'node:path';

it('fails closed at its deadline and kills descendants', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-gate-deadline-'));
  try {
    const code = `import importlib.util, pathlib, sys, time
spec=importlib.util.spec_from_file_location('gate',sys.argv[1])
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
child="import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',\\"import time,pathlib;time.sleep(.5);pathlib.Path('escaped').write_text('bad')\\"]);time.sleep(10)"
assert gate.bounded([sys.executable,'-c',child],sys.argv[2],time.monotonic()+.1)==124
time.sleep(.6)
assert not pathlib.Path(sys.argv[2],'escaped').exists()
`;
    const run = spawnSync('python3', ['-c', code, resolve('scripts/local-gate.py'), root], { encoding: 'utf8', timeout: 4000 });
    expect(run.status, run.stdout + run.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('pushes without regeneration and keeps the related-only local plan', () => {
  const source = readFileSync('scripts/push-main.sh', 'utf8');
  expect(source).not.toContain('node scripts/regenerate-committed.mjs');
  const gate = readFileSync('scripts/local-gate.py', 'utf8');
  expect(gate).toContain('CAP_SECONDS = 120');
  expect(gate).toContain("'related'");
  expect(gate).not.toContain('vite build');
  expect(gate).not.toContain('bake-check');
  expect(readFileSync('.github/workflows/boot-smoke.yml', 'utf8')).toContain('node scripts/webkit-render-smoke.mjs --dist=dist');
});

it('retains strict diagnostics in a changed root', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-gate-types-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true }, include: ['*.ts'] }));
    writeFileSync(join(root, 'changed.ts'), 'const value: string = 123; export {value};');
    writeFileSync(join(root, 'changed.json'), '["changed.ts"]');
    const run = spawnSync('node', [resolve('scripts/local-gate-checks.mjs'), 'types', 'changed.json'], { cwd: root, encoding: 'utf8', timeout: 5000 });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('not assignable to type');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
