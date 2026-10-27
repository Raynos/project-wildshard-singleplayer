// oxlint-disable-next-line import/no-nodejs-modules -- Exercise exact Git inputs in owned tiny repositories.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Tiny fixtures are removed after each test.
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture paths remain beneath tmp/.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture invokes the real platform policy comparator.
import { pathToFileURL } from 'node:url';
import { expect, test, vi } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

const repository=resolve('.');
function fixture() {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/git-fast-'));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(file:string,text:string)=>{mkdirSync(resolve(root,file,'..'),{recursive:true});writeFileSync(resolve(root,file),text);};
  git('init','-q','-b','main');git('config','user.name','fixture');git('config','user.email','fixture@example.invalid');git('config','core.hooksPath','/dev/null');
  put('.gitignore','tmp/\nnode_modules/\n');
  put('scripts/guard-counts.mjs',`import{readFileSync}from'node:fs';export function readLintConfig(path){return JSON.parse(readFileSync(path,'utf8'));}export function hardRules(){return new Set();}`);
  put('scripts/precommit-checks.mjs','export function fastCommitLintConfig(value){return value;}');
  put('lint/plugin.mjs',`import{readFileSync}from'node:fs';import{resolve}from'node:path';
export default {
  meta:{name:'wildshard'},rules:{marker:{
    meta:{type:'problem',schema:[],messages:{bad:'Committed marker refused'}},
    create(context){return {Program(node){
      if(readFileSync(resolve('lint/marker.json'),'utf8').includes('BAD'))context.report({node,messageId:'bad'});
    }};}
  }}
};`);
  put('lint/marker.json','GOOD');put('lint/ratchet.json','{}');
  put('.oxlintrc.ratchet.json',JSON.stringify({jsPlugins:['./lint/plugin.mjs'],rules:{'wildshard/marker':'error'}}));
  put('scripts/legacy-shards.mjs','export function legacyInventory(){return [];}export function registeredLegacyFile(){return false;}');
  put('scripts/push-checks.mjs',readFileSync(resolve('scripts/push-checks.mjs'),'utf8'));
  put('scripts/gate-related-tests.mjs','export function pushGuards(){return [];}');
  put('.oxlintrc.json',JSON.stringify({options:{typeAware:false},plugins:['import'],jsPlugins:['./lint/plugin.mjs'],categories:{correctness:'off'},rules:{'no-eval':'error','import/no-cycle':'error','wildshard/marker':'error'}}));
  put('src/main.ts','export const value=1;\n');
  const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
  const base=commit();linkNodeModules(repository,root);
  const run=(phase:string,tip:string,files=['src/main.ts'],from=base,trace=false,native=false,reportOnly=false)=>spawnSync('node',[resolve('scripts/committed-fast-checks.mjs'),root,from,tip,phase,JSON.stringify(files)],{cwd:repository,encoding:'utf8',timeout:15_000,env:{...process.env,...(trace?{GIT_TRACE:'1'}:{}),...(native?{WS_GIT_NATIVE_ROOT:root}:{}),...(reportOnly?{WS_GIT_NATIVE_REPORT_ONLY:'1'}:{})}});
  return {root,git,put,commit,base,run,close:()=>rmSync(root,{recursive:true,force:true})};
}

test('native-output handoff keeps ordinary source errors blocking',()=>{
  const f=fixture();try{
    f.put('.gitignore','tmp/\nnode_modules/\n*.generated.ts\n');
    f.put('scripts/source-generation-outputs.json',JSON.stringify({producers:{'scripts/gen-shards.mjs':['src/value.generated.ts']}}));
    f.put('src/main.ts',"import './value.generated';export const value=1;");
    const good=f.commit();f.put('src/value.generated.ts','eval("poison");');
    const handed=f.run('fast-lint',good,undefined,undefined,false,true,true);
    expect(handed.status,handed.stderr).toBe(0);
    expect(handed.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(handed.stdout).toContain('Gate-deferred: native-outputs');
    expect(handed.stdout).not.toContain('DEFERRED TO CI');
    expect(()=>readFileSync(resolve(f.root,'src/value.generated.ts'))).toThrow();
    f.put('src/main.ts',"import './value.generated';eval('1');");
    const refused=f.run('fast-lint',f.commit(),undefined,undefined,false,true,true);
    expect(refused.status,refused.stderr).toBe(1);expect(refused.stderr).toContain('no-eval');
    f.put('src/main.ts',"import './undeclared';export const value=1;");
    const missing=f.run('fast-lint',f.commit(),undefined,undefined,false,true,true);
    expect(missing.stdout).toContain('DEFERRED TO CI');
    expect(missing.stdout).not.toContain('Gate-deferred: native-outputs');
  }finally{f.close();}
});

test('native closure admits tracked declaration modules without a generation handoff',()=>{
  const f=fixture();try{
    f.put('src/shape.d.ts','export interface Shape {value:number}\n');
    f.put('src/main.ts',"import type {Shape} from './shape';export const value:Shape={value:1};");
    const result=f.run('fast-lint',f.commit(),undefined,undefined,false,true,true);
    expect(result.status,result.stderr).toBe(0);
    expect(result.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(result.stdout).not.toContain('DEFERRED');
    expect(result.stdout).not.toContain('Gate-deferred');
  }finally{f.close();}
});

test('lint refuses exact bad text and openly defers dirty or staged inputs',()=>{
  const f=fixture();try {
    f.put('src/main.ts','export const value=eval("1");');const bad=f.commit();
    const exact=f.run('fast-lint',bad);expect(exact.status,exact.stderr).toBe(1);expect(exact.stderr).toContain('no-eval');
    f.put('src/main.ts','export const value=2;');f.git('add','src/main.ts');
    const before=readFileSync(resolve(f.root,'src/main.ts'),'utf8'),index=f.git('write-tree');
    const result=f.run('fast-lint',bad);
    expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('DEFERRED TO CI fast-lint src/main.ts');expect(result.stdout).not.toContain('Fast lint passed');
    expect(readFileSync(resolve(f.root,'src/main.ts'),'utf8')).toBe(before);expect(f.git('write-tree')).toBe(index);
    expect(f.run('fast-lint',f.base).status).toBe(0);
  }finally{f.close();}
});

test('the commit hook refuses staged debt before source checks can defer it',async()=>{
  const f=fixture(),output=vi.spyOn(console,'error').mockImplementation(()=>undefined);try {
    f.put('scripts/committed-fast-checks.mjs','// Registered exact-input counter entry.\n');
    f.put('lint/plugin.mjs',`import{readFileSync}from'node:fs';import{resolve}from'node:path';
export default {meta:{name:'wildshard'},rules:{marker:{meta:{type:'problem',schema:[]},create(context){return {Program(node){
 for(let i=0;i<Number(readFileSync(resolve('lint/marker.json'),'utf8'));i++)context.report({node,message:'Counted existing debt'});
}};}}}};`);
    f.put('lint/ratchet.json',JSON.stringify({'wildshard/marker':{'src/main.ts':1}}));
    f.put('lint/marker.json','1');f.commit();
    f.put('lint/marker.json','2');f.put('src/main.ts','export const value=2;');f.git('add','lint/marker.json','src/main.ts');
    const index=readFileSync(resolve(f.root,'.git/index'));
    const lint=resolve(f.root,'ordinary-lint.sh');f.put('ordinary-lint.sh','#!/bin/sh\nexit 0\n');chmodSync(lint,0o755);
    // A peer's loose rescue and broken plugin must not hide exact staged growth.
    f.put('lint/marker.json','0');f.put('lint/plugin.mjs','throw Error("foreign plugin");');
    await expect(precommitInputs(f.root,lint)).rejects.toThrow('staged debt: refused');
    expect(output.mock.calls.some(args=>String(args[0]).includes('was 1, now 2'))).toBe(true);
    expect(output.mock.calls.some(args=>String(args[0]).includes('Error: foreign plugin'))).toBe(false);
    expect(readFileSync(resolve(f.root,'.git/index'))).toEqual(index);
    expect(readFileSync(resolve(f.root,'lint/marker.json'),'utf8')).toBe('0');
    expect(readFileSync(resolve(f.root,'lint/plugin.mjs'),'utf8')).toContain('foreign plugin');
  }finally{output.mockRestore();f.close();}
});

test('plugin executable and policy reads stay on Git even when both are dirty',()=>{
  const f=fixture();try {
    f.put('lint/marker.json','BAD');const bad=f.commit();
    f.put('lint/marker.json','GOOD');f.put('lint/plugin.mjs','throw Error("foreign plugin");');
    const lint=f.run('fast-lint',bad);expect(lint.status).toBe(1);expect(lint.stderr).toContain('Committed marker refused');expect(lint.stderr).not.toContain('foreign plugin');
    const result=f.run('ratchet',bad);
    expect(result.status,result.stderr).toBe(1);expect(result.stderr).toContain('was 0, now 1');
    expect(result.stderr).not.toContain('foreign plugin');
  }finally{f.close();}
});

test('native lint detects exact cycles and defers a changed dependency',()=>{
  const f=fixture();try {
    f.put('src/main.ts',"import {other} from './other';export const value=other+1;");
    f.put('src/other.ts',"import {value} from './main';export const other=value+1;");const bad=f.commit();
    const exact=f.run('fast-lint',bad);expect(exact.status,exact.stderr).toBe(1);expect(exact.stderr).toContain('no-cycle');
    f.put('src/other.ts','export const other=1;');
    const result=f.run('fast-lint',bad);expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('DEFERRED TO CI fast-lint src/main.ts');expect(result.stdout).not.toContain('Fast lint passed');
  }finally{f.close();}
});

test('native closure resolves query and fragment imports to their tracked file',()=>{
  const f=fixture();try {
    f.put('src/worker.ts','export const value=1;');
    f.put('src/main.ts',"import first from '../lint/ratchet.json?raw';import second from '../lint/ratchet.json#text';import worker from './worker?worker&inline';export const value=[first,second,worker];");
    const tip=f.commit(),index=f.git('write-tree');
    const result=f.run('fast-lint',tip);
    expect(result.status,result.stdout+result.stderr).toBe(0);
    expect(result.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(result.stdout).not.toContain('DEFERRED TO CI');
    expect(f.git('write-tree')).toBe(index);
    expect(readFileSync(resolve(f.root,'src/main.ts'),'utf8')).toContain('ratchet.json?raw');
    f.put('src/worker.ts','export const value=2;');
    const dirty=f.run('fast-lint',tip);
    expect(dirty.stdout).toContain('unverified inputs src/worker.ts');
    expect(dirty.stdout).not.toContain('Fast lint passed');
    f.put('src/main.ts',"import worker from './missing?worker&inline';export const value=worker;");
    const missing=f.run('fast-lint',f.commit());
    expect(missing.stdout).toContain('unverified inputs src/missing');
    expect(missing.stdout).not.toContain('Fast lint passed');
  }finally{f.close();}
});

test('committed good policy ignores a loose poison and still checks the source',()=>{
  const f=fixture();try {
    f.put('src/main.ts','export const value=2;');const tip=f.commit();
    const hash=f.git('rev-parse',`${tip}:src/main.ts`);f.put('lint/marker.json','BAD');
    const result=f.run('fast-lint',tip,['src/main.ts'],f.base,true);
    expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(result.stderr).toContain(`cat-file blob ${hash}`);expect(result.stdout).not.toContain('DEFERRED TO CI');
  }finally{f.close();}
});

test('native generated inputs match canonical committed producer bytes',()=>{
  const f=fixture();try {
    f.put('scripts/gen-starter-weapons.mjs',readFileSync(resolve('scripts/gen-starter-weapons.mjs'),'utf8'));
    f.put('src/game/weapons/starterBow.json','{"damage":1}');
    f.put('src/main.ts',"import {STARTER_BOW} from './game/weapons/starter.generated';export const value=STARTER_BOW;");
    f.put('.gitignore','.gitignore\ntmp/\nnode_modules/\n*.generated.ts\n');
    const tip=f.commit();
    const generate=()=>execFileSync('node',['--input-type=module','--eval',"import {genStarterWeapons} from './scripts/gen-starter-weapons.mjs';genStarterWeapons();"],{cwd:f.root});
    generate();
    const passed=f.run('fast-lint',tip);
    expect(passed.status,passed.stdout+passed.stderr).toBe(0);
    expect(passed.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(passed.stdout).not.toContain('DEFERRED TO CI');
    f.put('src/game/weapons/starter.generated.ts','export const STARTER_BOW={damage:999};');
    const poisoned=f.run('fast-lint',tip);
    expect(poisoned.stdout).toContain('unverified inputs src/game/weapons/starter.generated.ts');
    expect(poisoned.stdout).not.toContain('Fast lint passed');
    f.put('src/game/weapons/starterBow.json','{"damage":2}');
    const changed=f.commit();generate();
    const changedResult=f.run('fast-lint',changed);
    expect(changedResult.status,changedResult.stdout+changedResult.stderr).toBe(0);
    expect(changedResult.stdout).toContain('Fast lint passed on 1 exact changed files');
  }finally{f.close();}
});

test('loose data without a current provider cannot supply committed inputs',()=>{
  const f=fixture();try {
    const file='src/layout.generated.json';
    f.put('.gitignore','tmp/\nnode_modules/\n*.generated.json\n');
    f.put('src/main.ts',"import layout from './layout.generated.json';export const value=layout;");
    const tip=f.commit();
    for(const bytes of [undefined,'{"layout":1}','{"layout":2}']) {
      if(bytes!==undefined)f.put(file,bytes);
      const result=f.run('fast-lint',tip);
      expect(result.stdout).toContain('unverified inputs src/layout.generated.json');
      expect(result.stdout).not.toContain('Fast lint passed');
    }
  }finally{f.close();}
});

test('literal discovery providers require native context and exact tracked correspondence',()=>{
  const f=fixture();try {
    const file='src/derived.generated.ts',retained='src/owned.json';
    f.put('.gitignore','tmp/\nnode_modules/\n*.generated.ts\n');
    f.put('src/main.ts',"import {value} from './derived.generated';export const result=value;");
    const registry=(outputs:string[]):void=>f.put('scripts/source-generation-outputs.json',JSON.stringify({producers:{'scripts/gen-shards.mjs':outputs}}));
    registry([file,retained]);f.put(retained,'{"id":1}');
    f.put('scripts/shard-platform-format.mjs','// Fixture has no format imports.');
    const provider=`import{mkdirSync,writeFileSync}from'node:fs';export function genShards(){mkdirSync('src',{recursive:true});writeFileSync('${file}','export const value=1;');writeFileSync('${retained}','{"id":1}');}`;
    f.put('scripts/gen-shards.mjs',provider);const tip=f.commit();
    expect(f.run('fast-lint',tip).stdout).toContain('unverified inputs src/derived.generated');
    const native=f.run('fast-lint',tip,['src/main.ts'],f.base,false,true);
    expect(native.status,native.stdout+native.stderr).toBe(0);
    expect(native.stdout).toContain('Fast lint passed on 1 exact changed files');
    expect(native.stdout).not.toContain('DEFERRED TO CI');
    expect(readFileSync(resolve(f.root,file),'utf8')).toBe('export const value=1;');
    expect(readFileSync(resolve(f.root,retained),'utf8')).toBe('{"id":1}');
    f.put('scripts/gen-shards.mjs',provider.replace('{"id":1}','{"id":2}'));
    const moved=f.run('fast-lint',f.commit(),['src/main.ts'],f.base,false,true);
    expect(moved.status).toBe(1);expect(moved.stderr).toContain('Generated output differs from committed source');
    // This native root represents a disposable mirror; mismatched bytes never
    // gain admission even though the rejected writer emitted them there.
    expect(readFileSync(resolve(f.root,retained),'utf8')).toBe('{"id":2}');
    f.put('scripts/gen-shards.mjs',provider);registry([file,'src/missing.generated.ts']);
    const incomplete=f.run('fast-lint',f.commit(),['src/main.ts'],f.base,false,true);
    expect(incomplete.status).toBe(1);expect(incomplete.stderr).toContain('ENOENT');
    registry([file,'src/../escape']);
    const escaped=f.run('fast-lint',f.commit(),['src/main.ts'],f.base,false,true);
    expect(escaped.status).toBe(1);expect(escaped.stderr).toContain('Invalid native source output');
  }finally{f.close();}
});

test('deleted-path guard ignores loose rescues and keeps frozen legacy references historical',()=>{
  const f=fixture();try {
    f.put('src/other.ts','export const other=1;');f.commit();f.git('rm','src/other.ts');
    f.put('src/main.ts',"export{other}from'./other';");const bad=f.commit();f.put('src/other.ts','export const other=1;');
    const result=f.run('deleted-paths',bad,['src/other.ts']);expect(result.status,result.stderr).toBe(1);expect(result.stderr).toContain('deleted path src/other.ts');
    f.put('src/main.ts','export const value=1;');f.put('src/shards/example-legacy/runtime/index.ts',"export{other}from'../../../other';");const fixed=f.commit();
    expect(f.run('deleted-paths',fixed,['src/other.ts']).status).toBe(0);
  }finally{f.close();}
});

test('ratchet retains old unrecorded counts but refuses new counts and cannot borrow hard debt',()=>{
  const f=fixture();try {
    f.put('lint/marker.json','BAD');const bad=f.commit();
    const result=f.run('ratchet',bad);expect(result.status,result.stderr).toBe(1);expect(result.stderr).toContain('was 0, now 1');
    expect(f.run('ratchet',bad,['src/main.ts'],bad).status).toBe(0);
    f.put('scripts/guard-counts.mjs',`import{readFileSync}from'node:fs';export function readLintConfig(path){return JSON.parse(readFileSync(path,'utf8'));}export function hardRules(){return new Set(['wildshard/marker']);}`);
    const hard=f.commit();const refused=f.run('ratchet',hard,['src/main.ts'],bad);expect(refused.status).toBe(1);expect(refused.stderr).toContain('was 0, now 1');
    f.put('lint/ratchet.json',JSON.stringify({'wildshard/marker':{'src/main.ts':1}}));const allowed=f.commit();
    expect(f.run('ratchet',allowed).status).toBe(0);
  }finally{f.close();}
});

test('guards compare custom policies through immutable Git readers without a checkout',()=>{
  const f=fixture();try {
    f.put('scripts/check-closed-components.mjs','export function closedComponentSources(){return [];}');
    f.put('scripts/ratchet-approval.mjs','export function ratchetApprovalFailures(){return [];}');
    f.put('scripts/check-platform-ratchets.mjs',`export {comparePlatformList} from '${pathToFileURL(resolve('scripts/check-platform-ratchets.mjs')).href}';
export const PLATFORM_LISTS=['lint/ratchet.json','lint/custom-sections.json'];`);
    const policy={version:1,baselineAt:'a'.repeat(40),baseline:{demo:{count:2,bytes:100}}};
    const budgets=(count:number,bytes:number)=>({budgets:{'custom-sections/demo/count':count,'custom-sections/demo/bytes':bytes}});
    f.put('lint/ratchet.json',JSON.stringify(budgets(2,100)));
    f.put('lint/custom-sections.json',JSON.stringify({...policy,raises:[],risesCloseAt:'W1 spike end'}));
    const base=f.commit();
    f.put('lint/custom-sections.json',JSON.stringify(policy));const sealed=f.commit();
    // Loose policy bytes cannot rescue a committed rise or poison a valid seal.
    f.put('lint/ratchet.json',JSON.stringify(budgets(99,999)));f.put('lint/custom-sections.json','foreign invalid policy');
    const good=f.run('guards',sealed,[],base);
    expect(good.status,good.stdout+good.stderr).toBe(0);
    expect(good.stdout).toContain('guards: exact committed inputs passed');
    f.put('lint/ratchet.json',JSON.stringify(budgets(3,100)));f.put('lint/custom-sections.json',JSON.stringify(policy));
    const raised=f.commit();
    f.put('lint/ratchet.json',JSON.stringify(budgets(1,90)));
    const bad=f.run('guards',raised,[],sealed);
    expect(bad.status).toBe(1);expect(bad.stderr).toContain('demo: custom-section ceilings are shrink-only');
    f.put('lint/ratchet.json',JSON.stringify(budgets(2,100)));f.put('lint/custom-sections.json',JSON.stringify({...policy,raises:[]}));
    const malformed=f.commit();
    f.put('lint/custom-sections.json',JSON.stringify(policy));
    const refused=f.run('guards',malformed,[],sealed);
    expect(refused.status).toBe(1);expect(refused.stderr).toContain('custom-section policy is malformed');
  }finally{f.close();}
});

test('a later exact approval repairs a net candidate but cannot approve a larger final row',()=>{
  const f=fixture();try {
    f.put('scripts/check-closed-components.mjs','export function closedComponentSources(){return [];}');
    f.put('scripts/check-platform-ratchets.mjs','export const PLATFORM_LISTS=[];export function comparePlatformList(){return [];}');
    f.put('scripts/ratchet-approval.mjs',readFileSync(resolve('scripts/ratchet-approval.mjs'),'utf8'));
    const rule='wildshard/generator-imports',file='src/main.ts';
    f.put('lint/ratchet.json',JSON.stringify({[rule]:{[file]:0}}));const base=f.commit();
    f.put('lint/ratchet.json',JSON.stringify({[rule]:{[file]:11}}));const unapproved=f.commit();
    expect(f.run('guards',unapproved,[],base).status).toBe(1);
    f.git('commit','--allow-empty','-qm',`docs(policy): correct approval\n\nRatchet-Approved: wildshard-new ${rule} ${file} +11`);
    const approved=f.git('rev-parse','HEAD'),result=f.run('guards',approved,[],base);
    expect(result.status,result.stderr).toBe(0);
    f.put('lint/ratchet.json',JSON.stringify({[rule]:{[file]:22}}));const larger=f.commit();
    const refused=f.run('guards',larger,[],base);expect(refused.status).toBe(1);expect(refused.stderr).toContain('+22');
  }finally{f.close();}
});

test('committed guards seed a new rule atomically and ignore dirty future config for its predecessor',()=>{
  const f=fixture();try {
    f.put('scripts/check-closed-components.mjs','export function closedComponentSources(){return [];}');
    f.put('scripts/check-platform-ratchets.mjs','export const PLATFORM_LISTS=[];export function comparePlatformList(){return [];}');
    f.put('scripts/ratchet-approval.mjs',readFileSync(resolve('scripts/ratchet-approval.mjs'),'utf8'));
    const base=f.commit(),rule='wildshard/no-generated-json-import',file='scripts/old.ts';
    f.put(file,"import rows from './rows.generated.json';export default rows;");
    const predecessor=f.commit();
    const config={jsPlugins:['./lint/plugin.mjs'],rules:{[rule]:['error',{count:true}]}};
    f.put('.oxlintrc.ratchet.json',JSON.stringify(config));f.put('lint/ratchet.json',JSON.stringify({[rule]:{[file]:1}}));
    const old=f.run('guards',predecessor,[],base);expect(old.status,old.stderr).toBe(0);
    const oldCounts=f.run('ratchet-counts',predecessor,['src/main.ts','scripts/old.ts'],base);
    expect(oldCounts.status,oldCounts.stderr).toBe(0);
    const measured:unknown=JSON.parse(oldCounts.stdout);expect(measured).not.toHaveProperty(rule);
    const seeded=f.commit(),initial=f.run('guards',seeded,[],base);expect(initial.status,initial.stderr).toBe(0);
    f.put('lint/ratchet.json',JSON.stringify({[rule]:{[file]:2}}));
    const raised=f.commit(),refused=f.run('guards',raised,[],seeded);
    expect(refused.status).toBe(1);expect(refused.stderr).toContain(`${rule} ${file} +1`);
  }finally{f.close();}
});
