// oxlint-disable-next-line import/no-nodejs-modules -- Owned source/cache fixtures.
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bounded fixture paths.
import {dirname,resolve} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {generateShardJob,type ShardGenerationJob} from '../scripts/generate.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function put(root:string,file:string,text:string):void {mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);}
function fixture(source?:string) {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-inputs-'));owned.push(root);
  const entry='src/shards/alpha/generators/bake-reader.mjs',output='src/shards/alpha/data/output.txt';
  put(root,entry,source??`import {value} from '../../../sdk/used.mjs';import fs from 'node:fs';fs.writeFileSync('${output}',String(value));`);
  put(root,'src/sdk/used.mjs','export const value=1;');put(root,'src/sdk/unread.ts','// unrelated source');
  for(const name of ['generation-recorder.mjs','shardfile-inputs.mjs','compiler-code.mjs','bake-input-hashes.mjs']) {
    mkdirSync(resolve(root,'scripts'),{recursive:true});copyFileSync(resolve('scripts',name),resolve(root,'scripts',name));
  }
  mkdirSync(resolve(root,'node_modules'));symlinkSync(realpathSync(resolve('node_modules/valibot')),resolve(root,'node_modules/valibot'));
  const job:ShardGenerationJob={id:'fixture-reader',shard:'alpha',entry,command:[entry],inputRoots:['src/shards/alpha','src/sdk'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  const cacheDir=resolve(root,'cache');
  const run=async(forceCompare=false)=>{
    const result=await generateShardJob(root,job,{cacheDir,forceCompare});
    try {return {hit:result.hit,key:result.key,text:readFileSync(resolve(result.directory,output),'utf8')};}
    finally {result.release();}
  };
  return {root,entry,output,cacheDir,run};
}
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
  put(root,'src/sdk/optional.ts','// newly resolvable module');
  expect(await run()).toMatchObject({hit:false,text:'true'});
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
it('runs strict regeneration even when an observed key is warm',async()=>{
  const output='src/shards/alpha/data/output.txt';
  const {run}=fixture(`import fs from 'node:fs';fs.writeFileSync('${output}',crypto.randomUUID());`);
  await run();expect((await run()).hit).toBe(true);
  await expect(run(true)).rejects.toThrow('Regenerate-and-compare failed');
});
