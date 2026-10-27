// oxlint-disable-next-line import/no-nodejs-modules -- Tiny tracked Git fixtures prove native input isolation.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- All owned fixtures remain under repository tmp.
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import { join, resolve as resolvePath } from 'node:path';
import { expect, test } from 'vitest';
import { candidateCheckPlan, runCandidatePlan, candidateStepOutcomes, type CandidateCheckPlan } from '../scripts/precommit-candidate.mjs';
import type { GateSelection } from '../scripts/gate-selection.mjs';
import type { runCommitJobs } from '../scripts/precommit-jobs.mjs';

const selection: GateSelection={tests:['test/pure.test.ts','test/product.test.ts','scripts/pure.test.mjs','scripts/product.test.mjs'],projects:['tsconfig.engine.json'],products:['a'],touchedProducts:['a'],generators:['a-data'],related:{files:[],direct:[],nearest:[],candidates:0,omitted:0},wide:false};
const registry={'test/product.test.ts':['a'],'scripts/product.test.mjs':['a']};
const plan=():CandidateCheckPlan=>candidateCheckPlan('/committed/precommit-related.mjs',selection,['src/value.ts'],registry);
function fixture() {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolvePath('tmp/candidate-check-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
  const git=(...args:string[]):string=>execFileSync('git',args,{cwd:root,env,encoding:'utf8'}).trim();
  git('init','-q','-b','main');git('config','user.name','candidate fixture');git('config','user.email','candidate@example.invalid');git('config','core.hooksPath','/dev/null');
  mkdirSync(join(root,'src'));writeFileSync(join(root,'src/value.mjs'),'7');git('add','.');git('commit','-qm','fixture');
  const dir=join(root,'slot/tree');mkdirSync(join(dir,'src'),{recursive:true});
  writeFileSync(join(dir,'src/value.mjs'),'7');copyFileSync(join(root,'.git/index'),join(root,'slot/index'));
  writeFileSync(join(root,'src/value.mjs'),'999');
  return {root,mirror:{dir,sha:git('rev-parse','HEAD'),release:()=>{/* the fixture owns cleanup */}},close:()=>rmSync(root,{recursive:true,force:true})};
}
function deferred() {
  let release=():void=>{throw new Error('uninitialized resolver');};
  const promise=new Promise<void>(resolve=>{release=resolve;});
  return {promise,release};
}

test('the one selection keeps Node and Vitest cases and places consumers after products',()=>{
  const result=plan();
  expect(result.immediate.map(job=>job.name)).toEqual(['candidate types','node tests (pure)','related tests (pure)']);
  expect(result.immediate[0]?.command.slice(1)).toEqual(['node_modules/typescript/bin/tsc','-b','tsconfig.engine.json']);
  expect(result.immediate[1]?.command.slice(1)).toEqual(['--test','scripts/pure.test.mjs']);
  expect(result.immediate[2]?.command.slice(-2)).toEqual(['--selected','["test/pure.test.ts"]']);
  expect(result.preparation[0]?.command.slice(0,4)).toEqual(['python3','scripts/heavy-lane.py','build','--']);
  expect(result.preparation[0]?.command.at(-1)).toContain('scope:["a"]');
  expect(result.consumers.map(job=>job.name)).toEqual(['node tests (products)','related tests (products)']);
});

test('empty selections start no work, while a shared generator still gets its preparation',()=>{
  const empty={...selection,tests:[],projects:[],products:[],generators:[]};
  expect(candidateCheckPlan('/checker',empty,[],{})).toEqual({immediate:[],preparation:[],consumers:[]});
  expect(candidateCheckPlan('/checker',{...empty,generators:['shared']},[],{}).preparation).toHaveLength(1);
});

test('pure tests and types start while products prepare; consumers wait for successful preparation',async()=>{
  const f=fixture(),prepared=deferred(),calls:string[][]=[];
  const execute:typeof runCommitJobs=async(root,jobs,_deadline,env)=>{
    expect(root).toBe(f.mirror.dir);expect(env?.['GIT_WORK_TREE']).toBe(f.mirror.dir);
    expect(env?.['GIT_INDEX_FILE']).toBe(join(f.root,'slot/index'));expect(env?.['WS_COMMIT_RELATED_TOKEN']).toBe('owned');
    calls.push(jobs.map(job=>job.name));
    if(jobs.some(job=>job.name==='candidate products'))await prepared.promise;
    return jobs.map(job=>({name:job.name,code:0,timedOut:false,output:''}));
  };
  try {
    const checking=runCandidatePlan(f.root,f.mirror,plan(),performance.now()+1000,{execute,token:'owned'});
    expect(calls).toHaveLength(3);expect(calls.flat()).not.toContain('related tests (products)');
    prepared.release();expect(await checking).toHaveLength(6);
    expect(calls[3]).toEqual(['node tests (products)','related tests (products)']);
  }finally{prepared.release();f.close();}
});

test.each([1,124])('a product refusal %i names unstarted consumers and never runs them',async code=>{
  const f=fixture(),calls:string[][]=[];
  const execute:typeof runCommitJobs=(_root,jobs)=>{
    calls.push(jobs.map(job=>job.name));return Promise.resolve(jobs.map(job=>({name:job.name,code:job.name==='candidate products'?code:0,timedOut:job.name==='candidate products'&&code===124,output:''})));
  };
  try {
    const result=await runCandidatePlan(f.root,f.mirror,plan(),performance.now()+1000,{execute});
    expect(calls).toHaveLength(3);
    expect(result.filter(row=>row.name.includes('(products)'))).toEqual(plan().consumers.map(job=>({name:job.name,code,timedOut:code===124,output:'Not started: candidate product prerequisite did not complete'})));
  }finally{f.close();}
});

test('native child source and Git reads use the sealed mirror despite loose peer poison',async()=>{
  const f=fixture(),before=readFileSync(join(f.root,'.git/index'));
  try {
    const result=await runCandidatePlan(f.root,f.mirror,{immediate:[{name:'native input',command:[process.execPath,'--input-type=module','--eval',"import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';console.log(readFileSync('src/value.mjs','utf8')+':'+execFileSync('git',['show',':src/value.mjs'],{encoding:'utf8'}));"]}],preparation:[],consumers:[]},performance.now()+5000);
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({code:0,output:'7:7\n'});
    expect(readFileSync(join(f.root,'src/value.mjs'),'utf8')).toBe('999');expect(readFileSync(join(f.root,'.git/index'))).toEqual(before);
    expect(readdirSync(join(f.root,'tmp'))).toEqual([]);
  }finally{f.close();}
});

test('read receipts map back to the repository and preserve nested fixture roots',async()=>{
  const f=fixture(),readSet=join(f.root,'original-reads'),previous=process.env['WS_COMMIT_READ_SET'];
  process.env['WS_COMMIT_READ_SET']=readSet;
  const execute:typeof runCommitJobs=(_root,jobs,_deadline,env)=>{
    const reads=env?.['WS_COMMIT_READ_SET'];if(reads===undefined)throw new Error('missing owned read set');
    if(jobs.length>0)appendFileSync(reads,`${JSON.stringify({root:f.mirror.dir,paths:['src/value.mjs']})}\n${JSON.stringify({root:'nested fixture',paths:[]})}\n`);
    return Promise.resolve(jobs.map(job=>({name:job.name,code:0,timedOut:false,output:''})));
  };
  try {
    await runCandidatePlan(f.root,f.mirror,{immediate:[{name:'read',command:[]}],preparation:[],consumers:[]},performance.now()+1000,{execute});
    const rows:unknown=JSON.parse(`[${readFileSync(readSet,'utf8').trim().split('\n').join(',')}]`);
    expect(rows).toEqual([{root:f.root,paths:['src/value.mjs']},{root:'nested fixture',paths:[]}]);
  }finally{if(previous===undefined)delete process.env['WS_COMMIT_READ_SET'];else process.env['WS_COMMIT_READ_SET']=previous;f.close();}
});

test('one rejected executor drains the already-started product job before cleanup',async()=>{
  const f=fixture(),prepared=deferred();let settled=false;
  const execute:typeof runCommitJobs=async(_root,jobs)=>{
    if(jobs.some(job=>job.name==='candidate types'))throw new Error('compiler unavailable');
    if(jobs.some(job=>job.name==='candidate products'))await prepared.promise;
    return jobs.map(job=>({name:job.name,code:0,timedOut:false,output:''}));
  };
  try {
    const checking=runCandidatePlan(f.root,f.mirror,plan(),performance.now()+1000,{execute}).finally(()=>{settled=true;});
    const refused=expect(checking).rejects.toThrow('compiler unavailable');
    await Promise.resolve();expect(settled).toBe(false);expect(readdirSync(join(f.root,'tmp'))).toHaveLength(1);
    prepared.release();await refused;expect(readdirSync(join(f.root,'tmp'))).toEqual([]);
  }finally{prepared.release();f.close();}
});


test('only capped steps hand off; actual tooling failures and observed reds still refuse',()=>{
  const outcome=candidateStepOutcomes([
    {name:'candidate products',code:124,timedOut:true,output:''},
    {name:'candidate types',code:1,timedOut:false,output:'compiler unavailable'},
    {name:'related tests (pure)',code:0,timedOut:false,output:''},
  ],'owned');
  expect(outcome.deferred).toEqual(['candidate products']);
  expect(outcome.failures).toEqual(['candidate types: tooling/prerequisite failed (exit 1)']);
  for(const [name,output] of [
    ['candidate types','source.ts(1,2): error TS2322: wrong'],
    ['related tests (pure)','CF1 TEST FAILURE: owned test/fail.test.ts'],
    ['related tests (products)','CF1 RUNNER FAILURE: owned missing fixture'],
    ['node tests (pure)','not ok 1 - failed control'],
    ['candidate products','Error: missing named asset'],
  ]) {
    if(name===undefined||output===undefined)throw new Error('missing refusal control');
    expect(candidateStepOutcomes([{name,output,code:124,timedOut:true}],'owned')).toEqual({failures:[`${name}: observed refusal`],deferred:[]});
  }
});

test('a nested fixture token cannot forge an owning red at the cap; cancellation never hands off',()=>{
  expect(candidateStepOutcomes([{name:'related tests (pure)',code:124,timedOut:true,output:'CF1 TEST FAILURE: nested test/value.test.ts'}],'owned')).toEqual({failures:[],deferred:['related tests (pure)']});
  expect(candidateStepOutcomes([{name:'candidate types',code:130,timedOut:false,cancelled:true,output:''}],'owned')).toEqual({failures:['candidate types: cancelled'],deferred:[]});
});


test('the cap drains a detached product child and leaves an unrelated control alive',async()=>{
  const f=fixture();let descendant:number|undefined;
  const control=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  const closed=new Promise<void>(resolve=>{control.once('close',()=>{resolve();});});
  try {
    const result=await runCandidatePlan(f.root,f.mirror,{immediate:[{name:'nested product',command:[process.execPath,'-e',
      "const{spawn}=require('node:child_process');const{writeSync}=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});writeSync(1,String(child.pid));setInterval(()=>{},1000);"]}],preparation:[],consumers:[]},performance.now()+1000);
    expect(result[0]).toMatchObject({code:124,timedOut:true});
    const pid=Number(result[0]?.output);if(!Number.isSafeInteger(pid)||pid<=1)throw new Error('missing owned descendant PID');descendant=pid;
    const state=spawnSync('ps',['-p',String(pid),'-o','stat='],{encoding:'utf8'});
    expect(state.status===1||/^\s*Z/u.test(state.stdout)).toBe(true);
    const controlPid=control.pid;if(controlPid===undefined)throw new Error('missing independent fixture process');
    expect(()=>process.kill(controlPid,0)).not.toThrow();
  }finally{
    control.kill('SIGKILL');
    if(descendant!==undefined)try{process.kill(descendant,'SIGKILL');}catch(error){expect(error).toMatchObject({code:'ESRCH'});}
    await closed;f.close();
  }
});
