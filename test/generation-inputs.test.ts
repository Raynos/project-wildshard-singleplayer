// oxlint-disable-next-line import/no-nodejs-modules -- Owned source/cache fixtures.
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bounded fixture paths.
import {dirname,resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Reseal old/malformed owned observations to exercise version validation.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {afterEach,expect,it} from 'vitest';
import {generateShardJob,type GenerationPreparation,type ShardGenerationJob} from '../scripts/generate.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function put(root:string,file:string,text:string):void {mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);}
function fixture(source?:string,catalogPath='scripts/generation-jobs.json') {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-inputs-'));owned.push(root);
  const entry='src/shards/alpha/generators/bake-reader.mjs',output='src/shards/alpha/data/output.txt';
  put(root,entry,source??`import {value} from '../../../sdk/used.mjs';import fs from 'node:fs';fs.writeFileSync('${output}',String(value));`);
  put(root,'package.json',JSON.stringify({type:'module'}));
  put(root,'src/sdk/used.mjs','export const value=1;');put(root,'src/sdk/unread.ts','// unrelated source');
  for(const name of ['generation-recorder.mjs','shardfile-inputs.mjs','shardfile-cache.mjs','compiler-code.mjs','function-source.mjs','bake-input-hashes.mjs']) {
    mkdirSync(resolve(root,'scripts'),{recursive:true});copyFileSync(resolve('scripts',name),resolve(root,'scripts',name));
  }
  mkdirSync(resolve(root,'node_modules'));symlinkSync(realpathSync(resolve('node_modules/valibot')),resolve(root,'node_modules/valibot'));
  const job:ShardGenerationJob={id:'fixture-reader',shard:'alpha',entry,command:[entry],inputRoots:['src/shards/alpha','src/sdk'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  put(root,catalogPath,JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  const cacheDir=resolve(root,'cache');
  const run=async(forceCompare=false,preparation?:GenerationPreparation)=>{
    const result=await generateShardJob(root,job,{cacheDir,forceCompare,catalogPath,...(preparation===undefined?{}:{preparation})});
    try {return {hit:result.hit,key:result.key,text:readFileSync(resolve(result.directory,output),'utf8')};}
    finally {result.release();}
  };
  return {root,entry,output,cacheDir,job,run};
}
function packageFixture(source?:string) {
  const row=fixture(source??`import {value} from '@wildshard/sdk/used';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  put(row.root,'src/sdk/other.mjs','export const value=2;');
  const write=(exports:Record<string,unknown>,metadata:Record<string,unknown>={}):void=>put(row.root,'src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',type:'module',...metadata,exports}));
  write({'./used':'./used.mjs','./unused':'./other.mjs'});
  mkdirSync(resolve(row.root,'node_modules/@wildshard'),{recursive:true});
  symlinkSync('../../src/sdk',resolve(row.root,'node_modules/@wildshard/sdk'),'dir');
  return {...row,write};
}
it('reuses only unused workspace export edits and keeps other package fields exact',async()=>{
  const {write,run}=packageFixture();const first=await run();expect(first).toMatchObject({hit:false,text:'1'});
  write({'./used':'./used.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'});
  expect(await run()).toEqual({...first,hit:true});
  write({'./used':'./other.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'});
  expect(await run()).toMatchObject({hit:false,text:'2'});
  write({'./used':'./other.mjs','./unused':'./used.mjs','./new-unused':'./other.mjs'},{private:true});
  expect((await run()).hit).toBe(false);
});
it('keeps attempted missing exports so an added matching key invalidates',async()=>{
  const {write,run}=packageFixture(`import fs from 'node:fs';let value=0;try{value=(await import('@wildshard/sdk/optional')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  await run();expect(await run()).toMatchObject({hit:true,text:'0'});
  write({'./used':'./used.mjs','./optional':'./other.mjs'});
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps wildcard export rows and raw package reads exact',async()=>{
  const {write,run}=packageFixture();await run();
  write({'./used':'./used.mjs','./unused':'./other.mjs','./*':'./other.mjs'});
  expect((await run()).hit).toBe(false);
  const raw=packageFixture(`import {value} from '@wildshard/sdk/used';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value)+fs.readFileSync('src/sdk/package.json','utf8'));`);
  await raw.run();raw.write({'./used':'./used.mjs','./unused':'./used.mjs'});
  expect((await raw.run()).hit).toBe(false);
});
it('keeps unsupported conditional-root package exports conservative',async()=>{
  const {write,run}=packageFixture(`import {value} from '@wildshard/sdk';import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));`);
  write({import:'./used.mjs',default:'./used.mjs'});await run();
  write({import:'./used.mjs',default:'./other.mjs'});
  expect((await run()).hit).toBe(false);
});
it('reuses unread SDK edits but rebuilds imported code and newly read branches',async()=>{
  const {root,entry,output,run}=fixture();const first=await run();expect(first.hit).toBe(false);
  put(root,'src/sdk/unread.ts','// edited unrelated source');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/used.mjs','/** executed docs changed */ export const value=1;');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/used.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'2'});
  // An old read set misses on the changed entry. The new branch executes with
  // the full closure, then records its previously unread source dependency.
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('src/sdk/unread.ts'));`);
  expect(await run()).toMatchObject({hit:false,text:'// edited unrelated source'});
  put(root,'src/sdk/unread.ts','// newly observed bytes');
  expect(await run()).toMatchObject({hit:false,text:'// newly observed bytes'});
  expect((await run()).hit).toBe(true);
});
it.each(['json','bin'])('reuses unread %s content and records newly consumed bytes',async extension=>{
  const {root,entry,output,run}=fixture();
  const file=`src/sdk/unread.${extension}`;put(root,file,'first bytes');
  const first=await run();put(root,file,'changed unread bytes');
  expect(await run()).toEqual({...first,hit:true});
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${file}'));`);
  expect(await run()).toMatchObject({hit:false,text:'changed unread bytes'});
  put(root,file,'changed consumed bytes');
  expect(await run()).toMatchObject({hit:false,text:'changed consumed bytes'});
});
it('records JSON module bytes even when the native loader bypasses public fs reads',async()=>{
  const file='src/sdk/rows.json';
  const {root,run}=fixture(`import rows from '../../../sdk/rows.json' with {type:'json'};import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(rows.value));`);
  put(root,file,JSON.stringify({value:1}));expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,file,JSON.stringify({value:2}));expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps unobserved content bytes conservative when a child process consumes them',async()=>{
  const file='src/sdk/unread.json';
  const {root,run}=fixture(`import fs from 'node:fs';import {execFileSync} from 'node:child_process';fs.writeFileSync('src/shards/alpha/data/output.txt',execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('${file}'))"]));`);
  put(root,file,'first bytes');expect(await run()).toMatchObject({hit:false,text:'first bytes'});
  put(root,file,'changed opaque bytes');expect(await run()).toMatchObject({hit:false,text:'changed opaque bytes'});
});
it('retains unconsumed root build policy metadata',async()=>{
  const {root,run}=fixture();put(root,'pnpm-lock.yaml','first lock identity');
  await run();expect((await run()).hit).toBe(true);
  put(root,'pnpm-lock.yaml','changed lock identity');
  expect((await run()).hit).toBe(false);
});
it.each(['scripts/generation-jobs.json','scripts/custom-jobs.json'])('reuses unread %s bytes and unrelated source additions',async file=>{
  const {root,run}=fixture(undefined,file);const first=await run();expect(first.hit).toBe(false);
  const catalogue=readFileSync(resolve(root,file),'utf8');
  put(root,file,catalogue.replace('DO NOT EDIT fixture','DO NOT EDIT changed unrelated catalogue metadata'));
  expect(await run()).toEqual({...first,hit:true});
  // Fully positive ESM reads do not depend on unrelated source names.
  put(root,'src/sdk/new-module.ts','export const unused=1;');
  expect(await run()).toEqual({...first,hit:true});
  rmSync(resolve(root,'src/sdk/unread.ts'));
  expect(await run()).toEqual({...first,hit:true});
});
it.each(['scripts/generation-jobs.json','scripts/custom-jobs.json'])('keeps actually read %s bytes exact',async file=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${file}'));`,file);
  const first=await run();expect(first.hit).toBe(false);expect((await run()).hit).toBe(true);
  const text=readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT changed catalogue metadata');
  put(root,file,text);
  expect(await run()).toMatchObject({hit:false,text});
});
it('projects output-only catalogue readers without losing shared or orphan-protected paths',async()=>{
  const source="import fs from 'node:fs';const {jobs}=JSON.parse(fs.readFileSync('scripts/generation-jobs.json','utf8'));fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(jobs.map(({id,outputs,buildOutputs,buildTimeOutputs})=>({id,outputs,buildOutputs,buildTimeOutputs}))));";
  const {root,job,run}=fixture(source);job.catalogueOutputsOnly=true;
  const other:ShardGenerationJob={id:'fixture-other',shard:'beta',entry:'src/shards/beta/generators/bake-other.mjs',command:['src/shards/beta/generators/bake-other.mjs'],inputRoots:['src/shards/beta'],outputs:['public/assets/shared/retained.bin','public/assets/beta/runtime.bin'],buildOutputs:{'public/assets/shared/retained.bin':'a'.repeat(64)},buildTimeOutputs:['public/assets/beta/runtime.bin'],platform:'portable'};
  const write=():void=>put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[other,job]}));
  write();const first=await run();expect(first.hit).toBe(false);
  expect(first.text).toContain('public/assets/shared/retained.bin');
  expect(first.text).toContain('public/assets/beta/runtime.bin');
  other.command.push('--different-authoring-mode');other.inputRoots.push('src/format');
  write();expect(await run()).toEqual({...first,hit:true});
  other.outputs.push('public/assets/beta/orphan-protected.glb');
  write();expect(await run()).toMatchObject({hit:false});
  expect((await run()).text).toContain('orphan-protected.glb');
  other.buildOutputs={'public/assets/shared/retained.bin':'b'.repeat(64)};
  write();expect((await run()).hit).toBe(false);
  other.buildTimeOutputs?.push('public/assets/beta/new-runtime.bin');
  write();expect((await run()).hit).toBe(false);
});
it('keeps full-catalogue readers byte-exact unless they explicitly opt in',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',fs.readFileSync('scripts/generation-jobs.json'));");
  await run();expect((await run()).hit).toBe(true);
  const file='scripts/generation-jobs.json';
  put(root,file,readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT another notice'));
  expect((await run()).hit).toBe(false);
});
it('keeps the conservative key when no raw input would remain',async()=>{
  const {root,run}=fixture();rmSync(resolve(root,'package.json'));
  await run();expect((await run()).hit).toBe(true);
  const file='scripts/generation-jobs.json';
  put(root,file,readFileSync(resolve(root,file),'utf8').replace('DO NOT EDIT fixture','DO NOT EDIT changed metadata'));
  expect((await run()).hit).toBe(false);
});
it.each(['raw','function-text'])('keeps %s self-source reads byte-exact',async mode=>{
  const {root,entry,output,run}=fixture();
  const source=`/** first docs */ import fs from 'node:fs';export function compile(){return 1;}fs.writeFileSync('${output}',String(${mode==='raw'?`fs.readFileSync('${entry}','utf8').length`:'compile.toString().length'}));`;
  put(root,entry,source);await run();expect((await run()).hit).toBe(true);
  put(root,entry,source.replace('first docs','longer changed docs'));
  expect((await run()).hit).toBe(false);
});
it('invalidates negative probes when the declared input inventory gains a file',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',String(fs.existsSync('src/sdk/optional.ts')));`);
  expect(await run()).toMatchObject({hit:false,text:'false'});expect((await run()).hit).toBe(true);
  put(root,'src/sdk/unrelated-new.ts','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'false'});
  put(root,'src/sdk/optional.ts','// newly resolvable module');
  expect(await run()).toMatchObject({hit:false,text:'true'});
});
it.each([
  ["import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.readdirSync('src/sdk').sort()));",'directory'],
  ["import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.globSync('src/sdk/*.mjs').sort()));",'glob'],
  ["import fs from 'node:fs';let value='absent';try{value=fs.realpathSync.native('src/sdk/optional.mjs').split('/').at(-1);}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',value);",'native-realpath'],
  ["import fs from 'node:fs';let value='absent';try{value=fs.readFileSync('src/sdk/optional.mjs','utf8');}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',value);",'failed-read'],
  ["import fs from 'node:fs';let value=0;try{value=(await import('../../../sdk/optional.mjs')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));",'failed-import'],
])('invalidates %s observations when a previously absent source appears',async(source,kind)=>{
  const {root,run}=fixture(source);const first=await run();expect((await run()).hit).toBe(true);
  if(['native-realpath','failed-read'].includes(kind)) {
    put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
    expect((await run()).hit,kind).toBe(true);
  }
  put(root,'src/sdk/optional.mjs','export const value=2;');
  const changed=await run();expect(changed.hit,kind).toBe(false);expect(changed.text).not.toBe(first.text);
});
it('models only staged paths instead of loose working-tree files',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('src/not-in-stage/optional.mjs')));");
  put(root,'src/not-in-stage/optional.mjs','export const loose=1;');
  expect(await run()).toMatchObject({hit:false,text:'false'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'false'});
  rmSync(resolve(root,'src/not-in-stage/optional.mjs'));
  expect(await run()).toMatchObject({hit:true,text:'false'});
});
it('includes the catalogue and initially created output directories in probes',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify([fs.existsSync('scripts/generation-jobs.json'),fs.existsSync('src/shards/alpha/data')]));");
  expect(await run()).toMatchObject({hit:false,text:'[true,true]'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'[true,true]'});
});
it('includes immutable upstream stage files even when absent from the checkout',async()=>{
  const upstream='src/shards/alpha/data/upstream.mjs';
  const {root,cacheDir,job,run}=fixture(`import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('${upstream}')));`);
  const entry='src/shards/alpha/generators/bake-upstream.mjs';
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${upstream}','export const value=1;');`);
  const producer:ShardGenerationJob={id:'fixture-upstream',shard:'alpha',entry,command:[entry],inputRoots:[entry],outputs:[upstream],buildTimeOutputs:[upstream],platform:'portable'};
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[producer,job]}));
  const loan=await generateShardJob(root,producer,{cacheDir});
  try {
    const preparation:GenerationPreparation={outputs:[upstream,...job.outputs],upstream:new Map([[producer.id,loan]])};
    expect(await run(false,preparation)).toMatchObject({hit:false,text:'true'});
    put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
    expect(await run(false,preparation)).toMatchObject({hit:true,text:'true'});
    // No raw working-tree output was published; dropping the immutable loan
    // changes the actual initial stage and must invalidate its presence probe.
    preparation.upstream.clear();
    expect(await run(false,preparation)).toMatchObject({hit:false,text:'false'});
  } finally {loan.release();}
});
it('fences recursive directory reads by their staged subtree',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',JSON.stringify(fs.readdirSync('src/sdk/list',{recursive:true}).sort()));");
  put(root,'src/sdk/list/first.mjs','export const first=1;');
  const first=await run();expect(first.hit).toBe(false);
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/list/nested/second.mjs','export const second=2;');
  const changed=await run();expect(changed.hit).toBe(false);expect(changed.text).toContain('second.mjs');
});
it('includes ancestor types in failed path identities',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';let value='present';try{fs.realpathSync.native('src/sdk/parent.mjs/optional.mjs');}catch(error){value=error.code;}fs.writeFileSync('src/shards/alpha/data/output.txt',value);");
  expect(await run()).toMatchObject({hit:false,text:'ENOENT'});
  put(root,'src/sdk/parent.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:false,text:'ENOTDIR'});
});
it('binds failed file resolution to nearby candidates instead of unrelated trees',async()=>{
  const {root,run}=fixture("import fs from 'node:fs';let value=0;try{value=(await import('../../../sdk/optional/target.mjs')).value;}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  expect(await run()).toMatchObject({hit:false,text:'0'});
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect(await run()).toMatchObject({hit:true,text:'0'});
  put(root,'src/sdk/optional/nearby.mjs','export const other=1;');
  expect(await run()).toMatchObject({hit:false,text:'0'});
  put(root,'src/sdk/optional/target.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it.each([
  "import fs from 'node:fs';fs.writeFileSync('src/shards/alpha/data/output.txt',String(fs.existsSync('node_modules/valibot')));",
  "import fs from 'node:fs';try{await import('fixture-absent-package');}catch{}fs.writeFileSync('src/shards/alpha/data/output.txt','absent');",
])('keeps dependency-link and bare-resolution probes conservative: %s',async source=>{
  const {root,run}=fixture(source);await run();expect((await run()).hit).toBe(true);
  put(root,'src/sdk/unrelated-new.mjs','export const unused=1;');
  expect((await run()).hit).toBe(false);
});
it('keeps higher-priority CommonJS candidates on the complete key',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'package.json',JSON.stringify({type:'commonjs'}));put(root,'src/sdk/chosen.json',JSON.stringify({value:1}));
  expect(await run()).toMatchObject({hit:false,text:'1'});expect((await run()).hit).toBe(true);
  put(root,'src/sdk/chosen.js','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('keeps CommonJS resolution inventory without treating it as module execution',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const name=createRequire(import.meta.url).resolve('../../../sdk/chosen').split('/').at(-1);fs.writeFileSync('src/shards/alpha/data/output.txt',name);");
  put(root,'src/sdk/chosen.json',JSON.stringify({value:1}));
  const first=await run();expect(first).toMatchObject({hit:false,text:'chosen.json'});
  put(root,'src/sdk/chosen.json',JSON.stringify({value:2}));
  put(root,'src/sdk/unread.ts','// changed code cannot affect path resolution');
  expect(await run()).toEqual({...first,hit:true});
  put(root,'src/sdk/chosen.js','export const value=3;');
  expect(await run()).toMatchObject({hit:false,text:'chosen.js'});
});
it('keeps package main metadata exact for CommonJS resolution-only calls',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const name=createRequire(import.meta.url).resolve('../../../sdk/chosen').split('/').at(-1);fs.writeFileSync('src/shards/alpha/data/output.txt',name);");
  put(root,'src/sdk/chosen/package.json',JSON.stringify({main:'first.mjs'}));
  put(root,'src/sdk/chosen/first.mjs','export const value=1;');
  put(root,'src/sdk/chosen/second.mjs','export const value=2;');
  expect(await run()).toMatchObject({hit:false,text:'first.mjs'});
  put(root,'src/sdk/chosen/package.json',JSON.stringify({main:'second.mjs'}));
  expect(await run()).toMatchObject({hit:false,text:'second.mjs'});
});
it('keeps actual CommonJS source byte-exact while omitting unread code',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'src/sdk/chosen.cjs','module.exports={value:1};');
  expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,'src/sdk/unread.ts','// not read by the CommonJS module');
  expect(await run()).toMatchObject({hit:true,text:'1'});
  put(root,'src/sdk/chosen.cjs','// changed raw CommonJS bytes\nmodule.exports={value:1};');
  expect(await run()).toMatchObject({hit:false,text:'1'});
  put(root,'src/sdk/chosen.cjs','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'2'});
});
it('captures nested CommonJS modules, required JSON and late getter reads',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',String(value));");
  put(root,'src/sdk/chosen.cjs',"const fs=require('node:fs');const nested=require('./nested.cjs');const rows=require('./rows.json');module.exports={get value(){return nested.value+rows.value+Number(fs.readFileSync('src/sdk/late.txt','utf8'));}};");
  put(root,'src/sdk/nested.cjs','module.exports={value:1};');
  put(root,'src/sdk/rows.json',JSON.stringify({value:2}));put(root,'src/sdk/late.txt','3');
  expect(await run()).toMatchObject({hit:false,text:'6'});
  put(root,'src/sdk/nested.cjs','module.exports={value:2};');
  expect(await run()).toMatchObject({hit:false,text:'7'});
  put(root,'src/sdk/rows.json',JSON.stringify({value:3}));
  expect(await run()).toMatchObject({hit:false,text:'8'});
  put(root,'src/sdk/late.txt','4');
  expect(await run()).toMatchObject({hit:false,text:'9'});
});
it('keeps a CommonJS child process on the full conservative closure',async()=>{
  const {root,run}=fixture("import{createRequire}from'node:module';import fs from'node:fs';const value=createRequire(import.meta.url)('../../../sdk/chosen.cjs').value;fs.writeFileSync('src/shards/alpha/data/output.txt',value);");
  put(root,'src/sdk/chosen.cjs',"const {execFileSync}=require('node:child_process');module.exports={value:execFileSync(process.execPath,['-e',\"process.stdout.write('opaque child')\"])};");
  expect(await run()).toMatchObject({hit:false,text:'opaque child'});
  put(root,'src/sdk/unread.ts','// a child process can inspect this file without a trace');
  expect(await run()).toMatchObject({hit:false,text:'opaque child'});
});
it('keeps opaque subprocess reads on the conservative closure',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {root,run}=fixture(`import fs from 'node:fs';import {execFileSync} from 'node:child_process';fs.writeFileSync('${output}',execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('src/sdk/unread.ts'))"]));`);
  expect(await run()).toMatchObject({hit:false,text:'// unrelated source'});
  expect((await run()).hit).toBe(true);put(root,'src/sdk/unread.ts','// hidden child read changed');
  expect(await run()).toMatchObject({hit:false,text:'// hidden child read changed'});
});
it('falls back to the complete key when read profiles are corrupt',async()=>{
  const {root,cacheDir,run}=fixture();await run();
  const jobDir=resolve(cacheDir,'.reads-v1/fixture-reader');
  const recipes=readdirSync(jobDir);expect(recipes).toHaveLength(1);
  for(const recipe of recipes)for(const file of readdirSync(resolve(jobDir,recipe)))writeFileSync(resolve(jobDir,recipe,file),'{}');
  put(root,'src/sdk/unread.ts','// cannot trust the corrupted hint');
  expect((await run()).hit).toBe(false);
});
it.each(['old-schema','missing-probes'])('rejects resealed %s observations',async mode=>{
  const {root,cacheDir,run}=fixture();await run();
  const jobDir=resolve(cacheDir,'.reads-v1/fixture-reader');
  for(const recipe of readdirSync(jobDir))for(const file of readdirSync(resolve(jobDir,recipe))) {
    const path=resolve(jobDir,recipe,file),trace=v.parse(v.record(v.string(),v.unknown()),JSON.parse(readFileSync(path,'utf8')));
    delete trace['seal'];delete trace['inventory'];
    if(mode==='old-schema')trace['schema']='generation-reads/3';
    const seal=createHash('sha256').update(JSON.stringify(trace)).digest('hex');
    writeFileSync(path,JSON.stringify({...trace,seal}));
  }
  put(root,'src/sdk/unread.ts','// old or incomplete observations grant no narrower key');
  expect((await run()).hit).toBe(false);
});
it('runs strict regeneration even when an observed key is warm',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',crypto.randomUUID());`);
  await run();expect((await run()).hit).toBe(true);
  await expect(run(true)).rejects.toThrow('Regenerate-and-compare failed');
});
it('coalesces concurrent observed misses without sharing a probe failure with publication',async()=>{
  const {root,run}=fixture();await run();put(root,'src/sdk/used.mjs','export const value=2;');
  const results=await Promise.all([run(),run()]);
  expect(results.map(row=>row.text)).toEqual(['2','2']);expect(results.every(row=>!row.hit)).toBe(true);
  expect((await run()).hit).toBe(true);
});
