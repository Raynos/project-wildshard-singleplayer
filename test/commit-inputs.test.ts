import { expect, it } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';
import { restoreCommitInputs } from '../scripts/commit-inputs.mjs';
import { verifyCommitProduced } from '../scripts/commit-produced.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise an isolated real index and its immutable export.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this fixture's temporary files are written or removed.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture-owned paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Force the occupied-export fallback with this fixture's live owner.
import { pid, execPath, env } from 'node:process';

it('generates from staged bytes, includes tracked tables and refuses corrupt cached inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-inputs-fixture-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null');
    for (const dir of ['src', 'lint', 'scripts']) mkdirSync(join(root, dir));
    writeFileSync(join(root, 'package.json'), '{"name":"fixture"}');
    writeFileSync(join(root, 'src/value.ts'), 'before');
    writeFileSync(join(root, 'lint/ask-ids.json'), '[]');
    writeFileSync(join(root, 'lint/shard-words.generated.json'), '{}');
    writeFileSync(join(root, 'scripts/generation-jobs.json'), '{"jobs":[]}');
    writeFileSync(join(root, 'scripts/precommit-generation.mjs'), readFileSync('scripts/precommit-generation.mjs'));
    writeFileSync(join(root, 'lint/debug-flags.mjs'), "import{writeFileSync}from'node:fs';export function primeDebugFlagFacts(){writeFileSync('primer-ran','');}");
    writeFileSync(join(root, 'scripts/gen.mjs'), `import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/assets/physics',{recursive:true});writeFileSync('public/assets/physics/rapier.wasm',new Uint8Array([0,97,115,109]));
for(const key of ['GIT_INDEX_FILE','GIT_DIR','GIT_WORK_TREE','GIT_PREFIX','WS_COMMIT_INTENT','WS_PRECOMMIT_INPUTS_DONE','SHLVL','_']) if(process.env[key] !== undefined) throw Error('leaked hook environment:'+key);
const value=readFileSync('src/value.ts','utf8');
writeFileSync('src/value.generated.json',JSON.stringify({value}));
writeFileSync('lint/ask-ids.json',JSON.stringify([value]));`);
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture');
    writeFileSync(join(root, 'src/value.ts'), 'staged'); git('add', 'src/value.ts');
    writeFileSync(join(root, 'src/value.ts'), 'foreign working bytes');
    const index = join(root, '.git/isolated-index'), callerIndex = readFileSync(join(root, '.git/index'));
    writeFileSync(index, callerIndex);
    execFileSync(execPath, ['--input-type=module', '-e', `import {precommitInputs} from ${JSON.stringify(new URL('../scripts/precommit-inputs.mjs', import.meta.url).href)};precommitInputs(${JSON.stringify(root)});`], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, GIT_INDEX_FILE: index,
        GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root, GIT_PREFIX: 'foreign/',
        WS_COMMIT_INTENT: '{"base":"transport-only"}', WS_PRECOMMIT_INPUTS_DONE: join(root, '.not-published') },
    });
    expect(readFileSync(join(root, '.git/index'))).toEqual(callerIndex);
    // Adopt only this isolated fixture's produced index for existing byte checks.
    writeFileSync(join(root, '.git/index'), readFileSync(index));
    expect(git('show', ':lint/ask-ids.json')).toBe('["staged"]');
    expect(readFileSync(join(root, 'src/value.ts'), 'utf8')).toBe('foreign working bytes');
    const tree = git('write-tree'), target = join(root, 'restore');
    mkdirSync(target);
    restoreCommitInputs(root, tree, target);
    expect([...readFileSync(join(target, 'public/assets/physics/rapier.wasm'))]).toEqual([0,97,115,109]);
    expect(readFileSync(join(target, 'src/value.generated.json'), 'utf8')).toBe('{"value":"staged"}');
    mkdirSync(join(root,'project'));
    writeFileSync(join(root,'project/sweepguard-ledger.md'),'unrelated ledger');
    git('add','project/sweepguard-ledger.md');
    expect(() => restoreCommitInputs(root,git('write-tree'),target)).not.toThrow();
    const hash = execFileSync('node', ['--input-type=module', '-e', "import{createHash}from'node:crypto';console.log(createHash('sha256').update('{\"value\":\"staged\"}').digest('hex'))"], { encoding: 'utf8' }).trim();
    writeFileSync(join(root, '.git/commit-inputs/blobs', hash), 'corrupt');
    expect(() => restoreCommitInputs(root, tree, target)).toThrow('Corrupt commit-time');
    expect(() => restoreCommitInputs(root, 'HEAD', target)).toThrow('Missing commit-time');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


it('publishes staged native outputs with an exact receipt and refuses producer failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-producers-fixture-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const output = 'src/shards/pine-hollow/runtime/physics.baked.json';
  const previousDone=env['WS_PRECOMMIT_INPUTS_DONE'];
  env['WS_PRECOMMIT_INPUTS_DONE']=join(root,'.early-inputs');
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null');
    for (const dir of ['src/shards/pine-hollow/runtime', 'lint', 'scripts']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"name":"fixture"}');
    writeFileSync(join(root, 'src/value.ts'), 'before');
    writeFileSync(join(root, 'lint/ask-ids.json'), '[]');
    writeFileSync(join(root, 'lint/shard-words.generated.json'), '{}');
    writeFileSync(join(root, 'scripts/generation-jobs.json'), '{"jobs":[]}');
    writeFileSync(join(root, 'src/shards/pine-hollow/fixture.json'), '{}');
    writeFileSync(join(root, 'scripts/generation-jobs.json'), JSON.stringify({ jobs: [{ inputRoots: [output], outputs: [], buildOutputs: {'src/shards/pine-hollow/fixture.json':'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'} }] }));
    writeFileSync(join(root, 'scripts/gen.mjs'), `import {existsSync,readFileSync,writeFileSync} from 'node:fs';
if(existsSync('${output}'))writeFileSync('src/native.generated.json',readFileSync('${output}'));`);
    writeFileSync(join(root, 'scripts/bake-loader.mjs'), '');
    writeFileSync(join(root, 'scripts/precommit-bakes.mjs'), `import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
export async function regenerateCheapBakes(root,product){
if(!existsSync('${root}/.early-inputs.data'))throw Error('guard data not published before dependent producer');
if(readFileSync('${root}/.git/commit-inputs/blobs/44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a','utf8')!=='{}')throw Error('wrong early bytes');
if(!product.stagedPaths.includes('src/value.ts'))throw Error('missing caller staged paths');
const value=readFileSync('src/value.ts','utf8');
if(value==='fail')throw Error('official producer refused');
const next=JSON.stringify({value});
if(existsSync('${output}')&&readFileSync('${output}','utf8')===next)return [];
mkdirSync('src/shards/pine-hollow/runtime',{recursive:true});
writeFileSync('${output}',next);
return ['${output}'];}
export async function refreshRecordedCommitInputs(){return [];}`);
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture');
    writeFileSync(join(root, 'src/value.ts'), 'staged'); git('add', 'src/value.ts');
    writeFileSync(join(root, 'src/value.ts'), 'foreign working bytes');
    writeFileSync(join(root, output), 'foreign output bytes');
    const lease=join(root,'.git/commit-export.lock');mkdirSync(lease);writeFileSync(join(lease,'pid'),String(pid));
    precommitInputs(root);
    expect(git('show', `:${output}`)).toBe('{"value":"staged"}');
    expect(readFileSync(join(root, output), 'utf8')).toBe('foreign output bytes');
    expect(readFileSync(join(root, 'src/value.ts'), 'utf8')).toBe('foreign working bytes');
    expect(verifyCommitProduced(root, git('write-tree'), [output])).toBe(true);
    const target = join(root, 'restore'); mkdirSync(target);
    restoreCommitInputs(root, git('write-tree'), target);
    expect(readFileSync(join(target, 'src/native.generated.json'), 'utf8')).toBe('{"value":"staged"}');
    precommitInputs(root);
    expect(verifyCommitProduced(root, git('write-tree'), [output])).toBe(true);
    writeFileSync(join(root, 'src/value.ts'), 'fail'); git('add', 'src/value.ts');
    expect(() => precommitInputs(root)).toThrow();
    expect(git('show', `:${output}`)).toBe('{"value":"staged"}');
    expect(verifyCommitProduced(root, git('write-tree'), [output])).toBe(false);
  } finally { if(previousDone===undefined)delete env['WS_PRECOMMIT_INPUTS_DONE'];else env['WS_PRECOMMIT_INPUTS_DONE']=previousDone; rmSync(root, { recursive: true, force: true }); }
});

it('reuses a verified second slot without touching live owners and falls back when both are held', () => {
  const root=mkdtempSync(join(tmpdir(),'commit-export-pool-'));
  const git=(...args: string[]): string=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const first=join(root,'.git/commit-export'), second=join(root,'.git/commit-export-2');
  try {
    git('init','-q'); git('config','core.hooksPath','/dev/null');
    for (const directory of ['src','lint','scripts']) mkdirSync(join(root,directory));
    writeFileSync(join(root,'package.json'),'{"name":"fixture"}');
    writeFileSync(join(root,'src/value.ts'),'before');
    writeFileSync(join(root,'lint/ask-ids.json'),'[]');
    writeFileSync(join(root,'lint/shard-words.generated.json'),'{}');
    writeFileSync(join(root,'scripts/generation-jobs.json'),'{"jobs":[]}');
    writeFileSync(join(root,'scripts/gen.mjs'),`import {readFileSync,writeFileSync} from 'node:fs';
const value=readFileSync('src/value.ts','utf8');
writeFileSync('src/value.generated.json',JSON.stringify({value}));
writeFileSync('lint/ask-ids.json',JSON.stringify([value]));`);
    git('add','.'); git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-qm','fixture');
    const generate=(value: string): void=>{
      writeFileSync(join(root,'src/value.ts'),value); git('add','src/value.ts');
      writeFileSync(join(root,'src/value.ts'),'foreign working bytes');
      precommitInputs(root);
      expect(git('show',':lint/ask-ids.json')).toBe(JSON.stringify([value]));
      expect(readFileSync(join(root,'src/value.ts'),'utf8')).toBe('foreign working bytes');
    };
    generate('first');
    expect(readFileSync(join(first,'src/value.generated.json'),'utf8')).toBe('{"value":"first"}');
    const occupy=(directory: string): void=>{mkdirSync(`${directory}.lock`);writeFileSync(join(`${directory}.lock`,'pid'),String(pid));};
    occupy(first);
    writeFileSync(join(first,'src/value.ts'),'live first owner bytes');
    generate('second');
    expect(readFileSync(join(first,'src/value.ts'),'utf8')).toBe('live first owner bytes');
    expect(readFileSync(join(second,'src/value.generated.json'),'utf8')).toBe('{"value":"second"}');
    writeFileSync(join(second,'src/value.ts'),'dirty tracked bytes');
    writeFileSync(join(second,'poison.txt'),'untracked poison');
    generate('third');
    expect(readFileSync(join(second,'src/value.ts'),'utf8')).toBe('third');
    expect(existsSync(join(second,'poison.txt'))).toBe(false);
    expect(readFileSync(join(second,'src/value.generated.json'),'utf8')).toBe('{"value":"third"}');
    occupy(second);
    writeFileSync(join(second,'src/value.ts'),'live second owner bytes');
    generate('fallback');
    expect(readFileSync(join(first,'src/value.ts'),'utf8')).toBe('live first owner bytes');
    expect(readFileSync(join(second,'src/value.ts'),'utf8')).toBe('live second owner bytes');
    expect(existsSync(join(root,'.git/commit-export-3'))).toBe(false);
  } finally {rmSync(root,{recursive:true,force:true});}
});
