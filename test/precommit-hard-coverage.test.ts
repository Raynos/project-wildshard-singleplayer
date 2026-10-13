// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual isolated commit binaries.
import { spawn, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture repositories and receipts only.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture roots.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture sources and installed binaries.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Same runtime as the actual hook.
import { env, execPath } from 'node:process';
import { expect, it } from 'vitest';
import { beginGuardRequirement, completeGuardRequirement, hardRules, requiredGuardRules, verifyGuardRequirement } from '../scripts/guard-counts.mjs';
import {precommitGuards} from '../scripts/precommit-guards.mjs';

const refusals: Record<string, [string, string]> = {
  'no-url-switch': ['engine/check.ts', "new URLSearchParams(location.search).get('unapproved');"],
  'no-inline-ui-string': ['engine/label.ts', "node.textContent = 'unapproved';"],
  'no-authored-html': ['engine/html.ts', 'declare const value: string; node.innerHTML = value;'],
  'no-shard-branch': ['game/branch.ts', "slug === 'pine-hollow';"],
  'no-raw-save': ['engine/save.mts', "localStorage.getItem('unapproved');"],
  'no-raw-input': ['engine/input.ts', "window.addEventListener('keydown', handler);"],
  'no-global-listener-patch': ['engine/listener.ts', 'setTimeout(handler, 1);'],
  'no-raw-shader-patch': ['engine/shader.ts', 'material.onBeforeCompile = handler;'],
  'sim-no-render': ['engine/ai/render.ts', "import { Mesh } from 'three'; export const mesh = new Mesh();"],
  'no-runtime-generator': ['shards/fixture/runtime/generator.ts', "import { value } from '../generators/value';"],
  'runtime-performance': ['shards/fixture/runtime/alloc.ts', 'export function update() { return new Float32Array(3); }'],
  'no-active-chunk': ['engine/chunk.ts', 'getActiveChunk();'],
  'no-raw-hud': ['engine/hud.ts', 'document.body.appendChild(node);'],
  'no-raw-animation-mixer': ['engine/mixer.ts', 'new AnimationMixer(root);'],
  'no-hook-chain': ['engine/hooks.ts', 'const previous = object.onUpdate; object.onUpdate = handler;'],
  'no-renderer-type': ['engine/renderer.ts', 'let renderer: WebGLRenderer;'],
  'no-active-singleton': ['engine/singleton.ts', 'activePhysics();'],
  'engine-internal': ['shards/fixture/runtime/internal.ts', "import { configureLevel } from '@wildshard/engine/level/selection';"],
  'no-reexport': ['game/reexport.ts', "export { value } from './definition';"],
  'legacy-npc-imports': ['game/npc.ts', "import { head } from './systems/npc/faceHeads';"],
  'no-level-identity': ['engine/identity.ts', "level.id === 'unapproved';"],
  'runtime-commons': ['shards/fixture/runtime/commons.ts', "import { value } from '@wildshard/commons/packs/bag';"],
  layer: ['engine/layer.ts', "import { value } from '@wildshard/game/plugin/context';"],
  'engine-words': ['engine/words.ts', "export const label = 'coin';"],
  'shard-names': ['game/name.ts', "export const label = 'Pine Hollow';"],
};

function fixture(): { root: string; put: (file: string, code: string) => void; git: (...args: string[]) => string } {
  const root = mkdtempSync(join(tmpdir(), 'commit-hard-coverage-'));
  const put = (file: string, code: string): void => { const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, code); };
  for (const folder of ['scripts', 'lint', '.githooks']) cpSync(folder, join(root, folder), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json', '.oxlintrc.json', '.oxlintrc.ratchet.json']) put(file, readFileSync(file, 'utf8'));
  for (const layer of ['engine', 'format', 'game', 'sdk', 'commons']) put(`src/${layer}/package.json`, readFileSync(`src/${layer}/package.json`, 'utf8'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
  put('lint/legacy-shards.json', '{"version":1,"sealed":false,"shards":{}}');
  put('scripts/generation-jobs.json', '{"jobs":[]}');
  put('lint/ratchet.json', '{}');
  put('lint/class-moves.json', '{"version":1,"moves":{}}');
  put('src/engine/valid.ts', 'export const value = 1;');
  const git = (...args: string[]): string => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr); return result.stdout.trim(); };
  git('init', '-q'); git('config','gc.auto','0'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
  return { root, put, git };
}

it('refuses every hard rule through the mandatory commit guard, including all measured extensions', async () => {
  const f = fixture();
  const options = { ...env }; delete options['SKIP_ARCH_GUARDS'];
  const hard = hardRules('.oxlintrc.json');
  expect(Object.keys(refusals).map(rule => `wildshard/${rule}`).sort()).toEqual([...hard].sort());
  try {
    for (const [file, code] of Object.values(refusals)) f.put(`src/${file}`, code);
    f.put('src/shards/fixture/generators/value.ts', 'export const value = 1;');
    const dataHash='44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
    f.put('scripts/generation-jobs.json',JSON.stringify({jobs:[{buildOutputs:{'src/shards/fixture/data/rows.json':dataHash}}]}));
    const extensions = ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'];
    for (const extension of extensions) f.put(`src/engine/extension.${extension}`, "localStorage.getItem('unapproved');");
    f.git('add', 'src','scripts/generation-jobs.json');
    const paths = f.git('diff', '--cached', '--name-only').split('\n').filter(path=>/^src\/.*\.[cm]?[jt]sx?$/u.test(path));
    const lint = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', '.oxlintrc.ratchet.json', '-f', 'json', ...paths], { cwd: f.root, encoding: 'utf8' });
    const output = JSON.parse(lint.stdout) as { diagnostics: { code: string; filename: string }[] };
    const debt: Record<string, Record<string, number>> = {};
    for (const diagnostic of output.diagnostics) {
      const rule = diagnostic.code.replace(/^wildshard\((.*)\)$/u, 'wildshard/$1');
      if (hard.has(rule)) continue;
      debt[rule] ??= {}; const row = debt[rule];
      row[diagnostic.filename] = (row[diagnostic.filename] ?? 0) + 1;
    }
    f.put('lint/ratchet.json', JSON.stringify(debt)); f.git('add', 'lint/ratchet.json');
    f.put('.measure-paths.json',JSON.stringify(paths));
    const full=spawnSync(execPath,['lint/ratchet.mjs','--update','--files-from','.measure-paths.json'],{cwd:f.root,env:{...options,SKIP_ARCH_GUARDS:'1'},encoding:'utf8'});
    expect(full.status).toBe(1); expect(full.stderr).toContain('no-raw-save');
    const receipt = join(f.root, '.required-guard'), status = join(f.root, '.inputs-status');
    const guard = spawn(execPath, ['scripts/precommit-guards.mjs', '--required-receipt', receipt], {
      cwd: f.root, env: { ...options, WS_PRECOMMIT_INPUTS_DONE: status }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', measured = false, published = false;
    let measurementError: unknown;
    guard.stdout.on('data', (chunk: Buffer) => {
      stdout += String(chunk);
      if (!published && stdout.includes('waiting for pinned data')) {
        published=true;
        f.put(`.git/commit-inputs/blobs/${dataHash}`,'{}');
        f.put('.inputs-status.data',JSON.stringify({tree:f.git('write-tree')}));
      }
      if (!measured && stdout.includes('waiting for final inputs')) {
        measured = true;
        try {
        f.put('.measure-paths.json', JSON.stringify(paths));
        const result = spawnSync(execPath, ['lint/ratchet.mjs', '--update', '--files-from', '.measure-paths.json', '--guard-required', receipt], { cwd: f.root, env: options, encoding: 'utf8' });
        expect(result.status, result.stderr).toBe(0);
        f.git('add', 'lint/ratchet.json');
        writeFileSync(status, '0');
        } catch (error) { measurementError=error; writeFileSync(status,'1'); }
      }
    });
    guard.stderr.on('data', (chunk: Buffer) => { stderr += String(chunk); });
    const code = await new Promise<number | null>((_resolve, reject) => { guard.on('error', reject); guard.on('close', _resolve); });
    if (measurementError!==undefined) throw new Error('Commit measurement failed',{cause:measurementError});
    expect(published).toBe(true);
    expect(measured).toBe(true); expect(code).toBe(1);
    for (const [rule, [file]] of Object.entries(refusals)) expect(stderr, rule).toContain(`src/${file}: wildshard(${rule})`);
    for (const extension of extensions) expect(stderr).toContain(`src/engine/extension.${extension}: wildshard(no-raw-save)`);
    expect(() => verifyGuardRequirement(f.root, receipt)).toThrow();
    const skipped = spawnSync(execPath, ['scripts/precommit-guards.mjs', '--required-receipt', join(f.root, '.skipped')], { cwd: f.root, env: { ...options, SKIP_ARCH_GUARDS: '1' }, encoding: 'utf8' });
    expect(skipped.status).toBe(1); expect(skipped.stderr).toContain('cannot be skipped');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

it('binds required coverage and final success to the exact source, config, scope and parent', () => {
  const f = fixture(), receipt = join(f.root, '.required');
  try {
    f.put('src/engine/valid.ts', 'export const value = 2;'); f.git('add', 'src');
    beginGuardRequirement(f.root, receipt);
    expect(requiredGuardRules(f.root, receipt, ['src/engine/valid.ts'])).toEqual(hardRules('.oxlintrc.json'));
    expect(() => verifyGuardRequirement(f.root, receipt)).toThrow();
    expect(() => requiredGuardRules(f.root, receipt, ['src/engine/other.mts'])).toThrow('does not cover');
    f.put('src/engine/valid.ts', 'export const value = 3;');
    expect(() => requiredGuardRules(f.root, receipt, ['src/engine/valid.ts'])).toThrow('source changed');
    f.put('src/engine/valid.ts', 'export const value = 2;');
    const config = readFileSync(join(f.root, '.oxlintrc.json'), 'utf8');
    f.put('.oxlintrc.json', `${config}\n`);
    expect(() => requiredGuardRules(f.root, receipt, ['src/engine/valid.ts'])).toThrow('definition changed');
    f.put('.oxlintrc.json', config);
    completeGuardRequirement(f.root, receipt); expect(() => verifyGuardRequirement(f.root, receipt)).not.toThrow();
    f.put('src/engine/valid.ts', 'export const value = 3;'); f.git('add', 'src');
    expect(() => verifyGuardRequirement(f.root, receipt)).toThrow('did not pass');
    f.put('src/engine/valid.ts', 'export const value = 2;'); f.git('add','src');
    f.git('-c','core.hooksPath=/dev/null','commit','--allow-empty','-qm','parent moved');
    expect(() => verifyGuardRequirement(f.root, receipt)).toThrow('did not pass');
    writeFileSync(receipt, '{}'); expect(() => requiredGuardRules(f.root, receipt, [])).toThrow();
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

it('checks newly produced source on the final index even when the initial guard scope is empty', async () => {
  const f=fixture(), receipt=join(f.root,'.required'), status=join(f.root,'.inputs-status');
  const options={...env}; delete options['SKIP_ARCH_GUARDS'];
  try {
    f.put('scripts/candidate.mjs','export const value=1;'); f.git('add','scripts/candidate.mjs');
    const guard=spawn(execPath,['scripts/precommit-guards.mjs','--required-receipt',receipt],{
      cwd:f.root,env:{...options,WS_PRECOMMIT_INPUTS_DONE:status},stdio:['ignore','pipe','pipe'],
    });
    let stdout='', stderr='', published=false;
    guard.stdout.on('data',(chunk: Buffer)=>{
      stdout+=String(chunk);
      if (!published && stdout.includes('waiting for final inputs')) {
        published=true;
        f.put('src/engine/produced.mts',"localStorage.getItem('unapproved');"); f.git('add','src');
        writeFileSync(status,'0');
      }
    });
    guard.stderr.on('data',(chunk: Buffer)=>{stderr+=String(chunk);});
    const code=await new Promise<number|null>((_resolve,reject)=>{guard.on('error',reject);guard.on('close',_resolve);});
    expect(published).toBe(true); expect(code).toBe(1); expect(stderr).toContain('produced.mts: wildshard(no-raw-save)');
    expect(()=>verifyGuardRequirement(f.root,receipt)).toThrow();
  } finally {rmSync(f.root,{recursive:true,force:true,maxRetries:3,retryDelay:50});}
});

it('runs the actual shell hook with an explicit full-measurement guard setting', () => {
  const f=fixture();
  try {
    f.put('docs/example.md','# Fixture\n'); f.git('add','docs/example.md');
    const result=spawnSync('/bin/bash',['.githooks/pre-commit'],{cwd:f.root,encoding:'utf8',env:{
      ...env,SKIP_ARCH_GUARDS:'0',WS_COMMIT_INTENT:JSON.stringify({base:f.git('rev-parse','HEAD'),paths:['docs/example.md']}),
    }});
    expect(result.status,result.stdout+result.stderr).toBe(0);
    expect(result.stderr).toContain('pre-commit: passed in');
  } finally {rmSync(f.root,{recursive:true,force:true,maxRetries:3,retryDelay:50});}
});


it.each(['producer-failure','wrong-source','malformed'] as const)('early data never grants a verdict: %s', async failure => {
  const f=fixture();
  const options={...env};delete options['SKIP_ARCH_GUARDS'];
  try {
    f.put('src/engine/valid.ts','export const value = 2;');
    f.put('scripts/generation-jobs.json',JSON.stringify({jobs:[{buildOutputs:{'src/shards/fixture/data/rows.json':'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'}}]}));
    f.git('add','src','scripts/generation-jobs.json');
    const source=f.git('write-tree'),status=join(f.root,'.inputs-status');
    const child=spawn(execPath,['scripts/precommit-guards.mjs','--required-receipt',join(f.root,'.guard')],{cwd:f.root,env:{...options,WS_PRECOMMIT_INPUTS_DONE:status},stdio:['ignore','pipe','pipe']});
    let output='',published=false;
    child.stdout.on('data',(chunk:Buffer)=>{
      output+=String(chunk);
      if(!published&&output.includes('waiting for pinned data')) {
        published=true;
        f.put('.git/commit-inputs/blobs/44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a','{}');
        f.put('.inputs-status.data',failure==='malformed'?'invalid':JSON.stringify({tree:failure==='wrong-source'?f.git('rev-parse','HEAD^{tree}'):source}));
      }
      if(failure==='producer-failure'&&output.includes('waiting for final inputs'))f.put('.inputs-status','1');
    });
    let errors='';child.stderr.on('data',(chunk:Buffer)=>{errors+=String(chunk);});
    const code=await new Promise<number|null>((_resolve,reject)=>{child.once('error',reject);child.once('close',_resolve);});
    expect(published).toBe(true);expect(code).toBe(1);
    expect(()=>verifyGuardRequirement(f.root,join(f.root,'.guard'))).toThrow();
    if(failure==='producer-failure')expect(errors).toContain('precommit-inputs.mjs failed');
    if(failure==='wrong-source')expect(errors).toContain('another source tree');
  } finally {rmSync(f.root,{recursive:true,force:true,maxRetries:3,retryDelay:50});}
});

it('refuses a foreign initial tree rather than accepting its cached source checks',async()=>{
  const f=fixture();
  try {
    const before=f.git('write-tree');f.put('src/engine/valid.ts','export const value=2;');f.git('add','src');
    await expect(precommitGuards(f.root,'',{initialTree:before})).rejects.toThrow('Initial guard snapshot changed');
  } finally {rmSync(f.root,{recursive:true,force:true,maxRetries:3,retryDelay:50});}
});

it('refuses guard startup before any input producer and drains before transport cleanup',()=>{
  const f=fixture();
  const options={...env};delete options['SKIP_ARCH_GUARDS'];
  try {
    f.put('scripts/candidate.mjs','export const candidate=1;');f.git('add','scripts/candidate.mjs');
    f.put('scripts/guard-counts.mjs',`${readFileSync(join(f.root,'scripts/guard-counts.mjs'),'utf8')}\n// Unstaged implementation must refuse.\n`);
    const result=spawnSync('/bin/bash',['.githooks/pre-commit'],{cwd:f.root,encoding:'utf8',env:{...options,WS_COMMIT_INTENT:JSON.stringify({base:f.git('rev-parse','HEAD'),paths:['scripts/candidate.mjs']})}});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Required guard is not the staged implementation');
    expect(result.stderr).not.toContain('pre-commit step inputs:');
    expect(result.stderr).toContain('pre-commit: failed in');
  } finally {rmSync(f.root,{recursive:true,force:true,maxRetries:3,retryDelay:50});}
});
