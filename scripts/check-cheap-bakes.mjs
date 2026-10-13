// G405: cold producer success and complete declared outputs, no historical byte baseline.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { discoverGeneration, generateShardJob } from './generate.mjs';

const root=resolve(import.meta.dirname,'..'), cache=mkdtempSync(resolve(tmpdir(),'cheap-bake-check-'));
try {
  for(const job of discoverGeneration(root).jobs.filter(row=>(row.buildTimeOutputs ?? []).length>0)) {
    const result=await generateShardJob(root,job,{cacheDir:cache});
    console.log(`cheap-bake-check: ${job.id}, ${Object.keys(result.hashes).length} outputs, ${(result.elapsedMs/1000).toFixed(3)}s`);
  }
} finally { rmSync(cache,{recursive:true,force:true}); }
