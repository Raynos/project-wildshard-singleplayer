// oxlint-disable-next-line import/no-nodejs-modules -- Owned source and cache fixtures.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths only.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareGeneration } from '../scripts/generate.mjs';

const owned: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
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
