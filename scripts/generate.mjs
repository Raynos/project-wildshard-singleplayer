// G292: shard-owned generator discovery and isolated jobs over the shared content-addressed cache.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';
import { bakeOutcome, isRecordedBake, bakeInputHashes } from './bake-input-hashes.mjs';
import { generationOutputHashes, runGenerationJob } from './generation-cache.mjs';
import { captureOutcome, capturePreview } from './generation-capture.mjs';
import { externalGenerationInputs, generationTools } from './generation-sources.mjs';
import { linkNodeModules } from './link-node-modules.mjs';

const path = v.pipe(v.string(),v.check(value=>value.length>0 && !isAbsolute(value) && !value.includes('\\') && value.split('/').every(part=>part!=='' && part!=='.' && part!=='..')));
const Descriptor = v.strictObject({id:v.pipe(v.string(),v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)),shard:v.pipe(v.string(),v.regex(/^[a-z0-9_]+(?:-[a-z0-9]+)*$/u)),entry:path,command:v.array(v.string()),inputRoots:v.array(path),outputs:v.array(path),platform:v.picklist(['portable','native','darwin']),seedOutputs:v.optional(v.array(path),[]),capture:v.optional(v.boolean(),false),recordedInputs:v.optional(v.boolean(),false),externalInputs:v.optional(v.array(v.strictObject({path, url:v.string(),sha256:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))})),[]),toolCommands:v.optional(v.array(v.pipe(v.array(v.string()),v.minLength(1))),[])});
const Catalog = v.strictObject({schema:v.literal('generation-jobs/1'),notice:v.pipe(v.string(),v.includes('DO NOT EDIT')),jobs:v.array(Descriptor)});
const infrastructure=['scripts/generate.mjs','scripts/generation-cache.mjs','scripts/bake-input-hashes.mjs','scripts/link-node-modules.mjs','scripts/generation-capture.mjs','scripts/generation-sources.mjs'];

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
    if(!job.entry.startsWith(`src/shards/${job.shard}/generators/`) || !/\.(?:mjs|ts)$/u.test(job.entry) || !job.command.includes(job.entry)) throw new Error(`Generator must be owned by ${job.shard}: ${job.entry}`);
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
  return {schema:'generation-discovery/1',jobs:catalog.jobs,unregistered:entries.filter(entry=>!catalog.jobs.some(job=>job.entry===entry)).sort()};
}

/** Run a Node producer without a shell, in its own copied source tree. @param {string} cwd @param {string[]} command */
function nodeProducer(cwd,command) {
  return new Promise((_resolve,reject)=>{
    const child=spawn(process.execPath,command,{cwd,stdio:['ignore','inherit','inherit']});
    child.on('error',reject);child.on('exit',code=>code===0?_resolve(undefined):reject(new Error(`Generator exited ${String(code)}`)));
  });
}

/** Stage the declared source closure, generate there and publish verified outputs only; never mutate a source bake.
 * @param {string} root @param {import('./generate.mjs').ShardGenerationJob} descriptor
 * @param {{cacheDir?:string,forceCompare?:boolean,restore?:boolean,catalogPath?:string,preview?:{url:string,revision:string}}} [options] */
export async function generateShardJob(root,descriptor,options={}) {
  const job=v.parse(Descriptor,descriptor), catalog=options.catalogPath ?? 'scripts/generation-jobs.json';
  if(job.recordedInputs && (job.capture || job.outputs.some(file=>!isRecordedBake(file)))) throw new Error(`Recorded-input comparison is not registered: ${job.id}`);
  const preview=job.capture ? await capturePreview(options.preview ?? {url:'',revision:''}) : undefined;
  const controller=bakeInputHashes(import.meta.dirname,['generate.mjs','generation-capture.mjs','generation-sources.mjs']);
  const external=await externalGenerationInputs(job.externalInputs,options.cacheDir);
  const tools=generationTools(job.toolCommands);
  const inputs=generationInputs(root,[...job.inputRoots,...infrastructure.filter(file=>existsSync(resolve(root,file))),catalog]);
  const result=await runGenerationJob(root,{id:job.id,inputs,command:['node',...job.command,...(preview===undefined?[]:[`--url=${preview.url}`,`--revision=${preview.revision}`,'--inputs=<stage>'])],outputs:job.outputs,platform:job.platform,tools:{...controller,...tools,descriptor:JSON.stringify(job),...(preview===undefined?{}:{previewBuild:preview.build,browserDigest:preview.browserDigest})}},{
    ...(options.cacheDir===undefined?{}:{cacheDir:options.cacheDir}),...(options.forceCompare===undefined?{}:{forceCompare:options.forceCompare}),
    generate:async directory=>{
      const tree=realpathSync(mkdtempSync(resolve(tmpdir(),'wildshard-generation-')));
      try {
        for(const file of Object.keys(inputs)) {const to=resolve(tree,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(resolve(root,file),to);}
        // Re-check after copying so concurrent edits cannot publish bytes under an earlier key.
        const copied=bakeInputHashes(tree,Object.keys(inputs));
        if(JSON.stringify(copied)!==JSON.stringify(inputs)) throw new Error('Generation inputs changed while copying');
        // Some schemas import their committed stamps. Those seed inputs may exist, but a producer must still write
        // every output; otherwise a no-op could falsely pass regenerate-and-compare against the copied seed.
        for(const file of job.outputs) mkdirSync(dirname(resolve(tree,file)),{recursive:true});
        for(const file of job.outputs) if(!job.seedOutputs.includes(file)) rmSync(resolve(tree,file),{force:true});
        const seeded=job.seedOutputs.filter(file=>existsSync(resolve(tree,file)));
        for(const file of seeded) utimesSync(resolve(tree,file),1,1);
        for(const source of external) {const to=resolve(tree,source.path);mkdirSync(dirname(to),{recursive:true});copyFileSync(source.file,to);}
        linkNodeModules(realpathSync(root),tree);
        await nodeProducer(tree,[...job.command,...(preview===undefined?[]:[`--url=${preview.url}`,`--revision=${preview.revision}`,`--inputs=${tree}`])]);
        if(preview!==undefined && (await capturePreview({url:preview.url,revision:preview.revision})).build!==preview.build) throw new Error('Capture preview changed during generation');
        const untouched=seeded.filter(file=>existsSync(resolve(tree,file)) && statSync(resolve(tree,file)).mtimeMs===1000);
        if(untouched.length>0) throw new Error(`Generator did not write declared outputs: ${untouched.join(', ')}`);
        generationOutputHashes(tree,job.outputs);
        for(const file of job.outputs) {const to=resolve(directory,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(resolve(tree,file),to);}
      } finally {rmSync(tree,{recursive:true,force:true});}
    }
  });
  const present=job.outputs.filter(file=>existsSync(resolve(root,file)));
  const expected=generationOutputHashes(root,present);
  const different=present.filter(file=>job.capture ? captureOutcome(readFileSync(resolve(root,file),'utf8'))!==captureOutcome(readFileSync(resolve(result.directory,file),'utf8')) : job.recordedInputs ? bakeOutcome(readFileSync(resolve(root,file),'utf8'))!==bakeOutcome(readFileSync(resolve(result.directory,file),'utf8')) : expected[file]!==result.hashes[file]);
  if(different.length>0) throw new Error(`Committed generated output differs: ${different.join(', ')}. No source output was overwritten.`);
  if(options.restore===true) for(const file of job.outputs) if(!existsSync(resolve(root,file))) {mkdirSync(dirname(resolve(root,file)),{recursive:true});copyFileSync(resolve(result.directory,file),resolve(root,file));}
  return result;
}

/** Build-time report phase: declarations are validated and unregistered producers are explicit; outputs stay committed.
 * @param {string} root */
export function reportGeneration(root) {
  const discovered=discoverGeneration(root);
  const missing=discovered.jobs.flatMap(job=>job.outputs.filter(file=>!existsSync(resolve(root,file))));
  console.info(`generate: report-only, ${String(discovered.jobs.length)} registered jobs, ${String(discovered.unregistered.length)} undeclared bake entry points, ${String(missing.length)} missing outputs; committed outputs retained`);
  return {...discovered,missing};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(process.argv.find(arg=>arg.startsWith('--root='))?.slice(7) ?? resolve(import.meta.dirname,'..')), id=process.argv.find(arg=>arg.startsWith('--job='))?.slice(6);
  try {
    if(id===undefined) {const report=reportGeneration(root);if(process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));}
    else {
      const job=discoverGeneration(root).jobs.find(row=>row.id===id);
      if(job===undefined) throw new Error(`Unknown generation job ${id}`);
      if(job.platform==='darwin' && process.platform!=='darwin') console.info(`generate: ${id} retained; Darwin bit-exact comparison unavailable on ${process.platform}`);
      else console.log(JSON.stringify(await generateShardJob(root,job,{forceCompare:process.argv.includes('--compare'),restore:process.argv.includes('--restore'),...(job.capture?{preview:{url:process.argv.find(arg=>arg.startsWith('--url='))?.slice(6) ?? '',revision:process.argv.find(arg=>arg.startsWith('--revision='))?.slice(11) ?? ''}}:{})})));
    }
  } catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
