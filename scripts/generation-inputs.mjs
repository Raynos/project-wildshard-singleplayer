// Immutable observed read sets narrow only cache lookups. A miss always runs
// the complete declared stage before publishing a newly observed identity.
import {createHash} from 'node:crypto';
import {copyFileSync,lstatSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import * as v from 'valibot';
import {generationCacheRoot,runGenerationJob} from './generation-cache.mjs';
import {compilerCodeHash} from './compiler-code.mjs';

export const generationReadReceipt='.generation-reads.json';
const digest=(/** @type {string|Uint8Array} */ text)=>createHash('sha256').update(text).digest('hex');
const path=v.pipe(v.string(),v.check(file=>file.length>0&&!isAbsolute(file)&&!file.includes('\\')&&file.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')));
const paths=v.pipe(v.array(path),v.maxLength(100_000));
const hashes=v.record(path,v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u)));
const Trace=v.strictObject({schema:v.literal('generation-reads/4'),files:paths,execution:paths,packages:v.record(path,v.array(v.string())),inventory:v.array(v.string()),opaque:v.array(v.string()),seal:v.string()});
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
    const body={schema:trace.schema,files:trace.files,execution:trace.execution,packages:trace.packages,inventory:trace.inventory,opaque:trace.opaque};
    const all=[...trace.files,...trace.execution];
    if(Object.values(trace.packages).some(keys=>keys.length!==new Set(keys).size))return undefined;
    if(trace.opaque.length>0||all.length!==new Set(all).size||!all.includes(entry)||digest(JSON.stringify(body))!==trace.seal)return undefined;
    return trace;
  } catch {return undefined;}
}
/** Resolution manifests and build/tool policy remain exact. Content files in
 * authored source/public roots bind bytes only when actually consumed by a
 * complete observed producer; their presence stays in the probe model.
 * A catalogue never read by this producer may also leave the byte identity.
 * @param {Record<string,string>} inputs @param {string[]} files @param {string} catalogue */
function selectInputs(inputs,files,catalogue) {
  const read=new Set(files);
  const selected=Object.fromEntries(Object.entries(inputs).filter(([file])=>read.has(file)||(!code.test(file)&&file!==catalogue&&
    ((!file.startsWith('src/')&&!file.startsWith('public/'))||file.endsWith('/package.json')))));
  // Keep the backend's nonempty-source contract for tiny standalone producers.
  return Object.keys(selected).length===0?inputs:selected;
}
/** Retain every field except unused exact exports. Wildcard rows remain exact
 * because they can affect a previously missing subpath. Explicit JSON reads
 * never use this projection, nor do unsupported/conditional-root exports.
 * @param {string} root @param {string} file @param {string} expected @param {string[]} keys */
function packageProjection(root,file,expected,keys) {
  const bytes=readFileSync(resolve(root,file));
  if(digest(bytes)!==expected)throw new Error(`Generation package changed: ${file}`);
  const json=v.parse(v.record(v.string(),v.unknown()),JSON.parse(bytes.toString('utf8')));
  const exports=v.safeParse(v.record(v.string(),v.unknown()),json.exports);
  if(!exports.success||Object.keys(exports.output).some(key=>key!=='.'&&!key.startsWith('./')))return undefined;
  const used=new Set(keys);
  return JSON.stringify({...json,exports:Object.fromEntries(Object.entries(exports.output).filter(([key])=>used.has(key)||key.includes('*')))});
}
/** The virtual initial stage contains verified copied files, external inputs,
 * projected catalogue bytes and declared output-parent directories. It never
 * consults loose/missing outputs in the caller's working tree.
 * @param {readonly string[]} staged @param {string[]} outputs */
function stageProbeView(staged,outputs) {
  const files=new Set(v.parse(paths,staged));
  /** @type {Set<string>} */
  const directories=new Set();
  for(const file of [...files,...outputs])for(let parent=dirname(file);parent!=='.';parent=dirname(parent))directories.add(parent);
  const roots=new Set([...directories].filter(file=>!file.includes('/')));
  const entries=[...files,...directories].sort(order);
  // link-node-modules may add dependencies below each immediate src package.
  // A scan that could include those links keeps the conservative fence.
  const linked=[...directories].filter(file=>/^src\/[^/]+$/u.test(file)).map(file=>`${file}/node_modules`);
  /** @param {string} kind @param {string} file */
  return (kind,file)=>{
    if(!['P','D','F'].includes(kind)||!v.safeParse(path,file).success||file.split('/').some(part=>['node_modules','.git','.cache','.wildshard','tmp','out'].includes(part)))return undefined;
    if(!files.has(file)&&!roots.has(file.split('/').at(0)??''))return undefined;
    const directory=directories.has(file),scan=kind==='D'||kind==='F'&&directory;
    if(scan&&linked.some(folder=>folder.startsWith(`${file}/`)))return undefined;
    /** @type {[string,string][]} */
    const chain=[];
    const parts=file.split('/');
    for(let count=1;count<=parts.length;count++) {
      const prefix=parts.slice(0,count).join('/');
      chain.push([prefix,files.has(prefix)?'file':directories.has(prefix)?'directory':'absent']);
    }
    // Include descendants for both ordinary and recursive directory readers;
    // the latter bypass repeated calls to the public filesystem wrappers.
    return JSON.stringify({chain,...(scan?{entries:entries.filter(name=>name.startsWith(`${file}/`))}:{})});
  };
}
/** @param {v.InferOutput<typeof Trace>} trace @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {readonly string[]|undefined} staged @param {string[]} inventory */
function probeIdentity(trace,job,staged,inventory) {
  const view=staged===undefined?undefined:stageProbeView(staged,job.outputs);
  const positive=new Set([...trace.files,...trace.execution].filter(file=>Object.hasOwn(job.inputs,file)));
  const probes=new Set([...trace.inventory,...trace.files.filter(file=>!Object.hasOwn(job.inputs,file)).map(file=>`F ${file}`)]);
  /** @type {Record<string,string>} */
  const values={};let fallback=false;
  for(const probe of [...probes].sort(order)) {
    const kind=probe.slice(0,1),file=probe.slice(2);
    if(kind==='P'&&positive.has(file))continue;
    const value=view?.(kind,file);
    if(value===undefined){fallback=true;values[probe]='conservative';}
    else values[probe]=value;
  }
  return {identity:digest(JSON.stringify({values,...(fallback?{inventory,staged:staged===undefined?[]:[...new Set(staged)].sort(order)}:{})})),conservative:fallback};
}
/** Verified immutable upstream files are stage inputs, not observation recipe
 * identities. Invalid metadata stays opaque and retains its complete tool key.
 * @param {import('./generation-cache.mjs').GenerationJob} job */
function upstreamHashes(job) {
  const text=job.tools?.upstream;
  if(text===undefined)return undefined;
  try {return v.parse(hashes,JSON.parse(text));}catch{return undefined;}
}
/** Existing read sets are lookup hints, never permission to execute a changed
 * producer with an old dependency list. Recipes locate observations independently
 * of file additions. Probes bind the exact initial stage path or subtree;
 * unmodeled probes retain the complete conservative inventory fence.
 * @param {string} root @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {import('./generation-cache.mjs').GenerationOptions} options
 * @param {string} entry @param {string} [catalogue] @param {readonly string[]} [staged]
 * @returns {Promise<import('./generation-cache.mjs').GenerationResult>} */
export async function runObservedGeneration(root,job,options,entry,catalogue,staged) {
  const catalog=catalogue??'scripts/generation-jobs.json';
  const inventory=Object.keys(job.inputs).sort(order);
  const upstream=upstreamHashes(job),recipeTools=upstream===undefined?job.tools:{...job.tools,upstream:'observed-upstream/1'};
  const recipe=digest(JSON.stringify({schema:'generation-inputs/7',node:process.version,id:job.id,command:job.command,outputs:job.outputs,platform:job.platform,tools:recipeTools}));
  const profiles=resolve(options.cacheDir??generationCacheRoot(),'.reads-v1',job.id,recipe);
  /** @param {v.InferOutput<typeof Trace>} trace */
  const executionInputs=trace=>Object.fromEntries(trace.execution.filter(file=>code.test(file)&&Object.hasOwn(job.inputs,file)).map(file=>[file,job.inputs[file]]));
  /** @param {v.InferOutput<typeof Trace>} trace */
  const narrowed=trace=>{
    const inputs={...selectInputs(job.inputs,trace.files,catalog)},rawReads=new Set(trace.files);
    /** @type {Record<string,string>} */
    const packages={};
    for(const [file,keys]of Object.entries(trace.packages)) {
      const expected=inputs[file];
      if(rawReads.has(file)||expected===undefined)continue;
      const projected=packageProjection(root,file,expected,keys);
      if(projected!==undefined){packages[file]=projected;delete inputs[file];}
    }
    // The backend retains its nonempty-source contract even for tiny fixtures.
    const retained=Object.keys(inputs).length===0?job.inputs:inputs;
    const probes=probeIdentity(trace,job,staged,inventory),used=new Set([...trace.files,...trace.execution]);
    // Unknown probes keep ALL upstream hashes. Otherwise the same immutable
    // stage supplies exact bytes for every observed file/module; presence and
    // directory reads remain fenced by the staged probe model above.
    const tools=upstream===undefined?job.tools:{...job.tools,upstream:JSON.stringify(Object.fromEntries(Object.entries(upstream).filter(([file])=>probes.conservative||used.has(file)).sort(([a],[b])=>order(a,b))))};
    return {...job,inputs:retained,tools:{...tools,readInventory:recipe,probeInventory:probes.identity,packageExports:JSON.stringify(packages),
      execution:JSON.stringify(Object.fromEntries(Object.entries(executionInputs(trace)).map(([file,raw])=>[file,compilerCodeHash(file,raw,()=>readFileSync(resolve(root,file)))])))}};
  };
  /** Normalized execution and projected exports still validate current raw
   * source/manifest bytes through the phase memo before returning a loan.
   * @param {v.InferOutput<typeof Trace>} trace */
  const verifyExecution=trace=>{
    const inputs={...executionInputs(trace),...Object.fromEntries(Object.keys(trace.packages).filter(file=>Object.hasOwn(job.inputs,file)).map(file=>[file,job.inputs[file]]))};
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
