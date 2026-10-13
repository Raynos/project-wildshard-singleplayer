// G405: rebuild absent cheap JSON from the immutable archive's own recipes.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Source guards consume data only. No working output or prior byte baseline
 * supplies this archive; all declared outputs must genuinely regenerate.
 * @param {string} root */
export async function hydrateCheapGuardData(root) {
  const catalogue=resolve(root,'scripts/generation-jobs.json');
  if (!existsSync(catalogue)) return;
  /** @type {{jobs:{buildTimeOutputs?:string[]}[]}} */
  const raw=JSON.parse(readFileSync(catalogue,'utf8'));
  if (!raw.jobs.some(job=>(job.buildTimeOutputs ?? []).some(file=>file.endsWith('.json') && !existsSync(resolve(root,file))))) return;
  const {discoverGeneration,generateShardJob}=await import('./generate.mjs');
  const jobs=discoverGeneration(root).jobs.filter(job=>(job.buildTimeOutputs ?? []).some(file=>file.endsWith('.json') && !existsSync(resolve(root,file))));
  const cache=mkdtempSync(resolve(tmpdir(),'cheap-guard-'));
  try {
    for (const job of jobs) {
      const files=(job.buildTimeOutputs ?? []).filter(file=>file.endsWith('.json'));
      const result=await generateShardJob(root,job,{cacheDir:cache,restore:true,restoreOutputs:files});
      if (result.elapsedMs >= 30_000) throw new Error(`Cheap guard producer exceeds G318: ${job.id}`);
      console.info(`cheap-guard: ${job.id}, ${files.length} derived JSON files, ${(result.elapsedMs/1000).toFixed(3)}s`);
    }
  } finally {rmSync(cache,{recursive:true,force:true});}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {await hydrateCheapGuardData(resolve(process.argv[2] ?? resolve(import.meta.dirname,'..')));}
  catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
