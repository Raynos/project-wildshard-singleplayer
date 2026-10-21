// Immutable observed read sets narrow only cache lookups. A miss always runs
// the complete declared stage before publishing a newly observed identity.
import {createHash} from 'node:crypto';
import {copyFileSync,lstatSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import * as v from 'valibot';
import {generationCacheRoot,runGenerationJob} from './generation-cache.mjs';
import {compilerCodeHash} from './compiler-code.mjs';

export const generationReadReceipt='.generation-reads.json';
const digest=(/** @type {string} */ text)=>createHash('sha256').update(text).digest('hex');
const path=v.pipe(v.string(),v.check(file=>file.length>0&&!isAbsolute(file)&&!file.includes('\\')&&file.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')));
const paths=v.pipe(v.array(path),v.maxLength(100_000));
const Trace=v.strictObject({schema:v.literal('generation-reads/2'),files:paths,execution:paths,opaque:v.array(v.string()),seal:v.string()});
const order=(/** @type {string} */ a,/** @type {string} */ b)=>a<b?-1:a>b?1:0;
const code=/\.[cm]?[jt]sx?$/u;
const cacheMiss=new Error('Observed generation cache miss');
/** Missing, malformed, failed or opaque observations grant no narrower key.
 * @param {string} file @param {string} entry */
function readTrace(file,entry) {
  try {
    const stat=lstatSync(file);
    if(!stat.isFile()||stat.size>5_000_000)return undefined;
    const trace=v.parse(Trace,JSON.parse(readFileSync(file,'utf8')));
    const body={schema:trace.schema,files:trace.files,execution:trace.execution,opaque:trace.opaque};
    const all=[...trace.files,...trace.execution];
    if(trace.opaque.length>0||all.length!==new Set(all).size||!all.includes(entry)||digest(JSON.stringify(body))!==trace.seal)return undefined;
    return trace;
  } catch {return undefined;}
}
/** Retain every non-code input, including manifests, inventories and toolchain
 * metadata. Only unread source modules may leave the byte identity.
 * @param {Record<string,string>} inputs @param {string[]} files */
function selectInputs(inputs,files) {
  const read=new Set(files);
  return Object.fromEntries(Object.entries(inputs).filter(([file])=>!code.test(file)||read.has(file)));
}
/** Existing read sets are lookup hints, never permission to execute a changed
 * producer with an old dependency list. Inventory changes also invalidate the
 * hint, covering negative probes, globs and higher-priority module candidates.
 * @param {string} root @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {import('./generation-cache.mjs').GenerationOptions} options
 * @param {string} entry
 * @returns {Promise<import('./generation-cache.mjs').GenerationResult>} */
export async function runObservedGeneration(root,job,options,entry) {
  const inventory=Object.keys(job.inputs).sort(order);
  const recipe=digest(JSON.stringify({schema:'generation-inputs/2',node:process.version,id:job.id,inventory,command:job.command,outputs:job.outputs,platform:job.platform,tools:job.tools}));
  const profiles=resolve(options.cacheDir??generationCacheRoot(),'.reads-v1',job.id,recipe);
  /** @param {v.InferOutput<typeof Trace>} trace */
  const executionInputs=trace=>Object.fromEntries(trace.execution.filter(file=>code.test(file)&&Object.hasOwn(job.inputs,file)).map(file=>[file,job.inputs[file]]));
  /** @param {v.InferOutput<typeof Trace>} trace */
  const narrowed=trace=>({...job,inputs:selectInputs(job.inputs,trace.files),tools:{...job.tools,readInventory:recipe,
    execution:JSON.stringify(Object.fromEntries(Object.entries(executionInputs(trace)).map(([file,raw])=>[file,compilerCodeHash(file,raw,()=>readFileSync(resolve(root,file)))])))}});
  /** Even a normalized execution hit must validate the current raw source
   * through the full phase memo; semantic identity never freezes old bytes.
   * @param {v.InferOutput<typeof Trace>} trace */
  const verifyExecution=trace=>{
    const inputs=executionInputs(trace);
    if(options.inputHashes!==undefined)options.inputHashes.verifyInputs(inputs);
    else for(const [file,expected]of Object.entries(inputs))if(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')!==expected)throw new Error(`Generation execution changed: ${file}`);
  };
  if(options.forceCompare!==true) {
    /** @type {string[]} */
    let names=[];
    try {names=readdirSync(profiles).filter(name=>/^[a-f0-9]{64}\.json$/u.test(name)).sort(order).slice(-12);}catch { /* No observation yet: run the full closure. */ }
    for(const name of names) {
      const trace=readTrace(resolve(profiles,name),entry);
      if(trace===undefined)continue;
      try {
        const result=await runGenerationJob(root,narrowed(trace),{...options,probe:true,generate:()=>Promise.reject(cacheMiss)});
        try {verifyExecution(trace);return result;}catch(error){result.release();throw error;}
      }
      catch(error) {if(error!==cacheMiss)throw error;}
    }
  }
  const full=await runGenerationJob(root,job,options);
  const trace=readTrace(resolve(full.directory,generationReadReceipt),entry);
  if(trace===undefined)return full;
  try {
    const result=await runGenerationJob(root,narrowed(trace),{...options,generate:directory=>{
      // The full result's read lease remains live through all alias copies.
      // runGenerationJob verifies these bytes again before atomic publication.
      for(const file of job.outputs) {
        const to=resolve(directory,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(resolve(full.directory,file),to);
      }
      return Promise.resolve();
    }});
    try {
      verifyExecution(trace);
      mkdirSync(profiles,{recursive:true});
      const text=JSON.stringify(trace),file=resolve(profiles,`${digest(text)}.json`);
      try {writeFileSync(file,text,{flag:'wx'});}catch(error) {if(!(error instanceof Error)||!('code'in error)||error.code!=='EEXIST')throw error;}
      return {...result,hit:full.hit,elapsedMs:full.elapsedMs+result.elapsedMs};
    } catch(error) {result.release();throw error;}
  } finally {full.release();}
}
