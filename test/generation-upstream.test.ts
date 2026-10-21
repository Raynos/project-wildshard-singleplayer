// oxlint-disable-next-line import/no-nodejs-modules -- Owned source and cache fixtures.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths only.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareGeneration } from '../scripts/generate.mjs';

const owned: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function put(root: string, path: string, text: string): void { mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),text); }
it('uses upstream producer identities and a clean stage on cold, warm and previously populated exports', async () => {
  mkdirSync('tmp',{recursive:true}); const root=mkdtempSync(resolve('tmp/generation-upstream-'));owned.push(root);
  const shard='src/shards/alpha', first=`${shard}/data/first.json`, second=`${shard}/data/second.json`;
  mkdirSync(resolve(root,'scripts'),{recursive:true}); put(root,`${shard}/source.txt`,'authored');
  const jobs=[{id:'first',output:first},{id:'second',output:second}].map(({id,output})=>({id:`fixture-${id}`,shard:'alpha',entry:`${shard}/generators/bake-${id}.mjs`,command:[`${shard}/generators/bake-${id}.mjs`],inputRoots:[shard],outputs:[output],buildTimeOutputs:[output],platform:'portable'}));
  put(root,`${shard}/generators/bake-first.mjs`,`import fs from 'node:fs'; fs.writeFileSync('${first}',JSON.stringify({source:fs.readFileSync('${shard}/source.txt','utf8'),sawLater:fs.existsSync('${second}')}));`);
  put(root,`${shard}/generators/bake-second.mjs`,`import fs from 'node:fs'; fs.writeFileSync('${second}',JSON.stringify({...JSON.parse(fs.readFileSync('${first}','utf8')),second:true}));`);
  put(root,'scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT fixture',jobs}));
  const log=vi.spyOn(console,'info').mockImplementation(()=>{ /* Capture independent job verdicts. */ }), cacheDir=resolve(root,'cache');
  await prepareGeneration(root,{cacheDir});
  const expected=readFileSync(resolve(root,second),'utf8'); expect(JSON.parse(expected)).toEqual({source:'authored',sawLater:false,second:true});
  for (const history of ['populated','empty']) {
    if(history==='empty') {rmSync(resolve(root,first));rmSync(resolve(root,second));}
    log.mockClear(); await prepareGeneration(root,{cacheDir});
    expect(log.mock.calls.filter(row=>String(row[0]).includes('verified cache'))).toHaveLength(2);
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
    expect(log.mock.calls.filter(row=>String(row[0]).includes('verified cache'))).toHaveLength(2);
  }
  if(mode==='retained') {
    put(root,binary,'changed-retained');await prepareGeneration(root,{cacheDir});
    expect(JSON.parse(readFileSync(resolve(root,output),'utf8'))).toEqual({binary:'changed-retained'});
  }
});
