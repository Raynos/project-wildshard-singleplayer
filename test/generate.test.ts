import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromium } from 'playwright';
// oxlint-disable-next-line import/no-nodejs-modules -- The fake producer's executable is its cache identity.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- This fixture exercises isolated on-disk Node generators.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each producer runs in an owned temporary directory.
import { platform as hostPlatform, tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths are checked against the generator's isolated root.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- A local scalar preview fixture tests the build fence without a game browser.
import { createServer } from 'node:http';
import { compareGeneration } from '../scripts/generation-linux.mjs';
import { discoverGeneration, generationInputs, generateShardJob, reportGeneration, type GenerationComparison, type ShardGenerationJob } from '../scripts/generate.mjs';

const roots:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture():{root:string;job:ShardGenerationJob} {
  const root=mkdtempSync(resolve(tmpdir(),'generation-runner-test-'));roots.push(root);
  const put=(file:string,text:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),text);};
  for(const file of ['scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs','scripts/generation-capture.mjs']){mkdirSync(dirname(resolve(root,file)),{recursive:true});copyFileSync(resolve(file),resolve(root,file));}
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
    let comparisons:readonly GenerationComparison[]=[];
    await expect(generateShardJob(root,job,{cacheDir:resolve(root,'cache'),onComparison:rows=>{comparisons=rows;}})).rejects.toThrow('Committed generated output differs');
    expect(comparisons).toHaveLength(1);expect(comparisons[0]?.rawExact).toBe(false);expect(comparisons[0]?.equivalent).toBe(false);
    expect(readFileSync(resolve(root,job.outputs[0] ?? ''),'utf8')).toBe('old bytes');
  });
  it('discovers and runs explicitly shared producers without inventing a shard or accepting helpers',async()=>{
    const {root,job}=fixture(),entry='scripts/bake-shared.mjs';
    writeFileSync(resolve(root,entry),`import {readFileSync,writeFileSync} from 'node:fs';writeFileSync('public/out/value.bin',readFileSync('src/shards/sample/data/value.txt'));`);
    const shared={...job,id:'shared',shard:null,entry,command:[entry],inputRoots:[...job.inputRoots,entry]};
    writeFileSync(resolve(root,'scripts/generation-jobs.json'),JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[shared]}));
    writeFileSync(resolve(root,'scripts/bake-next.mjs'),'// undeclared producer');
    expect(discoverGeneration(root).unregistered).toContain('scripts/bake-next.mjs');
    expect(discoverGeneration(root).unregistered).not.toContain('scripts/bake-input-hashes.mjs');
    const cold=await generateShardJob(root,shared,{cacheDir:resolve(root,'cache')});
    const warm=await generateShardJob(root,shared,{cacheDir:resolve(root,'cache')});
    const forced=await generateShardJob(root,shared,{cacheDir:resolve(root,'cache'),forceCompare:true});
    expect(warm.hit).toBe(true);expect(forced.hashes).toEqual(cold.hashes);
    await expect(generateShardJob(root,{...shared,entry:'scripts/bake-input-hashes.mjs',command:['scripts/bake-input-hashes.mjs']},{cacheDir:resolve(root,'cache')})).rejects.toThrow('Generator must be owned');
    await expect(generateShardJob(root,{...shared,entry:job.entry,command:[job.entry]},{cacheDir:resolve(root,'cache')})).rejects.toThrow('Generator must be owned');
  });
  it('fences shared browser commands without exempting their raw output bytes',async()=>{
    const {root,job}=fixture(),revision='1'.repeat(40);
    // This producer is a Node fixture, not a browser capture. Fence its actual executable without installed Chromium.
    const executable=vi.spyOn(chromium,'executablePath').mockReturnValue(execPath);
    const server=createServer((request,response)=>{
      if(request.url==='/version.json') response.end(JSON.stringify({build:`${revision.slice(0,7)}-fixture`}));
      else response.end('bit-exact');
    });
    await new Promise<void>(_resolve=>{server.listen(0,'127.0.0.1',_resolve);});
    try {
      const address=server.address();if(address===null || typeof address==='string') throw new Error('Missing fixture port');
      const url=`http://127.0.0.1:${address.port}/`;
      writeFileSync(resolve(root,job.entry),`import {writeFileSync} from 'node:fs';const url=process.argv.find(arg=>arg.startsWith('--url=')).slice(6);writeFileSync('public/out/value.bin',await (await fetch(new URL('input',url))).text());`);
      const previewJob={...job,browser:true,preview:true,command:[job.entry,'--url=<preview-url>']};
      const result=await generateShardJob(root,previewJob,{cacheDir:resolve(root,'cache'),preview:{url,revision}});
      expect(result.hit).toBe(false);expect(executable).toHaveBeenCalled();
      writeFileSync(resolve(root,job.outputs[0] ?? ''),'changed');
      await expect(generateShardJob(root,previewJob,{cacheDir:resolve(root,'cache'),preview:{url,revision}})).rejects.toThrow('Committed generated output differs');
      await expect(generateShardJob(root,{...previewJob,preview:false},{cacheDir:resolve(root,'cache')})).rejects.toThrow('Undeclared preview command');
    } finally {await new Promise<void>((_resolve,reject)=>{server.close(error=>{if(error===undefined)_resolve();else reject(error);});});}
  });
  it('does not mistake copied schema seeds for fresh generated outputs',async()=>{
    const {root,job}=fixture();
    writeFileSync(resolve(root,job.entry),'// no generation');
    const output='src/shards/sample/data/value.txt';
    await expect(generateShardJob(root,{...job,outputs:[output],seedOutputs:[output]},{cacheDir:resolve(root,'cache')})).rejects.toThrow('did not write declared outputs');
    expect(readFileSync(resolve(root,output),'utf8')).toBe('bit-exact');
  });
  it('ignores only registered input metadata while preserving every recorded gameplay field',async()=>{
    const {root,job}=fixture(),output='src/shards/pine-hollow/runtime/kingCollision.baked.json';
    mkdirSync(dirname(resolve(root,output)),{recursive:true});writeFileSync(resolve(root,output),JSON.stringify({inputs:{source:'old'},anchor:[1,2,3]}));
    writeFileSync(resolve(root,job.entry),`import {writeFileSync} from 'node:fs';import {resolve} from 'node:path';writeFileSync(resolve(import.meta.dirname,'../../../..','${output}'),JSON.stringify({inputs:{source:'new'},anchor:[1,2,3]}));`);
    const recorded={...job,outputs:[output],recordedInputs:true};
    let rows:readonly GenerationComparison[]=[];
    const result=await generateShardJob(root,recorded,{cacheDir:resolve(root,'cache'),onComparison:observed=>{rows=observed;}});expect(result.hit).toBe(false);
    expect(rows[0]?.rawExact).toBe(false);expect(rows[0]?.equivalent).toBe(true);
    const original=readFileSync(resolve(root,output),'utf8');expect(original).toContain('old');
    writeFileSync(resolve(root,job.entry),readFileSync(resolve(root,job.entry),'utf8').replace('anchor:[1,2,3]','anchor:[1,2,3.0000001]'));
    await expect(generateShardJob(root,recorded,{cacheDir:resolve(root,'cache')})).rejects.toThrow('Committed generated output differs');
    expect(readFileSync(resolve(root,output),'utf8')).toBe(original);
  });
  it('refuses provenance exclusions for outputs outside the registered recorded-bake list',async()=>{
    const {root,job}=fixture();
    await expect(generateShardJob(root,{...job,recordedInputs:true},{cacheDir:resolve(root,'cache')})).rejects.toThrow('not registered');
  });
  it('reports exact bytes, refused mismatches, unavailable generation and Darwin retention separately',async()=>{
    const {root,job}=fixture();
    const make=(id:string,platform:'native'|'darwin',source:string,retained:string):ShardGenerationJob=>{
      const entry=`src/shards/sample/generators/bake-${id}.mjs`,output=`public/out/${id}.bin`;
      writeFileSync(resolve(root,entry),source.replaceAll('<output>',output));
      writeFileSync(resolve(root,output),retained);
      return {...job,id,entry,command:[entry],outputs:[output],platform};
    };
    const jobs=[job,
      make('different','native',`import {writeFileSync} from 'node:fs';writeFileSync('<output>','new');`,'old'),
      make('failed','native',`throw new Error('missing actual tool');`,'kept'),
      make('darwin','darwin',`throw new Error('must not run');`,'retained')];
    writeFileSync(resolve(root,'scripts/generation-jobs.json'),JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs}));
    const report=await compareGeneration(root,{pin:'fixture',cacheDir:resolve(root,'cache')});
    expect(report.platform).toBe(hostPlatform());
    expect(report.jobs.map(row=>row.status)).toEqual(['matched','different','unavailable','darwin-only']);
    expect(report.bitExactOutputs).toEqual(job.outputs);
    expect(report.differentOutputs).toEqual(['public/out/different.bin']);
    expect(report.unavailableOutputs).toEqual(['public/out/failed.bin']);
    expect(report.jobs[2]?.outputs[0]?.generatedHash).toBeNull();
    expect(report.jobs[3]?.outputs[0]?.rawExact).toBeNull();
    expect(readFileSync(resolve(root,'public/out/different.bin'),'utf8')).toBe('old');
    expect(readFileSync(resolve(root,'public/out/failed.bin'),'utf8')).toBe('kept');
    expect(readFileSync(resolve(root,'public/out/darwin.bin'),'utf8')).toBe('retained');
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
