import { afterEach, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- This fixture exercises isolated on-disk Node generators.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each producer runs in an owned temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths are checked against the generator's isolated root.
import { dirname, resolve } from 'node:path';
import { discoverGeneration, generationInputs, generateShardJob, reportGeneration, type ShardGenerationJob } from '../scripts/generate.mjs';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture():{root:string;job:ShardGenerationJob} {
  const root=mkdtempSync(resolve(tmpdir(),'generation-runner-test-'));roots.push(root);
  const put=(file:string,text:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);};
  for(const file of ['scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs']){mkdirSync(dirname(resolve(root,file)),{recursive:true});copyFileSync(resolve(file),resolve(root,file));}
  const entry='src/shards/sample/generators/bake-sample.mjs';
  put(entry,`import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';const root=resolve(import.meta.dirname,'../../../..');mkdirSync(resolve(root,'public/out'),{recursive:true});writeFileSync(resolve(root,'public/out/value.bin'),readFileSync(resolve(root,'src/shards/sample/data/value.txt')));`);
  put('src/shards/sample/generators/bake-undeclared.mjs','// future producer');
  put('src/shards/sample/data/value.txt','bit-exact');put('public/out/value.bin','bit-exact');
  const job:ShardGenerationJob={id:'sample',shard:'sample',entry,command:[entry],inputRoots:['src/shards/sample'],outputs:['public/out/value.bin'],platform:'native'};
  put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
  return {root,job};
}
describe('G292 shard generation entry',()=>{
  it('reports uncovered entry points and missing outputs without claiming a build proof',()=>{
    const {root,job}=fixture();
    expect(discoverGeneration(root).unregistered).toEqual(['src/shards/sample/generators/bake-undeclared.mjs']);
    rmSync(resolve(root,job.outputs[0] ?? ''));
    expect(reportGeneration(root).missing).toEqual(job.outputs);
  });
  it('generates in isolation, hits the shared cache, regenerates for comparison, and restores only missing bytes',async()=>{
    const {root,job}=fixture(),cacheDir=resolve(root,'cache');
    const before=readFileSync(resolve(root,job.outputs[0] ?? ''));
    const cold=await generateShardJob(root,job,{cacheDir});
    expect(cold.hit).toBe(false);expect(readFileSync(resolve(root,job.outputs[0] ?? ''))).toEqual(before);
    const warm=await generateShardJob(root,job,{cacheDir});expect(warm.hit).toBe(true);expect(warm.hashes).toEqual(cold.hashes);
    const fresh=await generateShardJob(root,job,{cacheDir,forceCompare:true});expect(fresh.hit).toBe(false);expect(fresh.hashes).toEqual(cold.hashes);
    rmSync(resolve(root,job.outputs[0] ?? ''));
    await generateShardJob(root,job,{cacheDir,restore:true});expect(readFileSync(resolve(root,job.outputs[0] ?? ''))).toEqual(before);
  });
  it('rejects a real output mismatch without rewriting the committed file',async()=>{
    const {root,job}=fixture();writeFileSync(resolve(root,job.outputs[0] ?? ''),'old bytes');
    await expect(generateShardJob(root,job,{cacheDir:resolve(root,'cache')})).rejects.toThrow('Committed generated output differs');
    expect(readFileSync(resolve(root,job.outputs[0] ?? ''),'utf8')).toBe('old bytes');
  });
  it('does not mistake copied schema seeds for fresh generated outputs',async()=>{
    const {root,job}=fixture();
    writeFileSync(resolve(root,job.entry),'// no generation');
    const output='src/shards/sample/data/value.txt';
    await expect(generateShardJob(root,{...job,outputs:[output]},{cacheDir:resolve(root,'cache')})).rejects.toThrow('did not write declared outputs');
    expect(readFileSync(resolve(root,output),'utf8')).toBe('bit-exact');
  });
  it('rejects duplicate outputs, ownership escapes and input symlinks',()=>{
    const {root,job}=fixture();
    symlinkSync(resolve(root,'src/shards/sample/data/value.txt'),resolve(root,'src/shards/sample/data/link'));
    expect(()=>generationInputs(root,['src/shards/sample'])).toThrow('symlink');
    const save=(jobs:ShardGenerationJob[]):void=>writeFileSync(resolve(root,'scripts/generation-jobs.json'),JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs}));
    save([job,{...job,id:'another'}]);expect(()=>discoverGeneration(root)).toThrow('Duplicate generated output');
    save([{...job,entry:'scripts/else.mjs'}]);expect(()=>discoverGeneration(root)).toThrow('Generator must be owned');
    expect(()=>generationInputs(root,['../escaped'])).toThrow();
    expect(existsSync(resolve(root,'public/out/value.bin'))).toBe(true);
  });
});
