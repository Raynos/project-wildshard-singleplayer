import {InputHashMemo} from '../scripts/bake-input-hashes.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned source and cache fixtures.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths only.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { generateShardJob, prepareGeneration, type GenerationPreparation } from '../scripts/generate.mjs';

const owned: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function put(root: string, path: string, text: string): void { mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),text); }
it('uses upstream producer identities and a clean stage on cold, warm and previously populated exports', async () => {
  mkdirSync('tmp',{recursive:true}); const root=mkdtempSync(resolve('tmp/generation-upstream-'));owned.push(root);
  const shard='src/shards/alpha', first=`${shard}/data/first.json`, second=`${shard}/data/second.json`;
  mkdirSync(resolve(root,'scripts'),{recursive:true}); put(root,`${shard}/source.txt`,'authored');
  const jobs=[{id:'first',output:first},{id:'second',output:second}].map(({id,output})=>({id:`fixture-${id}`,shard:'alpha',entry:`${shard}/generators/bake-${id}.mjs`,command:[`${shard}/generators/bake-${id}.mjs`],inputRoots:[shard],outputs:[output],buildTimeOutputs:[output],platform:'portable' as const}));
  put(root,`${shard}/generators/bake-first.mjs`,`import fs from 'node:fs'; fs.writeFileSync('${first}',JSON.stringify({source:fs.readFileSync('${shard}/source.txt','utf8'),sawLater:fs.existsSync('${second}')}));`);
  put(root,`${shard}/generators/bake-second.mjs`,`import fs from 'node:fs'; fs.writeFileSync('${second}',JSON.stringify({...JSON.parse(fs.readFileSync('${first}','utf8')),second:true}));`);
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs}));
  const log=vi.spyOn(console,'info').mockImplementation(()=>{ /* Capture independent job verdicts. */ }), cacheDir=resolve(root,'cache');
  await prepareGeneration(root,{cacheDir});
  const expected=readFileSync(resolve(root,second),'utf8'); expect(JSON.parse(expected)).toEqual({source:'authored',sawLater:false,second:true});
  // An unchanged warm restoration preserves the file, including its exact stat
  // identity; an edited or missing output must still be repaired from evidence.
  const outputPath=resolve(root,second);
  utimesSync(outputPath,123,456);
  const before=statSync(outputPath,{bigint:true});
  log.mockClear();
  await prepareGeneration(root,{cacheDir});
  expect(log.mock.calls.filter(row=>String(row[0]).includes('verified snapshot'))).toHaveLength(2);
  expect(statSync(outputPath,{bigint:true})).toMatchObject({dev:before.dev,ino:before.ino,size:before.size,mtimeNs:before.mtimeNs,ctimeNs:before.ctimeNs});
  writeFileSync(outputPath,'corrupt');utimesSync(outputPath,123,456);
  await prepareGeneration(root,{cacheDir});
  expect(readFileSync(outputPath,'utf8')).toBe(expected);
  const legacy:GenerationPreparation={outputs:[first,second],upstream:new Map()};
  const indexed:GenerationPreparation={outputs:[first,second],outputRoots:new Map([[shard,[first,second]]]),completedOutputs:new Map(),upstream:new Map()};
  try {
    for(const job of jobs) {
      const previous=await generateShardJob(root,job,{cacheDir,preparation:legacy});legacy.upstream.set(job.id,previous);
      const current=await generateShardJob(root,job,{cacheDir,preparation:indexed});indexed.upstream.set(job.id,current);
      expect(current.key).toBe(previous.key);expect(current.hashes).toEqual(previous.hashes);expect(current.hit).toBe(true);
      for(const [file,hash] of Object.entries(current.hashes))indexed.completedOutputs?.set(file,{id:job.id,result:current,hash});
    }
  } finally {
    for(const result of [...legacy.upstream.values(),...indexed.upstream.values()])result.release();
  }
  for (const history of ['populated','empty']) {
    if(history==='empty') {rmSync(resolve(root,first));rmSync(resolve(root,second));}
    log.mockClear(); await prepareGeneration(root,{cacheDir});
    expect(log.mock.calls.filter(row=>/verified (?:cache|snapshot)/u.test(String(row[0])))).toHaveLength(2);
    expect(log.mock.calls.some(row=>String(row[0]).includes(', generated,'))).toBe(false);
    expect(readFileSync(resolve(root,second),'utf8')).toBe(expected);
  }
  put(root,`${shard}/source.txt`,'changed'); log.mockClear(); await prepareGeneration(root,{cacheDir});
  expect(log.mock.calls.filter(row=>String(row[0]).includes(', generated,'))).toHaveLength(2);
  expect(JSON.parse(readFileSync(resolve(root,second),'utf8'))).toEqual({source:'changed',sawLater:false,second:true});
});

it.each(['retained','committed'])('keeps %s binary outputs in broad consumers before and after their producer runs', async mode => {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-retained-'));owned.push(root);
  const shard='src/shards/alpha', binary='public/assets/alpha/baked/crags.bin', marker=`${shard}/data/marker.json`, output=`${shard}/data/inventory.json`;
  put(root,binary,'committed-retained');
  const producer={id:'fixture-crags',shard:'alpha',entry:`${shard}/generators/bake-crags.mjs`,command:[`${shard}/generators/bake-crags.mjs`],inputRoots:[shard],outputs:[marker,binary],buildTimeOutputs:mode==='retained'?[marker]:[marker,binary],platform:'portable'};
  const consumer={id:'fixture-inventory',shard:'alpha',entry:`${shard}/generators/bake-inventory.mjs`,command:[`${shard}/generators/bake-inventory.mjs`],inputRoots:[shard,'public/assets/alpha'],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  put(root,producer.entry,`import fs from 'node:fs';fs.writeFileSync('${marker}','{}');fs.writeFileSync('${binary}','${mode==='retained'?'unrestored-generated':'committed-retained'}');`);
  put(root,consumer.entry,`import fs from 'node:fs';fs.writeFileSync('${output}',JSON.stringify({binary:fs.readFileSync('${binary}','utf8')}));`);
  const log=vi.spyOn(console,'info').mockImplementation(()=>{ /* Observe warm reuse. */ }),cacheDir=resolve(root,'cache');
  if(mode==='committed') {
    const inventory=resolve(root,'tree-files.json');put(root,'tree-files.json',JSON.stringify({root,files:[binary]}));
    vi.stubEnv('WS_GENERATION_TREE_FILES',inventory);vi.stubEnv('WS_GENERATION_TREE_ROOT',root);
  }
  // Catalogue order exercises both sides of the former exclusion rule.
  for(const jobs of [[consumer,producer],[producer,consumer]]) {
    put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs}));
    await prepareGeneration(root,{cacheDir});
    expect(JSON.parse(readFileSync(resolve(root,output),'utf8'))).toEqual({binary:'committed-retained'});
    expect(readFileSync(resolve(root,binary),'utf8')).toBe('committed-retained');
    log.mockClear();await prepareGeneration(root,{cacheDir});
    expect(log.mock.calls.filter(row=>/verified (?:cache|snapshot)/u.test(String(row[0])))).toHaveLength(2);
  }
  if(mode==='retained') {
    put(root,binary,'changed-retained');await prepareGeneration(root,{cacheDir});
    expect(JSON.parse(readFileSync(resolve(root,output),'utf8'))).toEqual({binary:'changed-retained'});
  }
});

it('refreshes generated-table admission when a later report declares a retained producer',async()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-admission-'));owned.push(root);
  const shard='src/shards/alpha',binary=`${shard}/data/retained.generated.bin`,output=`${shard}/data/inventory.json`,marker=`${shard}/data/marker.json`;
  put(root,binary,JSON.stringify('retained'));mkdirSync(resolve(root,'scripts'));
  put(root,'scripts/source-generation-outputs.json',JSON.stringify({producers:{}}));
  const consumer={id:'fixture-reader',shard:'alpha',entry:`${shard}/generators/bake-reader.mjs`,command:[`${shard}/generators/bake-reader.mjs`],inputRoots:[shard],outputs:[output],buildTimeOutputs:[output],platform:'portable'};
  put(root,consumer.entry,`import fs from 'node:fs';fs.writeFileSync('${output}',JSON.stringify('initial'));`);
  const catalog=(jobs:unknown[]):void=>put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs}));
  catalog([consumer]);await prepareGeneration(root,{cacheDir:resolve(root,'cache')});
  const producer={id:'fixture-retained',shard:'alpha',entry:`${shard}/generators/bake-retained.mjs`,command:[`${shard}/generators/bake-retained.mjs`],inputRoots:[shard],outputs:[binary,marker],buildTimeOutputs:[marker],platform:'portable'};
  put(root,producer.entry,`import fs from 'node:fs';fs.writeFileSync('${binary}',JSON.stringify('unrestored'));fs.writeFileSync('${marker}',JSON.stringify('marker'));`);
  put(root,consumer.entry,`import fs from 'node:fs';fs.writeFileSync('${output}',fs.readFileSync('${binary}'));`);
  catalog([consumer,producer]);await prepareGeneration(root,{cacheDir:resolve(root,'cache')});
  expect(JSON.parse(readFileSync(resolve(root,output),'utf8'))).toBe('retained');
  put(root,binary,JSON.stringify('edited'));await prepareGeneration(root,{cacheDir:resolve(root,'cache')});
  expect(JSON.parse(readFileSync(resolve(root,output),'utf8'))).toBe('edited');
});

it('reuses a consumer when a rerun producer writes identical stage bytes', async () => {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-cutoff-'));owned.push(root);
  const shard='src/shards/alpha', first=`${shard}/data/first.json`, second=`${shard}/data/second.json`;
  const entry=`${shard}/generators/bake-first.mjs`, consumer=`${shard}/generators/bake-second.mjs`;
  put(root,'source.txt','first input');
  put(root,entry,`import fs from 'node:fs';fs.readFileSync('source.txt');fs.writeFileSync('${first}',JSON.stringify('same output'));`);
  put(root,consumer,`import fs from 'node:fs';fs.writeFileSync('${second}',fs.readFileSync('${first}'));`);
  const jobs=[
    {id:'cutoff-first',shard:'alpha',entry,command:[entry],inputRoots:[entry,'source.txt'],outputs:[first],buildTimeOutputs:[first],platform:'portable'},
    {id:'cutoff-second',shard:'alpha',entry:consumer,command:[consumer],inputRoots:[consumer,`${shard}/data`],outputs:[second],buildTimeOutputs:[second],platform:'portable'},
  ];
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs}));
  const cacheDir=resolve(root,'cache'),log=vi.spyOn(console,'info').mockImplementation(()=>{ /* Observe independent producer verdicts. */ });
  await prepareGeneration(root,{cacheDir});put(root,'source.txt','changed input');log.mockClear();
  await prepareGeneration(root,{cacheDir});
  expect(log.mock.calls.filter(row=>String(row[0]).includes(', generated,'))).toHaveLength(1);
  expect(log.mock.calls.some(row=>String(row[0]).includes('cutoff-second, verified cache'))).toBe(true);
  expect(JSON.parse(readFileSync(resolve(root,second),'utf8'))).toBe('same output');
});


it('names the job and exact changed input while refusing an unproven copied stage',async()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-copy-'));owned.push(root);
  const entry='src/shards/alpha/generators/bake-copy.mjs',output='src/shards/alpha/data/result.json';
  const job={id:'fixture-copy',shard:'alpha',entry,command:[entry],inputRoots:[entry,'source.txt'],outputs:[output],buildTimeOutputs:[output],platform:'portable' as const};
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}',JSON.stringify('must not publish'));`);
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[job]}));
  put(root,'source.txt','captured source');
  const memo=new InputHashMemo(root);memo.enableSnapshot(()=>false);memo.hash('source.txt');
  put(root,'source.txt','changed after capture');
  await expect(generateShardJob(root,job,{cacheDir:resolve(root,'cache'),inputHashes:memo,restore:true}))
    .rejects.toThrow('Generation inputs changed while copying fixture-copy: source.txt (expected ');
  expect(existsSync(resolve(root,output))).toBe(false);
});


it('refuses a stale tracked output pin before restore and accepts the fresh matching producer',async()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-pin-'));owned.push(root);
  const entry='src/shards/alpha/generators/bake-pin.mjs',output='public/assets/alpha/mesh.bin';
  put(root,output,'old committed topology');put(root,'expected.bin','new merged topology');
  const memo=new InputHashMemo(root),old=memo.hash(output),fresh=memo.hash('expected.bin');
  put(root,entry,`import fs from 'node:fs';fs.writeFileSync('${output}','new merged topology');`);
  const job={id:'fixture-pin',shard:'alpha',entry,command:[entry],inputRoots:[entry],outputs:[output],buildOutputs:{[output]:old},platform:'portable' as const};
  const catalogue=(value:unknown):void=>put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs:[value]}));
  catalogue(job);
  await expect(generateShardJob(root,job,{cacheDir:resolve(root,'cache'),restore:true,forceCompare:true}))
    .rejects.toThrow(`Pinned generation output differs: fixture-pin ${output}; expected ${old}, generated ${fresh}`);
  expect(readFileSync(resolve(root,output),'utf8')).toBe('old committed topology');
  const corrected={...job,buildOutputs:{[output]:fresh}};catalogue(corrected);
  const result=await generateShardJob(root,corrected,{cacheDir:resolve(root,'cache'),restore:true,forceCompare:true});
  try{expect(result.hashes[output]).toBe(fresh);expect(readFileSync(resolve(root,output),'utf8')).toBe('new merged topology');}
  finally{result.release();}
});
