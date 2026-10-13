// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the actual source dependency graph.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only sources in the current export.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the actual clean export root.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { importsOf } from '../scripts/check-graph.mjs';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import product from '../src/shards/sunscar-dunes/generators/product';
import runtimeSource from '../src/shards/sunscar-dunes/runtime/source';

it('keeps every declared runtime value equal to the defining author product',()=>{
  expect(runtimeSource).toEqual(product);
});

it('keeps author generators outside every static and lazy Signal runtime dependency',()=>{
  const pending=['src/shards/sunscar-dunes/plugin.ts','src/shards/sunscar-dunes/look/render.ts'],seen=new Set<string>();
  while(pending.length>0){
    const file=pending.pop();if(file===undefined || seen.has(file))continue;seen.add(file);
    const source=readFileSync(resolve(file),'utf8');
    for(const edge of importsOf(file,source,path=>existsSync(resolve(path))))if(edge.to.endsWith('.ts')||edge.to.endsWith('.mjs'))pending.push(edge.to);
  }
  expect([...seen].filter(file=>/^src\/shards\/[^/]+\/generators\//u.test(file))).toEqual([]);
  expect(seen.has('src/shards/sunscar-dunes/runtime/source.ts')).toBe(true);
});

it('cold-compares the admitted declaration with its retained build pin',async()=>{
  const job=discoverGeneration(cwd()).jobs.find(row=>row.id==='signal-declaration');
  if(job===undefined)throw new Error('Missing Signal declaration job');
  const result=await generateShardJob(cwd(),job,{forceCompare:true});
  expect(result.hashes).toEqual(job.buildOutputs);
});
