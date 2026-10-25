// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated Git candidates and verify every selected suite.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and retire the small cache fixtures.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only exact fixture paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { stagedFiles } from '../scripts/precommit-projects.mjs';
import { candidateImportSources } from '../scripts/precommit-imports.mjs';
import { selectRelatedSuites } from '../scripts/precommit-selection.mjs';

function fixture() {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/commit-imports-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env,encoding:'utf8'}).trim();
  const put=(path:string,text:string)=>{mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(resolve(root,path),text);};
  git('init','-q');git('config','user.email','fixture@example.invalid');git('config','user.name','fixture');git('config','core.hooksPath','/dev/null');
  put('src/engine/package.json','{"exports":{"./value":"./value.ts"}}');
  put('src/engine/value.ts','export const value=1;');put('src/engine/other.ts','export const other=2;');
  put('src/sdk/bridge.mts','export const load=()=>import("@wildshard/engine/value");');
  put('test/value.test.ts','import "../src/sdk/bridge.mjs";import raw from "../src/data.as?raw";');
  put('test/direct.test.ts','export const direct=true;');put('src/data.as','// Native source');
  git('add','.');git('commit','-qm','fixture');
  const cache=resolve(root,'.git/commit-imports.json');
  const check=(changed=['src/engine/value.ts','test/direct.test.ts'])=>{
    const staged=stagedFiles(root),candidate=candidateImportSources(root,staged);
    const sources=new Map(staged.paths.filter(path=>/\.[cm]?[jt]sx?$/u.test(path)||/^src\/[^/]+\/package\.json$/u.test(path)).map(path=>[path,staged.read(path)??'']));
    expect(selectRelatedSuites(candidate.sources,changed,staged.paths,20,candidate.imports)).toEqual(selectRelatedSuites(sources,changed,staged.paths));
    return candidate;
  };
  return {root,put,git,cache,check,close:()=>rmSync(root,{recursive:true,force:true})};
}

test('warm syntax keeps exact candidate selection through changes, renames, deletions and export remaps',()=>{
  const f=fixture();try {
    const cold=f.check();expect(cold.misses).toBe(5);
    expect(f.check()).toMatchObject({hits:5,misses:0});
    f.put('src/sdk/bridge.mts','export const load=()=>import("@wildshard/engine/value");import "../data.as?raw";');f.git('add','src/sdk/bridge.mts');
    // Loose text and a loose test never replace the sealed import graph.
    f.put('src/sdk/bridge.mts','export const load=1;');f.put('test/loose.test.ts','import "../src/engine/value";');
    expect(f.check()).toMatchObject({hits:4,misses:1});
    mkdirSync(resolve(f.root,'test/deeper'));
    f.git('mv','test/value.test.ts','test/deeper/renamed.test.ts');expect(f.check()).toMatchObject({hits:5,misses:0});
    f.put('src/engine/package.json','{"exports":{"./value":"./other.ts"}}');f.git('add','src/engine/package.json');
    expect(f.check(['src/engine/other.ts','src/engine/package.json'])).toMatchObject({hits:5,misses:0});
    f.git('rm','--cached','test/deeper/renamed.test.ts');expect(f.check()).toMatchObject({hits:4,misses:0});
    f.put('test/new.test.ts','import "../src/engine/other";');f.git('add','test/new.test.ts');
    const added=f.check(['test/new.test.ts','src/engine/other.ts']);expect(added.misses).toBe(1);
    expect(selectRelatedSuites(added.sources,['test/new.test.ts'],stagedFiles(f.root).paths,0,added.imports).direct).toEqual(['test/new.test.ts']);
  }finally{f.close();}
});

test('corrupt, mismatched and missing cache rows reparse instead of hiding imports',()=>{
  const f=fixture();try {
    f.check();f.put('.git/commit-imports.json','{broken');expect(f.check().misses).toBe(5);
    const saved=v.parse(v.object({stamp:v.string(),rows:v.record(v.string(),v.object({imports:v.array(v.string()),digest:v.string()}))}),JSON.parse(readFileSync(f.cache,'utf8')));
    const oid=stagedFiles(f.root).blobs?.get('test/value.test.ts');if(oid===undefined)throw new Error('Missing test blob');
    const row=saved.rows[oid];if(row===undefined)throw new Error('Missing cached imports');
    row.imports=[];writeFileSync(f.cache,JSON.stringify(saved));expect(f.check().misses).toBe(1);
    saved.stamp='old parser';writeFileSync(f.cache,JSON.stringify(saved));expect(f.check().misses).toBe(5);
    rmSync(f.cache);expect(f.check().misses).toBe(5);
    const staged=stagedFiles(f.root);
    const unsealed=candidateImportSources(f.root,{paths:staged.paths,read:staged.read});
    expect(unsealed).toMatchObject({hits:0,misses:5});
    expect([...unsealed.imports]).toEqual([...f.check().imports]);
  }finally{f.close();}
});
