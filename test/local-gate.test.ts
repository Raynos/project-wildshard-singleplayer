import { expect, it } from 'vitest';
import { budgetTests } from '../scripts/local-gate-checks.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real bounded process owner in an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths belong to this test and are removed in finally.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
  expect(gate).toContain("plan['local']");
  expect(gate).not.toContain('vite build');
  expect(gate).not.toContain('bake-check');
  expect(readFileSync('.github/workflows/boot-smoke.yml', 'utf8')).toContain('node scripts/webkit-render-smoke.mjs --dist=dist');
});

it('packs affected tests into a bounded local budget and names the full CI handoff', () => {
  const affected = ['test/new.test.ts', 'test/fast.test.ts', 'test/slow.test.ts'];
  const plan = budgetTests(affected, {'test/fast.test.ts': .1, 'test/slow.test.ts': 30}, ['test/new.test.ts']);
  expect(plan.local).toEqual(['test/new.test.ts', 'test/fast.test.ts']);
  expect(plan.ci).toEqual(['test/slow.test.ts']);
  expect(plan.predictedSeconds).toBeLessThanOrEqual(45);
  expect([...plan.local, ...plan.ci].sort()).toEqual(affected.sort());
  const large = budgetTests(Array.from({length:100}, (_,i) => `test/${i}.test.ts`), {}, []);
  expect(large.predictedSeconds).toBeLessThanOrEqual(45);
  expect(large.local.length + large.ci.length).toBe(100);
});

it('retains strict diagnostics in a changed root', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-gate-types-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true }, include: ['*.ts'] }));
    writeFileSync(join(root, 'changed.ts'), 'const value: string = 123; export {value};');
    writeFileSync(join(root, 'ambient.ts'), 'declare global {interface Window {fixture: string}} export {};');
    writeFileSync(join(root, 'changed.json'), '["changed.ts"]');
    const run = spawnSync('node', [resolve('scripts/local-gate-checks.mjs'), 'types', 'changed.json'], { cwd: root, encoding: 'utf8', timeout: 5000 });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('not assignable to type');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('retains Node declarations for narrowed SDK and test composition roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-gate-node-types-'));
  try {
    mkdirSync(join(root,'node_modules'));
    symlinkSync(resolve('node_modules/@types'),join(root,'node_modules/@types'),'dir');
    writeFileSync(join(root,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,skipLibCheck:true,target:'ES2022',module:'ESNext',moduleResolution:'bundler',types:[]},include:['*.ts']}));
    writeFileSync(join(root,'changed.ts'),"import{readFileSync}from'node:fs'; export const value: Uint8Array = readFileSync('/dev/null');");
    writeFileSync(join(root,'changed.json'),'["changed.ts"]');
    const run = spawnSync('node',[resolve('scripts/local-gate-checks.mjs'),'types','changed.json'],{cwd:root,encoding:'utf8',timeout:5000});
    expect(run.status,run.stdout+run.stderr).toBe(0);
  } finally {rmSync(root,{recursive:true,force:true});}
});
