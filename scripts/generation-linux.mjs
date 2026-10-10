// G292 portability experiment: observe every retained byte, without activating generation or deleting outputs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverGeneration, generateShardJob } from './generate.mjs';

/** Missing retained evidence stays null; this reader never changes an output. @param {string} root @param {string} file */
function retainedHash(root,file) {return existsSync(resolve(root,file))?createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'):null;}

/** Probe candidates through the strict runner. Refusals become explicit evidence, never matches or gate waivers.
 * @param {string} root
 * @param {{pin:string,cacheDir?:string,forceCompare?:boolean,catalogPath?:string,onUpdate?:(report:import('./generation-linux.mjs').GenerationAudit)=>void}} options
 * @returns {Promise<import('./generation-linux.mjs').GenerationAudit>} */
export async function compareGeneration(root,options) {
  const catalog=discoverGeneration(root,options.catalogPath);
  /** @type {import('./generation-linux.mjs').GenerationAudit} */
  const report={schema:'generation-portability/1',pin:options.pin,platform:process.platform,arch:process.arch,node:process.version,jobs:[],bitExactOutputs:[],differentOutputs:[],unavailableOutputs:[],undeclared:catalog.unregistered};
  for(const job of catalog.jobs) {
    /** @type {readonly import('./generate.mjs').GenerationComparison[]} */
    let observed=[];
    /** @type {import('./generation-cache.mjs').GenerationResult|null} */
    let result=null;
    let error=null;
    const retained=job.outputs.map(file=>({file,expectedHash:retainedHash(root,file)}));
    if(job.platform!=='darwin') {
      try {result=await generateShardJob(root,job,{...(options.cacheDir===undefined?{}:{cacheDir:options.cacheDir}),...(options.forceCompare===undefined?{}:{forceCompare:options.forceCompare}),...(options.catalogPath===undefined?{}:{catalogPath:options.catalogPath}),onComparison:rows=>{observed=rows;}});}
      catch(failure) {error=failure instanceof Error?failure.message:String(failure);}
    }
    const outputs=retained.map(row=>{
      const found=observed.find(item=>item.file===row.file);
      return {file:row.file,expectedHash:row.expectedHash,generatedHash:found?.generatedHash ?? null,rawExact:found?.rawExact ?? null,equivalent:found?.equivalent ?? null,comparison:found?.comparison ?? 'raw'};
    });
    const status=job.platform==='darwin'?'darwin-only':error===null && outputs.every(row=>row.equivalent===true)?'matched':observed.some(row=>row.equivalent===false)?'different':'unavailable';
    report.jobs.push({id:job.id,entry:job.entry,status,error,key:result?.key ?? null,hit:result?.hit ?? null,elapsedMs:result?.elapsedMs ?? null,outputs});
    if(job.platform!=='darwin') for(const row of outputs) {
      if(row.rawExact===true)report.bitExactOutputs.push(row.file);
      else if(row.rawExact===false)report.differentOutputs.push(row.file);
      else report.unavailableOutputs.push(row.file);
    }
    options.onUpdate?.(report);
  }
  report.bitExactOutputs.sort();report.differentOutputs.sort();report.unavailableOutputs.sort();
  return report;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.platform!=='linux')throw new Error('Linux evidence requires a real Linux host');
    const root=resolve(import.meta.dirname,'..'), output=resolve(process.argv.find(arg=>arg.startsWith('--out='))?.slice(6) ?? '.git/generation-linux.json');
    const pin=process.env.GITHUB_SHA ?? execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    mkdirSync(dirname(output),{recursive:true});
    const report=await compareGeneration(root,{pin,forceCompare:process.argv.includes('--force'),onUpdate:partial=>{writeFileSync(output,`${JSON.stringify(partial,null,2)}\n`);}});
    writeFileSync(output,`${JSON.stringify(report,null,2)}\n`);
    console.info(`generate Linux: ${String(report.bitExactOutputs.length)} exact, ${String(report.differentOutputs.length)} different, ${String(report.unavailableOutputs.length)} unavailable; report-only, no outputs changed`);
  } catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
