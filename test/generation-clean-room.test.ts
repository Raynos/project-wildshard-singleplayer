// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture is its own temporary git repository.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture producers and retained evidence belong to this test.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated archives live outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay within an owned root.
import { dirname, resolve as absolutePath } from 'node:path';
import { expect, it } from 'vitest';
import { cleanRoomGeneration } from '../scripts/generation-clean-room.mjs';
import { generateShardJob, prepareGeneration, type ShardGenerationJob } from '../scripts/generate.mjs';

function fixture(change?:(job:ShardGenerationJob,put:(file:string,text:string)=>void)=>void):{root:string;pin:string;job:ShardGenerationJob;close:()=>void} {
  const root = realpathSync(mkdtempSync(absolutePath(tmpdir(),'clean-room-test-')));
  const put = (file:string,text:string):void => {const path = absolutePath(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
  for (const file of ['scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs','scripts/generation-capture.mjs']) {
    mkdirSync(dirname(absolutePath(root,file)),{recursive:true});copyFileSync(absolutePath(file),absolutePath(root,file));
  }
  const entry = 'src/shards/sample/generators/bake-sample.mjs';
  put(entry,`import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';const root=resolve(import.meta.dirname,'../../../..');
for(const file of ['src/shards/sample/runtime','src/shards/sample-legacy','src/sdk/runtime','public/out/value.bin'])if(existsSync(resolve(root,file)))throw new Error('trusted source or retained output survived: '+file);
mkdirSync(resolve(root,'public/out'),{recursive:true});writeFileSync(resolve(root,'public/out/value.bin'),readFileSync(resolve(root,'src/shards/sample/data/value.txt')));`);
  put('src/shards/sample/data/value.txt','exact bytes');put('public/out/value.bin','exact bytes');
  put('src/shards/sample/runtime/source.ts','trusted source');put('src/shards/sample-legacy/source.ts','legacy source');put('src/sdk/runtime/source.ts','runtime facade');
  const job:ShardGenerationJob={id:'sample',shard:'sample',entry,command:[entry],inputRoots:['src/shards/sample/generators','src/shards/sample/data'],outputs:['public/out/value.bin'],platform:'native'};
  change?.(job,put);
  put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[job]}));
  execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});
  execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture'],{cwd:root});
  const pin=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  return {root,pin,job,close:()=>{rmSync(root,{recursive:true,force:true});}};
}
it('cold-generates exact bytes from a pinned archive after deleting runtime, legacy and every generated output',async()=>{
  const f=fixture();
  try {
    // Uncommitted inputs must not sneak into the archive or its cache key.
    writeFileSync(absolutePath(f.root,'src/shards/sample/data/value.txt'),'foreign WIP');
    const report=await cleanRoomGeneration(f.root,{pin:f.pin});
    expect(report.jobs[0]).toMatchObject({status:'matched',reasons:[],outputs:[{file:'public/out/value.bin',exact:true}]});
    expect(report.removed.sort()).toEqual(['src/sdk/runtime','src/shards/sample-legacy','src/shards/sample/runtime']);
    expect(report.shardfiles).toEqual([{shard:'sample',status:'unavailable',reason:'No retained shardfile generation job declared'}]);
    expect(readFileSync(absolutePath(f.root,'public/out/value.bin'),'utf8')).toBe('exact bytes');
    expect(readFileSync(absolutePath(f.root,'src/shards/sample/data/value.txt'),'utf8')).toBe('foreign WIP');
    expect(existsSync(absolutePath(f.root,'src/shards/sample/runtime'))).toBe(true);
    expect((await cleanRoomGeneration(f.root,{pin:f.pin})).jobs[0]?.status).toBe('matched');
  } finally {f.close();}
});
it('does not mistake a successful cold producer with different bytes for parity',async()=>{
  const f=fixture((_job,put)=>{put('src/shards/sample/data/value.txt','changed authoring bytes');});
  try {const report=await cleanRoomGeneration(f.root,{pin:f.pin});expect(report.jobs[0]).toMatchObject({status:'different',outputs:[{exact:false}]});expect(readFileSync(absolutePath(f.root,'public/out/value.bin'),'utf8')).toBe('exact bytes');}
  finally {f.close();}
});
it('reports page captures, runtime input roots and output seeds without running a producer',async()=>{
  const f=fixture((job,put)=>{job.browser=true;job.seedOutputs=job.outputs;job.inputRoots.push('src/shards/sample/runtime');put(job.entry,"throw new Error('must not execute');");});
  try {
    const report=await cleanRoomGeneration(f.root,{pin:f.pin});
    expect(report.jobs[0]?.status).toBe('blocked');expect(report.jobs[0]?.outputs).toEqual([]);
    expect(report.jobs[0]?.reasons.join('\n')).toContain('Page/browser-bound');
    expect(report.jobs[0]?.reasons.join('\n')).toContain('Input root outside authoring');
    expect(report.jobs[0]?.reasons.join('\n')).toContain('source seed');
  } finally {f.close();}
});
it('admits an authoring-only preload, but never a preload that reaches game services',async()=>{
  for (const trusted of [false,true]) {
    const f=fixture((job,put)=>{
      job.command=['--import','./src/sdk/bake/loader.mjs',job.entry];job.inputRoots.push('src/sdk/bake');
      put('src/sdk/bake/loader.mjs',trusted?"import '../../game/service.mjs';":"export const authoring = true;");
      if(trusted)put('src/game/service.mjs',"throw new Error('must never execute');");
    });
    try {
      const row=(await cleanRoomGeneration(f.root,{pin:f.pin,jobIds:['sample']})).jobs[0];
      expect(row?.status).toBe(trusted?'blocked':'matched');
      if(trusted)expect(row?.reasons.join('\n')).toContain('Preload outside-authoring');
    } finally {f.close();}
  }
});
it('refuses an unknown selected job instead of returning empty evidence',async()=>{
  const f=fixture();
  try {await expect(cleanRoomGeneration(f.root,{pin:f.pin,jobIds:['missing']})).rejects.toThrow('Unknown clean-room job');}
  finally {f.close();}
});

it('compares an absent report-only output without restoring it or activating its job',async()=>{
  const f=fixture((job)=>{job.comparisonOutputs={'public/out/value.bin':'0'.repeat(64)};});
  try {
    const report=await cleanRoomGeneration(f.root,{pin:f.pin});
    expect(report.jobs[0]?.status).toBe('failed');
    expect(report.jobs[0]?.reasons.join('\n')).toContain('Comparison output hash differs');
    expect(readFileSync(absolutePath(f.root,'public/out/value.bin'),'utf8')).toBe('exact bytes');
  } finally {f.close();}
});

it('never activates or restores a comparison-only job',async()=>{
  const f=fixture((job,put)=>{
    job.comparisonOutputs={'public/out/value.bin':'0'.repeat(64)};
    put(job.entry,"throw new Error('report-only producer must not be activated');");
  });
  try {
    expect((await prepareGeneration(f.root)).jobs).toHaveLength(1);
    await expect(generateShardJob(f.root,f.job,{restore:true})).rejects.toThrow('Comparison-only job cannot restore');
  } finally {f.close();}
});
