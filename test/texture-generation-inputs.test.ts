// oxlint-disable-next-line import/no-nodejs-modules -- The real producer's cache stays in this owned scratch directory.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only repository source and the owned temporary cache.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The source catalogue belongs to this checkout.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

const root=cwd(),required=['src/sdk/bake/rawTexture.ts','src/sdk/bake/byteCodec.ts'];

test('isolated image texture adapters include the raw pixel packer and its codec', () => {
  let checked=0;
  for(const job of discoverGeneration(root).jobs){
    const covers=(file:string):boolean=>job.inputRoots.some(input=>file===input||file.startsWith(`${input}/`));
    if(!covers('src/sdk/bake/texture.ts'))continue;
    checked++;
    for(const file of required)expect(covers(file),`${job.id}: ${file}`).toBe(true);
  }
  expect(checked).toBeGreaterThan(0);
});

test('the retained declaration stage refuses missing pixel helpers and preserves its original rows', async () => {
  const job=discoverGeneration(root).jobs.find(row=>row.id==='signal-declaration');
  if(job===undefined)throw new Error('Missing registered declaration producer');
  const cacheDir=mkdtempSync(resolve(root,'tmp/fire-book-inputs-'));
  try {
    for(const missing of required){
      await expect(generateShardJob(root,{...job,inputRoots:job.inputRoots.filter(file=>file!==missing)},
        {cacheDir,forceCompare:true})).rejects.toThrow('Generator exited 1');
    }
    const result=await generateShardJob(root,job,{cacheDir,forceCompare:true});
    try {
      const file='src/shards/sunscar-dunes/data/product.generated.json';
      expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
      expect(result.hashes[file]).toBe('dcf9a22c356ac6a13abf921fb82a00b371cc79b8544d68dee6981c2618f8137b');
    } finally {result.release();}
  } finally {rmSync(cacheDir,{recursive:true,force:true});}
});
