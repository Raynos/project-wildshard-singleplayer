// oxlint-disable-next-line import/no-nodejs-modules -- The fixtures stage deletions in their own temporary Git repositories.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The predecessor's exact output bytes are the required pin.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture repositories are isolated from the shared tree.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures use the canonical temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- All writes remain inside the owned fixture root.
import { dirname, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { assertGenerationRemovalProof, planGenerationRemovals } from '../scripts/generation-removals.mjs';
import { precommitGenerationRemovals } from '../scripts/precommit-generation-removals.mjs';
import type { ShardGenerationJob } from '../scripts/generate.mjs';
import type { CleanRoomReport } from '../scripts/generation-clean-room.mjs';

const output = 'src/shards/sample/data/value.bin';
const digest = createHash('sha256').update('exact bytes').digest('hex');
function fixture(): {root:string;component:ShardGenerationJob;product:ShardGenerationJob;put:(file:string,text:string)=>void;stage:(jobs:ShardGenerationJob[])=>void;git:(args:string[])=>string;close:()=>void} {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'generation-removal-test-')));
  const put = (file:string,text:string):void => {const path=resolve(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
  const git = (args:string[]):string => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  for (const file of ['scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs','scripts/generation-capture.mjs']) {
    mkdirSync(dirname(resolve(root,file)),{recursive:true});copyFileSync(resolve(file),resolve(root,file));
  }
  const entry='src/shards/sample/generators/bake-sample.mjs';
  put(entry,`import {existsSync,readFileSync,writeFileSync} from 'node:fs';
for(const file of ['src/shards/sample/runtime','src/shards/sample-legacy','${output}'])if(existsSync(file))throw new Error('retained source survived');
writeFileSync('${output}',readFileSync('src/shards/sample/data/value.txt'));`);
  const productEntry='src/shards/sample/generators/bake-product.mjs';
  const productDirectory='public/shardfiles/sample';
  put(productEntry,`import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('${productDirectory}',{recursive:true});writeFileSync('${productDirectory}/shard.json',readFileSync('src/shards/sample/data/product.txt'));writeFileSync('${productDirectory}/value.bin',readFileSync('${output}'));`);
  put('src/shards/sample/data/value.txt','exact bytes');put(output,'exact bytes');
  put('src/shards/sample/data/product.txt','{"complete":"fixture product"}\n');
  put(`${productDirectory}/shard.json`,'{"complete":"fixture product"}\n');put(`${productDirectory}/value.bin`,'exact bytes');
  put('src/shards/sample/runtime/source.ts','trusted');put('src/shards/sample-legacy/source.ts','legacy');put('README.md','unlisted');
  const component:ShardGenerationJob={id:'component',shard:'sample',entry,command:[entry],inputRoots:[entry,'src/shards/sample/data/value.txt'],outputs:[output],platform:'native'};
  const product:ShardGenerationJob={id:'product',shard:'sample',entry:productEntry,command:[productEntry],inputRoots:[productEntry,'src/shards/sample/data/product.txt',output],outputs:[`${productDirectory}/shard.json`,`${productDirectory}/value.bin`],platform:'native'};
  const catalog=(jobs:ShardGenerationJob[]):void=>{put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs}));};
  catalog([component,product]);git(['init','-q']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture']);
  return {root,component,product,put,git,stage:jobs=>{catalog(jobs);git(['rm','-q','--',output]);git(['add','scripts/generation-jobs.json']);},close:()=>{rmSync(root,{recursive:true,force:true});}};
}
it('admits a tracked deletion only after the staged complete product and output cold-regenerate exactly',async()=>{
  const f=fixture();
  try {
    f.stage([{...f.component,buildOutputs:{[output]:digest}},f.product]);
    f.put('src/shards/sample/data/value.txt','foreign WIP');
    const plan=await precommitGenerationRemovals(f.root);
    expect(plan?.outputs).toEqual([{file:output,job:'component',shard:'sample',expected:digest}]);
    expect(plan?.jobIds).toEqual(['component','product']);
    expect(existsSync(resolve(f.root,output))).toBe(false);
    expect(readFileSync(resolve(f.root,'src/shards/sample/data/value.txt'),'utf8')).toBe('foreign WIP');
    expect(existsSync(resolve(f.root,'src/shards/sample/runtime'))).toBe(true);
  } finally {f.close();}
});
it('refuses missing, wrong or changed predecessor hashes and removed producer ownership',()=>{
  const f=fixture();
  try {
    for(const after of [f.component,{...f.component,buildOutputs:{[output]:'0'.repeat(64)}},{...f.component,shard:'different',buildOutputs:{[output]:digest}}]) expect(()=>planGenerationRemovals([f.component],[after,f.product],[output],()=>digest)).toThrow(/hash|shard-owned/u);
    expect(()=>planGenerationRemovals([f.component],[f.product],[output],()=>digest)).toThrow('shard-owned');
    expect(()=>planGenerationRemovals([f.component],[{...f.component,buildOutputs:{[output]:digest}}],[output],()=>digest)).toThrow('complete shard.json producer');
    expect(()=>planGenerationRemovals([f.component],[{...f.component,buildOutputs:{[output]:digest}},{...f.product,comparisonOutputs:Object.fromEntries(f.product.outputs.map(file=>[file,digest]))}],[output],()=>digest)).toThrow('complete shard.json producer');
    for(const restriction of [{platform:'darwin' as const},{browser:true},{preview:true},{capture:true},{recordedInputs:true},{seedOutputs:[output]}]) expect(()=>planGenerationRemovals([f.component],[{...f.component,...restriction,buildOutputs:{[output]:digest}},f.product],[output],()=>digest)).toThrow('cold build-time');
  } finally {f.close();}
});
it('refuses a component-only match, a failed product, a mismatched output and a stale tree report',()=>{
  const f=fixture();
  try {
    const plan=planGenerationRemovals([f.component],[{...f.component,buildOutputs:{[output]:digest}},f.product],[output],()=>digest);
    const report:CleanRoomReport={schema:'generation-clean-room/1',reportOnly:true,pin:'staged',platform:'linux',arch:'x64',node:'fixture',removed:[],unregistered:[],sourceProbes:[],jobs:[{id:'component',entry:f.component.entry,status:'matched',reasons:[],outputs:[{file:output,expected:digest,generated:digest,exact:true}]}],shardfiles:[]};
    expect(()=>assertGenerationRemovalProof(plan,report,'staged')).toThrow('complete product');
    const product={shard:'sample',status:'matched' as const,reason:'Cold product regenerated exactly'};
    expect(()=>assertGenerationRemovalProof(plan,{...report,shardfiles:[{...product,status:'unavailable'}]},'staged')).toThrow('complete product');
    expect(()=>assertGenerationRemovalProof(plan,{...report,shardfiles:[product]},'different')).toThrow('different staged tree');
    const job=report.jobs[0];if(job===undefined)throw new Error('Missing fixture job');
    expect(()=>assertGenerationRemovalProof(plan,{...report,shardfiles:[product],jobs:[{...job,outputs:[{file:output,expected:digest,generated:'0'.repeat(64),exact:false}]}]},'staged')).toThrow('cold-regenerate');
  } finally {f.close();}
});
it('runs no producer for unlisted deletions, normal source edits or historical output removals',async()=>{
  const f=fixture();
  try {
    f.git(['rm','-q','README.md']);expect(await precommitGenerationRemovals(f.root)).toBeNull();
    f.git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','unlisted deletion']);
    f.put(f.component.entry,"throw new Error('must not execute');");f.git(['add',f.component.entry]);
    expect(await precommitGenerationRemovals(f.root)).toBeNull();
    expect(planGenerationRemovals([f.component],[{...f.component,buildOutputs:{[output]:digest}},f.product],[],()=>{throw new Error('must not read');}).outputs).toEqual([]);
  } finally {f.close();}
});
it('refuses an actual changed cold output and a quiet-window rehearsal',async()=>{
  for(const quiet of [false,true]) {
    const f=fixture();
    try {
      if(quiet)f.put('.git/quiet','measurement');else {f.put('src/shards/sample/data/value.txt','changed source');f.git(['add','src/shards/sample/data/value.txt']);}
      f.stage([{...f.component,buildOutputs:{[output]:digest}},f.product]);
      await expect(precommitGenerationRemovals(f.root)).rejects.toThrow(quiet?'Quiet window':'cold-regenerate');
      expect(existsSync(resolve(f.root,output))).toBe(false);
    } finally {f.close();}
  }
});
