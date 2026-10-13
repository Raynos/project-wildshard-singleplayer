// oxlint-disable-next-line import/no-nodejs-modules -- Exercise immutable Git archives rather than working outputs.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their immutable source/archive and outputs.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep source fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture-owned paths.
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { hydrateCheapGuardData } from '../scripts/hydrate-cheap-guard.mjs';
import { extractGuardArchive, hydrateGuardLintArchive } from '../scripts/precommit-guards.mjs';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';
import { simClosure } from '../lint/sim-closure.mjs';

it('hydrates cheap JSON through its complete source producer and refuses missing outputs',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cheap-guard-fixture-'));
  const put=(file:string,text:string):void=>{mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),text);};
  const entry='src/shards/sample/generators/bake-behaviour.mjs', output='src/shards/sample/behaviour/script.json', binary='src/shards/sample/assets/script.bin';
  try {
    put('package.json','{"name":"fixture"}');put('source.txt','{"source":"immutable recipe"}');
    put(entry,`import{readFileSync,writeFileSync}from'node:fs';writeFileSync('${output}',readFileSync('source.txt'));writeFileSync('${binary}','compiled');`);
    const job={id:'sample',shard:'sample',entry,command:[entry],inputRoots:['package.json','source.txt',entry],outputs:[output,binary],platform:'portable',buildTimeOutputs:[output,binary]};
    put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
    await hydrateCheapGuardData(root);
    expect(JSON.parse(readFileSync(join(root,output),'utf8'))).toEqual({source:'immutable recipe'});
    rmSync(join(root,output));
    put(entry,"throw Error('producer refused');");
    await expect(hydrateCheapGuardData(root)).rejects.toThrow('Generator exited');
    put(entry,'// A no-op is not a complete producer.');
    await expect(hydrateCheapGuardData(root)).rejects.toThrow();
  } finally {rmSync(root,{recursive:true,force:true});}
});


it('hydrates the separate lint archive from its tree, ignoring generated working data', async () => {
  const owned = realpathSync(mkdtempSync(join(tmpdir(), 'cheap-lint-archive-')));
  const root = join(owned, 'repo'), snapshot = join(owned, 'lint');
  const entry = 'src/shards/sample/generators/bake-behaviour.mjs';
  const output = 'src/shards/sample/behaviour/script.json';
  const recipe = 'src/shards/sample/recipe.json';
  const put = (file: string, text: string): void => {
    mkdirSync(dirname(join(root, file)), {recursive:true}); writeFileSync(join(root, file), text);
  };
  const git = (...args: string[]): string => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
  const archive = (): void => {
    extractGuardArchive(root, 'HEAD', ['src', 'package.json', 'scripts/generation-jobs.json'], snapshot);
    linkNodeModules(resolve('.'), snapshot);
  };
  try {
    mkdirSync(root); mkdirSync(snapshot);
    cpSync('scripts', join(root, 'scripts'), {recursive:true});
    put('package.json', '{"name":"fixture"}');
    put(recipe, '{"source":"immutable recipe"}');
    put(entry, `import{readFileSync,writeFileSync}from'node:fs';writeFileSync('${output}',readFileSync('${recipe}'));`);
    put('src/shards/sample/data/brains.ts', "import rows from '../behaviour/script.json' with {type:'json'}; export const brains=rows;");
    const job = {id:'sample',shard:'sample',entry,command:[entry],inputRoots:['package.json',recipe,entry],outputs:[output],platform:'portable',buildTimeOutputs:[output]};
    put('scripts/generation-jobs.json', JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
    git('init', '-q'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.invalid');
    git('add','.'); git('-c','core.hooksPath=/dev/null','commit','-qm','fixture');
    put(output, '{"source":"foreign working output"}');
    archive();
    expect(existsSync(join(snapshot, output))).toBe(false);
    expect(simClosure(snapshot).map(site => site.id)).toEqual(['src/shards/sample/data/brains.ts:unresolved:../behaviour/script.json']);
    await hydrateGuardLintArchive(root, 'HEAD', snapshot);
    expect(JSON.parse(readFileSync(join(snapshot, output), 'utf8'))).toEqual({source:'immutable recipe'});
    expect(readFileSync(join(root, output), 'utf8')).toBe('{"source":"foreign working output"}');
    expect(simClosure(snapshot)).toEqual([]);
    put('src/shards/sample/data/brains.ts', "import rows from '../behaviour/script.json' with {type:'json'}; export const brains=rows; document.title='forbidden';");
    git('add','src/shards/sample/data/brains.ts'); git('-c','core.hooksPath=/dev/null','commit','-qm','forbidden source');
    archive();
    expect(simClosure(snapshot).map(site => site.id)).toContain('src/shards/sample/data/brains.ts:global:document');
    rmSync(join(snapshot, output));
    put(entry, "throw Error('source producer refused');");
    git('add',entry); git('-c','core.hooksPath=/dev/null','commit','-qm','refusing producer');
    archive();
    await expect(hydrateGuardLintArchive(root, 'HEAD', snapshot)).rejects.toThrow('Generator exited');
    expect(existsSync(join(snapshot, output))).toBe(false);
    expect(simClosure(snapshot).map(site => site.id)).toContain('src/shards/sample/data/brains.ts:unresolved:../behaviour/script.json');
  } finally {rmSync(owned, {recursive:true,force:true});}
});
