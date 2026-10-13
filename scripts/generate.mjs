// G292: shard-owned generator discovery and isolated jobs over the shared content-addressed cache.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';
import { bakeOutcome, isRecordedBake, bakeInputHashes } from './bake-input-hashes.mjs';
import { generationOutputHashes, runGenerationJob } from './generation-cache.mjs';
import { captureOutcome, capturePreview, generationBrowserDigest } from './generation-capture.mjs';
import { externalGenerationInputs, generationTools } from './generation-sources.mjs';
import { linkNodeModules } from './link-node-modules.mjs';
import { outputPolicy } from './generation-inventory.mjs';

const path = v.pipe(v.string(),v.check(value=>value.length>0 && !isAbsolute(value) && !value.includes('\\') && value.split('/').every(part=>part!=='' && part!=='.' && part!=='..')));
const jobIdSchema = v.pipe(v.string(),v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const Descriptor = v.strictObject({id:jobIdSchema,catalogueDependencies:v.optional(v.array(jobIdSchema)),shard:v.nullable(v.pipe(v.string(),v.regex(/^[a-z0-9_]+(?:-[a-z0-9]+)*$/u))),entry:path,command:v.array(v.string()),inputRoots:v.array(path),outputs:v.array(path),platform:v.picklist(['portable','native','darwin']),buildTimeOutputs:v.optional(v.array(path),[]),buildOutputs:v.optional(v.record(path,v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))),{}),comparisonOutputs:v.optional(v.record(path,v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))),{}),seedOutputs:v.optional(v.array(path),[]),capture:v.optional(v.boolean(),false),browser:v.optional(v.boolean(),false),preview:v.optional(v.boolean(),false),recordedInputs:v.optional(v.boolean(),false),externalInputs:v.optional(v.array(v.strictObject({path, url:v.string(),sha256:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))})),[]),toolCommands:v.optional(v.array(v.pipe(v.array(v.string()),v.minLength(1))),[])});
const Catalog = v.strictObject({schema:v.literal('generation-jobs/1'),notice:v.pipe(v.string(),v.includes('DO NOT EDIT')),jobs:v.array(Descriptor)});
const infrastructure=['src/format','scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs','scripts/generation-capture.mjs','scripts/generation-sources.mjs','scripts/generation-inventory.mjs'];
// These are loader/check/hash/write helpers, not output producers. New bake entry points default to undeclared.
const sharedHelpers=new Set(['bake-check.mjs','bake-loader.mjs','bake-input-hashes.mjs','bake-output.mjs']);

/** A shared producer is explicitly unowned, never assigned a fake shard; helpers cannot masquerade as producers.
 * @param {import('./generate.mjs').ShardGenerationJob} job */
function validateProducer(job) {
  const owned=job.shard===null
    ? /^scripts\/bake-[a-z0-9-]+\.(?:mjs|ts)$/u.test(job.entry) && !sharedHelpers.has(job.entry.slice('scripts/'.length))
    : job.entry.startsWith(`src/shards/${job.shard}/generators/`) && /\.(?:mjs|ts)$/u.test(job.entry);
  if(!owned || !job.command.includes(job.entry)) throw new Error(`Generator must be owned by ${job.shard ?? 'shared tooling'}: ${job.entry}`);
  if(job.preview && (job.capture || !job.browser || !job.command.some(arg=>arg.includes('<preview-url>')))) throw new Error(`Preview command must name its fenced URL: ${job.id}`);
  if(!job.preview && job.command.some(arg=>arg.includes('<preview-url>'))) throw new Error(`Undeclared preview command: ${job.id}`);
  const comparisons=Object.keys(job.comparisonOutputs ?? {});
  if(comparisons.some(file=>!job.outputs.includes(file)) || comparisons.some(file=>Object.hasOwn(job.buildOutputs ?? {},file))) throw new Error(`Invalid comparison-only outputs: ${job.id}`);
  if (job.buildTimeOutputs.length > 0 && (job.seedOutputs.length > 0 || job.capture || job.browser || job.recordedInputs || job.platform === 'darwin' || job.buildTimeOutputs.some(file => !job.outputs.includes(file)) || Object.keys(job.buildOutputs).length > 0 || Object.keys(job.comparisonOutputs).length > 0)) throw new Error(`Invalid cheap build outputs: ${job.id}`);
  const buildOutputs=Object.keys(job.buildOutputs ?? {});
  if(buildOutputs.some(file=>!job.outputs.includes(file) || job.seedOutputs?.includes(file)) ||
    (buildOutputs.length>0 && (job.platform==='darwin' || job.capture || job.browser || job.recordedInputs))) throw new Error(`Invalid build-time outputs: ${job.id}`);
}

/** Recursively collect regular inputs; links cannot escape the declared source tree. @param {string} root @param {string[]} roots */
export function generationInputs(root,roots) {
  const base=realpathSync(root), files=new Set();
  /** @param {string} relative */
  function walk(relative) {
    v.parse(path,relative);
    const file=resolve(base,relative),stat=lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Generation input is a symlink: ${relative}`);
    if (!realpathSync(file).startsWith(base+sep)) throw new Error(`Generation input escaped: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(file).sort((a,b)=>a<b?-1:a>b?1:0)) if(entry!=='node_modules' && entry!=='.git') walk(`${relative}/${entry}`);
    } else if (stat.isFile()) files.add(relative);
    else throw new Error(`Generation input is not regular: ${relative}`);
  }
  for(const relative of roots) walk(relative);
  return bakeInputHashes(base,[...files].sort((a,b)=>a<b?-1:a>b?1:0));
}

/** Discover shard-owned bake entry points and validate declared jobs; gaps stay report-only. @param {string} root @param {string} [catalogPath] */
export function discoverGeneration(root,catalogPath='scripts/generation-jobs.json') {
  v.parse(path,catalogPath);
  const catalog=v.parse(Catalog,JSON.parse(readFileSync(resolve(root,catalogPath),'utf8')));
  const ids=new Set(),outputs=new Set();
  for (const job of catalog.jobs) {
    if(ids.has(job.id)) throw new Error(`Duplicate generation id ${job.id}`);ids.add(job.id);
    validateProducer(job);
    if(job.recordedInputs && (job.capture || job.outputs.some(file=>!isRecordedBake(file)))) throw new Error(`Recorded-input comparison is not registered: ${job.id}`);
    if(new Set(job.externalInputs.map(row=>row.path)).size!==job.externalInputs.length || job.externalInputs.some(row=>job.outputs.includes(row.path))) throw new Error(`Invalid external inputs ${job.id}`);
    if(job.seedOutputs.some(file=>!job.outputs.includes(file))) throw new Error(`Undeclared output seed ${job.id}`);
    if(!existsSync(resolve(root,job.entry)) || job.outputs.length===0 || job.inputRoots.length===0) throw new Error(`Incomplete generation job ${job.id}`);
    for(const file of job.outputs) {if(outputs.has(file)) throw new Error(`Duplicate generated output ${file}`);outputs.add(file);}
  }
  const entries=[];
  const shards=resolve(root,'src/shards');
  for(const shard of readdirSync(shards,{withFileTypes:true})) {
    if(!shard.isDirectory()) continue;
    const dir=resolve(shards,shard.name,'generators');
    if(!existsSync(dir)) continue;
    for(const file of readdirSync(dir).sort()) if(/^bake-.*\.(?:mjs|ts)$/u.test(file)) entries.push(`src/shards/${shard.name}/generators/${file}`);
  }
  for(const file of readdirSync(resolve(root,'scripts')).sort()) if(/^bake-.*\.(?:mjs|ts)$/u.test(file) && !sharedHelpers.has(file)) entries.push(`scripts/${file}`);
  return {schema:'generation-discovery/1',jobs:catalog.jobs,unregistered:entries.filter(entry=>!catalog.jobs.some(job=>job.entry===entry)).sort()};
}

/** An opted-in producer sees only its own row and declared catalogue dependencies.
 * Omission preserves the complete catalogue. Missing/duplicate IDs or crossed
 * caller descriptors refuse; projected bytes are part of the cache identity.
 * @param {string} root @param {import('./generate.mjs').ShardGenerationJob} job @param {string} catalog */
function catalogueProjection(root, job, catalog) {
  if (job.catalogueDependencies === undefined) return undefined;
  /** @type {{schema:string,notice:string,jobs:ShardGenerationJob[]}} */
  const source=JSON.parse(readFileSync(resolve(root,catalog),'utf8'));
  const parsed=v.parse(Catalog,source), wanted=[job.id,...job.catalogueDependencies];
  if(new Set(wanted).size!==wanted.length)throw new Error(`Duplicate catalogue dependency: ${job.id}`);
  const own=parsed.jobs.find(row=>row.id===job.id);
  if(own===undefined || JSON.stringify(own)!==JSON.stringify(job))throw new Error(`Crossed catalogue descriptor: ${job.id}`);
  for(const name of wanted)if(parsed.jobs.filter(row=>row.id===name).length!==1)throw new Error(`Missing or duplicate catalogue dependency: ${name}`);
  return JSON.stringify({...source,jobs:source.jobs.filter(row=>wanted.includes(row.id))});
}

/** Run a Node producer without a shell, in its own copied source tree. @param {string} cwd @param {string[]} command */
function nodeProducer(cwd,command) {
  return new Promise((_resolve,reject)=>{
    const child=spawn(process.execPath,command,{cwd,stdio:['ignore','inherit','inherit']});
    child.on('error',reject);child.on('exit',code=>code===0?_resolve(undefined):reject(new Error(`Generator exited ${String(code)}`)));
  });
}

/** G318 disposition of verified outputs, using only this job's actual cold producer time, never cache/lease wait.
 * The shared producer duration covers all its outputs; unknown warm duration grants no committed exception.
 * Header and regenerate-and-compare requirements remain separate from size/time eligibility.
 * @param {string} directory @param {string[]} outputs @param {number|null} coldSeconds */
export function generationRetention(directory, outputs, coldSeconds) {
  return outputs.map(file => ({file,bytes:statSync(resolve(directory,file)).size,coldSeconds,
    policy:outputPolicy({bytes:statSync(resolve(directory,file)).size,seconds:coldSeconds,darwinOnly:null,blender:false,frozen:false})}));
}

/** Stage the declared source closure, generate there and publish verified outputs only; never mutate a source bake.
 * @param {string} root @param {import('./generate.mjs').ShardGenerationJob} descriptor
 * @param {{cacheDir?:string,forceCompare?:boolean,restore?:boolean,restoreOutputs?:string[],catalogPath?:string,preview?:{url:string,revision:string},onComparison?:(rows:readonly import('./generate.mjs').GenerationComparison[])=>void}} [options] */
export async function generateShardJob(root,descriptor,options={}) {
  const job=v.parse(Descriptor,descriptor), catalog=options.catalogPath ?? 'scripts/generation-jobs.json';
  validateProducer(job);
  if(options.restore===true && Object.keys(job.comparisonOutputs).length>0) throw new Error(`Comparison-only job cannot restore outputs: ${job.id}`);
  const restoreOutputs=options.restoreOutputs ?? job.outputs;
  if(restoreOutputs.some(file=>!job.outputs.includes(file))) throw new Error(`Undeclared restore output: ${job.id}`);
  if(job.recordedInputs && (job.capture || job.outputs.some(file=>!isRecordedBake(file)))) throw new Error(`Recorded-input comparison is not registered: ${job.id}`);
  const preview=job.capture || job.preview ? await capturePreview(options.preview ?? {url:'',revision:''}) : undefined;
  const command=job.command.map(arg=>arg.replaceAll('<preview-url>',preview?.url ?? ''));
  const captureArgs=job.capture && preview!==undefined ? [`--url=${preview.url}`,`--revision=${preview.revision}`,'--inputs=<stage>'] : [];
  const projected=catalogueProjection(root,job,catalog);
  const controller=bakeInputHashes(import.meta.dirname,['generate.mjs','generation-capture.mjs','generation-sources.mjs']);
  const external=await externalGenerationInputs(job.externalInputs,options.cacheDir);
  const tools={...generationTools(job.toolCommands),...(job.browser?{browserDigest:generationBrowserDigest()}:{})};
  const collected=generationInputs(root,[...job.inputRoots,...infrastructure.filter(file=>existsSync(resolve(root,file))),catalog]);
  // Produced bytes are not source inputs. Explicit schema seeds remain inputs until their imports are separated.
  const inputs=Object.fromEntries(Object.entries(collected).filter(([file])=>(projected===undefined || file!==catalog) && (!job.outputs.includes(file) || job.seedOutputs.includes(file))));
  /** @type {number|null} */
  let coldSeconds=null;
  const result=await runGenerationJob(root,{id:job.id,inputs,command:['node',...command,...captureArgs],outputs:job.outputs,platform:job.platform,tools:{...controller,...tools,descriptor:JSON.stringify(job),...(projected===undefined?{}:{catalogue:projected}),...(preview===undefined?{}:{previewBuild:preview.build,browserDigest:preview.browserDigest})}},{
    ...(options.cacheDir===undefined?{}:{cacheDir:options.cacheDir}),...(options.forceCompare===undefined?{}:{forceCompare:options.forceCompare}),
    generate:async directory=>{
      const coldStarted=performance.now();
      const tree=realpathSync(mkdtempSync(resolve(tmpdir(),'wildshard-generation-')));
      try {
        for(const file of Object.keys(inputs)) {const to=resolve(tree,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(resolve(root,file),to);}
        // Re-check after copying so concurrent edits cannot publish bytes under an earlier key.
        const copied=bakeInputHashes(tree,Object.keys(inputs));
        if(JSON.stringify(copied)!==JSON.stringify(inputs)) throw new Error('Generation inputs changed while copying');
        if(projected!==undefined){mkdirSync(dirname(resolve(tree,catalog)),{recursive:true});writeFileSync(resolve(tree,catalog),projected);}
        // Some schemas import their committed stamps. Those seed inputs may exist, but a producer must still write
        // every output; otherwise a no-op could falsely pass regenerate-and-compare against the copied seed.
        for(const file of job.outputs) mkdirSync(dirname(resolve(tree,file)),{recursive:true});
        for(const file of job.outputs) if(!job.seedOutputs.includes(file)) rmSync(resolve(tree,file),{force:true});
        const seeded=job.seedOutputs.filter(file=>existsSync(resolve(tree,file)));
        for(const file of seeded) utimesSync(resolve(tree,file),1,1);
        for(const source of external) {const to=resolve(tree,source.path);mkdirSync(dirname(to),{recursive:true});copyFileSync(source.file,to);}
        linkNodeModules(realpathSync(root),tree);
        await nodeProducer(tree,[...command,...captureArgs.map(arg=>arg==='--inputs=<stage>'?`--inputs=${tree}`:arg)]);
        if(preview!==undefined && (await capturePreview({url:preview.url,revision:preview.revision})).build!==preview.build) throw new Error('Capture preview changed during generation');
        const untouched=seeded.filter(file=>existsSync(resolve(tree,file)) && statSync(resolve(tree,file)).mtimeMs===1000);
        if(untouched.length>0) throw new Error(`Generator did not write declared outputs: ${untouched.join(', ')}`);
        if(projected!==catalogueProjection(root,job,catalog))throw new Error(`Catalogue changed during generation: ${job.id}`);
        generationOutputHashes(tree,job.outputs);
        for(const file of job.outputs) {const to=resolve(directory,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(resolve(tree,file),to);}
        coldSeconds=(performance.now()-coldStarted)/1000;
      } finally {rmSync(tree,{recursive:true,force:true});}
    }
  });
  if(projected!==catalogueProjection(root,job,catalog))throw new Error(`Catalogue changed during generation: ${job.id}`);
  for(const [file,expectedHash] of Object.entries(job.buildOutputs)) if(result.hashes[file]!==expectedHash) throw new Error(`Build output hash differs: ${file}. No source output was overwritten.`);
  for(const [file,expectedHash] of Object.entries(job.comparisonOutputs)) if(result.hashes[file]!==expectedHash) throw new Error(`Comparison output hash differs: ${file}. No source output was overwritten.`);
  const present=job.outputs.filter(file=>existsSync(resolve(root,file)));
  const expected=generationOutputHashes(root,present);
  const different=present.filter(file=>job.capture ? captureOutcome(readFileSync(resolve(root,file),'utf8'))!==captureOutcome(readFileSync(resolve(result.directory,file),'utf8')) : job.recordedInputs ? bakeOutcome(readFileSync(resolve(root,file),'utf8'))!==bakeOutcome(readFileSync(resolve(result.directory,file),'utf8')) : expected[file]!==result.hashes[file]);
  const expectedHashes=new Map(Object.entries(expected)),generatedHashes=new Map(Object.entries(result.hashes));
  // Diagnostic observation cannot grant admission: the refusal list is already fixed before the callback runs.
  options.onComparison?.(job.outputs.map(file=>{
    const expectedHash=present.includes(file)?expectedHashes.get(file):null,generatedHash=generatedHashes.get(file);
    if(expectedHash===undefined || generatedHash===undefined) throw new Error(`Missing verified output hash: ${file}`);
    return {file,expectedHash,generatedHash,rawExact:expectedHash===null?null:expectedHash===generatedHash,equivalent:expectedHash===null?null:!different.includes(file),comparison:job.capture?'capture-provenance':job.recordedInputs?'recorded-inputs':'raw'};
  }));
  if(job.buildTimeOutputs.length === 0 && different.length>0) throw new Error(`Committed generated output differs: ${different.join(', ')}. No source output was overwritten.`);
  if(options.restore===true) for(const file of restoreOutputs) if(job.buildTimeOutputs.includes(file) || !existsSync(resolve(root,file))) {mkdirSync(dirname(resolve(root,file)),{recursive:true});copyFileSync(resolve(result.directory,file),resolve(root,file));}
  return {...result,retention:generationRetention(result.directory,job.outputs,coldSeconds)};
}

/** Build-time report phase: declarations are validated and unregistered producers are explicit; outputs stay committed.
 * @param {string} root */
export function reportGeneration(root) {
  const discovered=discoverGeneration(root);
  const missing=discovered.jobs.flatMap(job=>job.outputs.filter(file=>!existsSync(resolve(root,file))));
  console.info(`generate: report-only, ${String(discovered.jobs.length)} registered jobs, ${String(discovered.unregistered.length)} undeclared bake entry points, ${String(missing.length)} missing outputs; committed outputs retained`);
  return {...discovered,missing};
}

/** Generate the explicitly admitted build outputs before boot tables, packing or rendering reads them.
 * Complete jobs and pinned output hashes are checked even on a warm hit; undeclared outputs remain report-only.
 * @param {string} root @param {{cacheDir?:string, concurrency?:number}} [options] */
export async function prepareGeneration(root,options={}) {
  const concurrency=options.concurrency ?? 1;
  if(!Number.isSafeInteger(concurrency) || concurrency<1 || concurrency>4) throw new Error('Generation concurrency must be 1..4');
  const report=reportGeneration(root), jobs=report.jobs.filter(job=>Object.keys(job.buildOutputs).length>0 || job.buildTimeOutputs.length>0), completed=new Set();
  // Preserve catalogue order for every declared read/write conflict, including broad directory inputs.
  // Producers use private exports; only verified declared outputs are published into the shared staged export.
  /** @param {import('./generate.mjs').ShardGenerationJob} job @param {string} file */
  const reads=(job,file)=>job.inputRoots.some(input=>file===input || file.startsWith(`${input}/`));
  /** @param {import('./generate.mjs').ShardGenerationJob} a @param {import('./generate.mjs').ShardGenerationJob} b */
  const conflicts=(a,b)=>a.outputs.some(file=>reads(b,file)) || b.outputs.some(file=>reads(a,file));
  const running=new Map();
  while(completed.size<jobs.length) {
    for(const [index,job] of jobs.entries()) {
      if(running.size>=concurrency) break;
      if(completed.has(index) || running.has(index) || jobs.slice(0,index).some((prior,position)=>!completed.has(position) && conflicts(prior,job))) continue;
      const work=async()=>{
        try {
        const started=performance.now(), outputs=[...Object.keys(job.buildOutputs), ...job.buildTimeOutputs];
        const result=await generateShardJob(root,job,{...options,restore:true,restoreOutputs:outputs});
        console.info(`generate: ${job.id}, ${result.hit?'verified cache':'generated'}, ${String(outputs.length)} admitted build outputs, ${((performance.now()-started)/1000).toFixed(3)}s`);
        return {index};
        } catch(error) { return {index,error}; }
      };
      running.set(index,work());
    }
    if(running.size===0) throw new Error('Generation dependency scheduling stalled');
    const finished=await Promise.race(running.values());
    running.delete(finished.index);
    if('error' in finished) {
      await Promise.allSettled(running.values()); // no child can outlive a failed staged export
      throw finished.error;
    }
    completed.add(finished.index);
  }
  return report;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(process.argv.find(arg=>arg.startsWith('--root='))?.slice(7) ?? resolve(import.meta.dirname,'..')), id=process.argv.find(arg=>arg.startsWith('--job='))?.slice(6);
  try {
    if(id===undefined) {const report=await prepareGeneration(root);if(process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));}
    else {
      const job=discoverGeneration(root).jobs.find(row=>row.id===id);
      if(job===undefined) throw new Error(`Unknown generation job ${id}`);
      if(job.platform==='darwin' && process.platform!=='darwin') console.info(`generate: ${id} retained; Darwin bit-exact comparison unavailable on ${process.platform}`);
      else console.log(JSON.stringify(await generateShardJob(root,job,{forceCompare:process.argv.includes('--compare'),restore:process.argv.includes('--restore'),...(job.capture || job.preview?{preview:{url:process.argv.find(arg=>arg.startsWith('--url='))?.slice(6) ?? '',revision:process.argv.find(arg=>arg.startsWith('--revision='))?.slice(11) ?? ''}}:{})})));
    }
  } catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
