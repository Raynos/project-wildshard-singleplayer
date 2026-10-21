import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Tiny isolated Git/key fixtures, no checkout or repository copy.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture files are confined to the owned temporary directory.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the measured product's validation digest.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture Git processes must not inherit another index or Git directory.
import process from 'node:process';
import { gridRuntimeKey, gridRuntimeBinding } from '../scripts/grid-runtime-keys.mjs';

it('keeps docs and shard product edits outside the shared runtime key', () => {
 const root=mkdtempSync(resolve('tmp','grid-runtime-keys-'));
 const environment={...process.env};for(const key of Object.keys(environment))if(key.startsWith('GIT_'))delete environment[key];
 const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...environment,
  GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'}}).trim();
 const write=(path:string,text:string):void=>{writeFileSync(resolve(root,path),text);};
 const commit=():string=>{git('add','--','src','note.md');return git('commit-tree',git('write-tree'),'-m','fixture');};
 try {
  git('init','--quiet');mkdirSync(resolve(root,'src/game/grid'),{recursive:true});mkdirSync(resolve(root,'src/shards/example'),{recursive:true});
  write('src/game/grid/session.ts','first');write('src/shards/example/world.ts','first');write('note.md','first');
  const source=commit(),runtime=gridRuntimeKey(root,source);
  expect(runtime).toMatch(/^[a-f0-9]{64}$/u);
  write('note.md','new unrelated documentation');expect(gridRuntimeKey(root,commit())).toBe(runtime);
  write('src/shards/example/world.ts','new product source');expect(gridRuntimeKey(root,commit())).toBe(runtime);
  write('src/game/grid/session.ts','new runtime behavior');expect(gridRuntimeKey(root,commit())).not.toBe(runtime);
  const products=resolve(root,'out'),directory=resolve(products,'example');mkdirSync(directory,{recursive:true});
  const sourceHash='a'.repeat(64),buildKey='b'.repeat(64),index=JSON.stringify({format:'wildshard.shardfile',formatVersion:2,build:{sourceHash,validator:'fixture-validator'}});
  writeFileSync(resolve(directory,'shard.json'),index);
  writeFileSync(resolve(directory,'validation.json'),JSON.stringify({buildKey,indexHash:createHash('sha256').update(index).digest('hex'),sourceHash,revision:'fixture-validator'}));
  expect(gridRuntimeBinding(root,source,products)).toEqual({schema:'grid-runtime-keys/1',source,runtime,products:{example:buildKey}});
  writeFileSync(resolve(directory,'shard.json'),`${index} `);
  expect(()=>gridRuntimeBinding(root,source,products)).toThrow('Unbound product key');
 } finally {rmSync(root,{recursive:true,force:true});}
});
