// oxlint-disable-next-line import/no-nodejs-modules -- Tiny Git fixtures prove candidate isolation.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture source and indexes are removed after each case.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all fixture paths under repository tmp.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { selectGateChecks } from '../scripts/gate-selection.mjs';
import { stagedFiles } from '../scripts/precommit-projects.mjs';

function fixture() {
  mkdirSync('tmp',{recursive:true});
  const root=mkdtempSync(resolve('tmp/gate-selection-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
  const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,env,encoding:'utf8'}).trim();
  const put=(file:string,value:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),value);};
  git('init','-q');git('config','user.name','gate fixture');git('config','user.email','gate@example.invalid');git('config','core.hooksPath','/dev/null');
  put('src/shards/a/shard.config.ts','export const source=1;');
  put('src/shards/b/shard.config.ts','export const source=2;');
  put('src/shards/a-legacy/shard.config.ts','export const source=3;');
  put('lint/legacy-shards.json',JSON.stringify({shards:{'a-legacy':{primary:'a'}}}));
  put('scripts/generation-jobs.json',JSON.stringify({jobs:[
    {id:'a',shard:'a',inputRoots:['public/a'],outputs:['src/a.generated.json']},
    {id:'b',shard:'b',inputRoots:['src/a.generated.json'],outputs:['src/b.generated.json']},
  ]}));
  put('scripts/test-products.json',JSON.stringify({'test/a.test.ts':['a'],'test/shared.test.ts':['a','b'],'test/b.test.ts':['b']}));
  put('test/a.test.ts','export const test=1;');put('test/b.test.ts','export const test=2;');put('test/shared.test.ts','export const test=3;');
  put('test/generated.test.ts',"import data from '../src/a.generated.json';export const test=data;");
  put('src/engine/value.ts','export const value=1;');
  const seal=():void=>{git('add','.');};seal();git('commit','-qm','fixture');
  const select=(changed:string[])=>selectGateChecks(root,stagedFiles(root),changed);
  return {root,put,git,seal,select,close:()=>rmSync(root,{recursive:true,force:true})};
}

test('producer input directories propagate through declared outputs to product consumers',()=>{
  const f=fixture();try {
    const result=f.select(['public/a/mesh.glb']);
    expect(result.generators).toEqual(['a','b']);expect(result.touchedProducts).toEqual(['a','b']);
    expect(result.tests).toEqual(['test/a.test.ts','test/b.test.ts','test/generated.test.ts','test/shared.test.ts']);
    expect(result.related.files).toContain('test/generated.test.ts');
  }finally{f.close();}
});

test('selected-test prerequisites do not recursively widen the touched product cohort',()=>{
  const f=fixture();try {
    const result=f.select(['src/shards/a/shard.config.ts']);
    expect(result.touchedProducts).toEqual(['a']);expect(result.products).toEqual(['a','b']);
    expect(result.tests).toEqual(['test/a.test.ts','test/shared.test.ts']);
    expect(result.tests).not.toContain('test/b.test.ts');
  }finally{f.close();}
});

test('shared code selects all primary products while a colocated test stays narrow',()=>{
  const f=fixture();try {
    const wide=f.select(['src/engine/value.ts']);
    expect(wide.wide).toBe(true);expect(wide.touchedProducts).toEqual(['a','b']);
    expect(wide.products).not.toContain('a-legacy');
    expect(f.select(['src/engine/value.test.ts']).wide).toBe(false);
  }finally{f.close();}
});

test('a folder with multiple declared outputs selects their real slugs',()=>{
  const f=fixture();try {
    f.put('src/shards/a/outputs.json',JSON.stringify({outputs:[{slug:'a-phone'},{slug:'a-desktop'}]}));
    f.put('scripts/test-products.json',JSON.stringify({'test/a.test.ts':['a-phone'],'test/b.test.ts':['b']}));f.seal();
    expect(f.select(['src/shards/a/manifest.json']).touchedProducts).toEqual(['a-desktop','a-phone']);
  }finally{f.close();}
});

test('a changed producer catalogue checks every recipe and refuses ambiguous ids',()=>{
  const f=fixture();try {
    const result=f.select(['scripts/generation-jobs.json']);
    expect(result.wide).toBe(true);expect(result.generators).toEqual(['a','b']);
    expect(result.touchedProducts).toEqual(['a','b']);
    f.put('scripts/generation-jobs.json',JSON.stringify({jobs:[
      {id:'same',shard:'a',inputRoots:[],outputs:[]},{id:'same',shard:'b',inputRoots:[],outputs:[]},
    ]}));f.seal();
    expect(()=>f.select([])).toThrow('Duplicate candidate generator id');
  }finally{f.close();}
});

test('selection ignores peer registry poison and preserves its loose bytes and index',()=>{
  const f=fixture();try {
    const index=f.git('write-tree');f.put('scripts/test-products.json','foreign invalid JSON');
    expect(f.select(['src/shards/a/shard.config.ts']).tests).toEqual(['test/a.test.ts','test/shared.test.ts']);
    expect(f.git('write-tree')).toBe(index);
    expect(readFileSync(resolve(f.root,'scripts/test-products.json'),'utf8')).toBe('foreign invalid JSON');
  }finally{f.close();}
});

test('missing registry, unknown product or producer folder refuses rather than losing a check',()=>{
  const f=fixture();try {
    f.git('rm','--cached','scripts/test-products.json');expect(()=>f.select([])).toThrow('requires candidate scripts/test-products.json');
    f.seal();f.put('scripts/test-products.json',JSON.stringify({'test/a.test.ts':['missing']}));f.seal();
    expect(()=>f.select(['test/a.test.ts'])).toThrow('Unknown candidate test product');
    f.put('scripts/generation-jobs.json',JSON.stringify({jobs:[{id:'bad',shard:'missing',inputRoots:['input'],outputs:['out']}]}));f.seal();
    expect(()=>f.select(['input'])).toThrow('Unknown candidate product folder');
  }finally{f.close();}
});

test('type projects use the same candidate include membership as the static guard',()=>{
  const f=fixture();try {
    f.put('tsconfig.engine.json',JSON.stringify({compilerOptions:{module:'esnext'},include:['src/engine']}));f.seal();
    expect(f.select(['src/engine/value.ts']).projects).toEqual(['tsconfig.engine.json']);
    expect(f.select(['src/shards/a/manifest.json']).projects).toEqual([]);
    f.put('tsconfig.json',JSON.stringify({files:[],references:[{path:'./tsconfig.engine.json'}]}));f.seal();
    expect(f.select(['src/engine/value.ts']).projects).toEqual(['tsconfig.json']);
  }finally{f.close();}
});
