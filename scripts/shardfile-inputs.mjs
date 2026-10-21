// Product-only read receipts. Node records file access; the Vite bridge records
// Rust-bundled module inputs and resolution candidates which bypass Node fs.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import * as childProcess from 'node:child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import {compilerCodeHash} from './compiler-code.mjs';

const raw = { read:fs.readFileSync, stat:fs.lstatSync, list:fs.readdirSync, real:fs.realpathSync.native, write:fs.writeFileSync, mkdir:fs.mkdirSync, rename:fs.renameSync };
const digest = (/** @type {string|Uint8Array} */ bytes) => createHash('sha256').update(bytes).digest('hex');
const schema = 'shardfile-inputs/3', modules = new Set([import.meta.filename,resolve(import.meta.dirname,'bake-input-hashes.mjs'),resolve(import.meta.dirname,'compiler-code.mjs')]);
const code=/\.[cm]?[jt]sx?$/u;
const Receipt = v.strictObject({schema:v.literal(schema),node:v.string(),inputs:v.pipe(v.array(v.pipe(v.string(),v.regex(/^[FDM] /u))),v.minLength(1)),values:v.record(v.string(),v.string()),seal:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))});
/** @type {AsyncLocalStorage<{root:string,reads:Map<string,string>,writes:Set<string>,bundles:number,invalid:string[],observing:boolean,traceOnly?:boolean,opaque?:Set<string>}>} */
const scopes = new AsyncLocalStorage();
/** @type {ReturnType<typeof scopes.getStore>} */
let generationScope;
/** @type {'F'|'M'} */
let moduleKind='M';
const inputScope=()=>scopes.getStore() ?? generationScope;
let installed = false;
/** @param {unknown} target */
function localPath(target) {
  if (typeof target === 'string') return resolve(target);
  if (target instanceof URL && target.protocol === 'file:') return fileURLToPath(target);
  if (target instanceof Uint8Array) return resolve(new TextDecoder().decode(target));
  return undefined;
}
/** @param {string} root @param {string} path */
function inside(root, path) {
  const file = relative(root, path).split(sep).join('/');
  if (file === '' || file.startsWith('../') || isAbsolute(file)) return undefined;
  if (file.split('/').some(part => ['node_modules','.git','.cache','tmp','out','.wildshard'].includes(part))) return undefined;
  return file;
}
/** Current exact bytes, directory inventory, link target or negative existence.
 * @param {string} root @param {string} entry @param {import('./bake-input-hashes.mjs').InputHashMemo} [memo] */
function value(root, entry, memo) {
  const kind = entry.slice(0,1), file = entry.slice(2), at = resolve(root,file);
  try {
    const stat = raw.stat(at,{throwIfNoEntry:false});
    if (stat === undefined) return 'absent';
    if (stat.isSymbolicLink()) throw new Error(`Linked product input: ${file}`);
    if (!raw.real(at).startsWith(root+sep)) throw new Error(`Escaped product input: ${file}`);
    if (stat.isDirectory()) return kind === 'D' ? `directory:${digest(raw.list(at).sort().join('\0'))}` : 'directory';
    if (!stat.isFile()) throw new Error(`Nonregular product input: ${file}`);
    const hash=memo === undefined ? digest(raw.read(at)) : memo.hash(file);
    return kind==='M'&&code.test(file)?`module:${compilerCodeHash(file,hash,()=>raw.read(at))}`:hash;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return 'absent';
    throw error;
  }
}
/** @param {string} kind @param {unknown} target */
function note(kind, target) {
  const scope = inputScope(), path = localPath(target);
  if (scope === undefined || scope.observing || path === undefined) return;
  const file = inside(scope.root,path);
  if(file===undefined) {
    if(kind!=='W'&&scope.traceOnly&&path!==scope.root&&!path.split(sep).includes('node_modules'))scope.opaque?.add('external-read');
    return;
  }
  if (kind === 'W') { scope.writes.add(file); return; }
  const entry = `${kind} ${file}`;
  if (scope.reads.has(entry)) return;
  if(scope.traceOnly){scope.reads.set(entry,'read');return;}
  scope.observing = true;
  try { scope.reads.set(entry,value(scope.root,entry)); } catch (error) { scope.invalid.push(`${entry}: ${String(error)}`); }
  finally { scope.observing = false; }
}
/** Install once in the compiler process, before its entry imports load. */
export function installInputRecorder() {
  if (installed) return; installed = true;
  registerHooks({
  resolve(specifier,context,next) {
    if(/^(?:node:)?(?:worker_threads|http|https|http2|net|tls)$/u.test(specifier))generationScope?.opaque?.add('worker-or-network');
    return next(specifier,context);
  },
  load(url,context,next) {
    const file=url.startsWith('file:')?fileURLToPath(url):undefined,scope=inputScope();
    if(file!==undefined)modules.add(file);
    // Reading a module to execute it differs from consuming its source text.
    // Hide only the loader's own I/O; explicit reads after evaluation stay F.
    const observing=scope?.observing;
    if(scope!==undefined)scope.observing=true;
    let loaded;
    try {loaded=next(url,context);}
    finally {if(scope!==undefined)scope.observing=observing ?? false;}
    if(file!==undefined)note(code.test(file)?moduleKind:'F',file);
    return loaded;
  }});
  /** @type {unknown} */
  const functionText=Object.getOwnPropertyDescriptor(Function.prototype,'toString')?.value;
  if(typeof functionText!=='function')throw new Error('Function source reader is unavailable');
  // oxlint-disable-next-line no-extend-native -- Isolated compiler instrumentation must observe function-source content reads; it preserves the original result outside recording scopes.
  Function.prototype.toString=function toString() {
    /** @type {unknown} */
    const text=Reflect.apply(functionText,this,[]);
    if(typeof text!=='string')throw new Error('Function source reader returned non-text');
    const scope=inputScope();
    if(scope!==undefined&&!scope.observing&&!/\{\s*\[native code\]\s*\}$/u.test(text)) {
      // A function can originate in transformed TypeScript or a closure. Mark
      // all executing modules as raw content rather than guess its source.
      for(const file of modules)note('F',file);
    }
    return text;
  };
  /** @param {Record<string,unknown>} table @param {string[]} names @param {string} kind */
  const wrap = (table,names,kind) => {
    for (const name of names) {
      const original = table[name]; if (typeof original !== 'function') continue;
      /** @this {unknown} @param {...unknown} args */
      const traced = function traced(...args) { note(kind,args[0]); if (name === 'copyFileSync' || name === 'cpSync' || name === 'copyFile' || name === 'cp') note('W',args[1]); return Reflect.apply(original,this,args); };
      Object.defineProperties(traced,Object.getOwnPropertyDescriptors(original)); table[name] = traced;
    }
  };
  wrap(fs,['openAsBlob','readFileSync','readFile','existsSync','statSync','stat','lstatSync','lstat','openSync','open','createReadStream','accessSync','access','realpathSync','copyFileSync','cpSync'],'F');
  wrap(fs,['readdirSync','readdir','opendirSync','opendir'],'D');
  wrap(fs,['writeFileSync','writeFile','appendFileSync','appendFile'],'W');
  wrap(fsp,['readFile','stat','lstat','open','access','realpath','copyFile','cp'],'F');
  wrap(fsp,['readdir','opendir'],'D'); wrap(fsp,['writeFile','appendFile'],'W');
  const nativeLoad=process.dlopen.bind(process);
  process.dlopen=(...args)=>{generationScope?.opaque?.add('native-addon');nativeLoad(...args);};
  const request=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(...args)=>{generationScope?.opaque?.add('network');return request(...args);};
  /** @param {Record<string,unknown>} table */
  const observeChildren=table=>{
    for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) {
      const original=table[name];if(typeof original!=='function')continue;
      /** @this {unknown} @param {...unknown} args */
      const traced=function traced(...args) {
        const version=typeof args[0]==='string'&&Array.isArray(args[1])&&args[1].length===1&&
          ((['magick','cwebp','basisu'].includes(basename(args[0]))&&args[1][0]==='-version')||
           (args[0]===process.execPath&&args[1][0]==='--version'));
        if(!version)generationScope?.opaque?.add('child-process');
        return Reflect.apply(original,this,args);
      };
      Object.defineProperties(traced,Object.getOwnPropertyDescriptors(original));table[name]=traced;
    }
  };
  observeChildren(childProcess.default);
  syncBuiltinESMExports();
}
/** Bundler resolution can select a newly added higher-priority relative file.
 * @param {string} id @param {string|undefined} importer */
export function recordResolution(id, importer) {
  if (!id.startsWith('.') || importer === undefined || !isAbsolute(importer)) return;
  const at = resolve(dirname(importer.split('?')[0]),id.split('?')[0]);
  for (const suffix of ['', '.ts','.tsx','.mts','.js','.jsx','.mjs','.json','/package.json','/index.ts','/index.tsx','/index.mts','/index.js','/index.jsx','/index.mjs','/index.json']) note('F',at+suffix);
}
/** Record resolved inputs before the native bundler reads them.
 * @param {string} id */
export function recordModuleInput(id) { if (isAbsolute(id)) note('F',id.split('?')[0]); }
/** @param {unknown} result */
export function recordBundle(result) {
  const scope = inputScope(); if (scope === undefined) return;
  scope.bundles++;
  for (const build of Array.isArray(result) ? result : [result]) if (build !== null && typeof build === 'object' && 'output' in build && Array.isArray(build.output)) {
    for (const chunk of build.output) if (chunk.type === 'chunk') for (const id of chunk.moduleIds ?? Object.keys(chunk.modules ?? {})) if (typeof id === 'string' && isAbsolute(id)) note('F',id.split('?')[0]);
  }
}
/** A successful, complete compiler writes its receipt after checking read stability.
 * @param {string} root @param {string} receipt @param {()=>Promise<void>} run */
export async function captureProductInputs(root,receipt,run) {
  if(generationScope!==undefined)generationScope.opaque?.add('nested-product-compiler');
  installInputRecorder();
  const scope = {root:raw.real(root),reads:new Map(),writes:new Set(),bundles:0,invalid:[],observing:false};
  await scopes.run(scope,async () => {
    for (const file of modules) note(code.test(file)?moduleKind:'F',file);
    await run();
  });
  if (scope.invalid.length > 0 || scope.bundles === 0) throw new Error(`Incomplete product input trace: ${scope.invalid.join('; ')}`);
  const values = Object.fromEntries([...scope.reads].sort(([a],[b])=>a.localeCompare(b)).map(([entry,before])=>{
    const after = value(scope.root,entry);
    if (after !== before && !scope.writes.has(entry.slice(2)) && ![...scope.writes].some(file=>file.startsWith(`${entry.slice(2)}/`))) throw new Error(`Product input changed during build: ${entry}`);
    return [entry,after];
  }));
  const body = {schema,node:process.version,inputs:Object.keys(values),values};
  raw.mkdir(dirname(receipt),{recursive:true}); raw.write(receipt,JSON.stringify({...body,seal:digest(JSON.stringify(body))}));
}
/** A missing/malformed receipt always misses. Unread generated files never enter it.
 * @param {string} root @param {string} receipt @param {string[]} args @param {import('./bake-input-hashes.mjs').InputHashMemo} memo */
export function productInputKey(root,receipt,args,memo) {
  try {
    if(memo.root!==raw.real(root))return undefined;
    const saved = v.parse(Receipt,JSON.parse(raw.read(receipt,'utf8')));
    if (saved.node !== process.version
      || saved.inputs.some(entry=> inside(root,resolve(root,entry.slice(2))) !== entry.slice(2))
      || new Set(saved.inputs).size !== saved.inputs.length || Object.keys(saved.values).length !== saved.inputs.length
      || saved.seal !== digest(JSON.stringify({schema:saved.schema,node:saved.node,inputs:saved.inputs,values:saved.values}))) return undefined;
    for (const entry of saved.inputs) {
      const expected=saved.values[entry];
      // A captured content digest already identifies a regular-file read. The
      // hash memo checks type, containment and fresh stats itself; avoid doing
      // those same filesystem checks once more in value(). Any type change
      // refuses this receipt through the enclosing miss-on-error boundary.
      const current=/^[a-f0-9]{64}$/u.test(expected) ? memo.hash(entry.slice(2)) : value(root,entry,memo);
      if(expected!==current)return undefined;
    }
    return digest(JSON.stringify({schema,node:process.version,platform:process.platform,arch:process.arch,args,inputs:saved.inputs.map(entry=>[entry,saved.values[entry]])}));
  } catch { return undefined; }
}
/** Keep immutable read-set variants: simultaneous revisions cannot overwrite
 * another build's evidence. Only a byte-matching captured snapshot can hit.
 * @param {string} root @param {string} directory @param {string[]} args @param {import('./bake-input-hashes.mjs').InputHashMemo} memo */
export function matchingProductInputKey(root,directory,args,memo) {
  try {
    const receipts=raw.list(directory).filter(file=>/^[a-f0-9]{64}\.json$/u.test(file)).map(file=>({file,mtime:raw.stat(resolve(directory,file)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);
    for(const row of receipts.slice(0,12)) {
      const key=productInputKey(root,resolve(directory,row.file),args,memo);
      if(key !== undefined && row.file === `${key}.json`) return key;
    }
  } catch { /* Missing/incomplete evidence builds a fresh product. */ }
  return undefined;
}
/** Publish one complete immutable receipt atomically.
 * @param {string} directory @param {string} receipt @param {string} key */
export function publishProductInputs(directory,receipt,key) {
  raw.mkdir(directory,{recursive:true});
  const temporary=resolve(directory,`${key}.${process.pid}.tmp`);
  raw.write(temporary,raw.read(receipt)); raw.rename(temporary,resolve(directory,`${key}.json`));
}
if (process.execArgv.some((arg,index)=>arg==='--import' && process.execArgv[index+1] === import.meta.filename)) installInputRecorder();

/** Workspace/dependency installation identity. Compiler execution and runtime
 * source enter complete per-product receipts; unused SDK files do not.
 * @param {string} root @param {import('./bake-input-hashes.mjs').InputHashMemo} memo */
export function productToolchainKey(root,memo) {
  const files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml'];
  return digest(JSON.stringify(files.map(file=>[file,memo.hash(file)])));
}

/** Native plugin callbacks cross an async boundary; bind the product scope at
 * plugin creation rather than assuming Rolldown preserves AsyncLocalStorage. */
export function inputRecorderPlugin() {
  const scope = scopes.getStore();
  return {name:'product-input-recorder',enforce:/** @type {const} */ ('pre'),
    /** @param {string} id @param {string|undefined} importer */
    resolveId(id,importer) { if (scope !== undefined) scopes.run(scope,()=>recordResolution(id,importer)); return null; },
    /** @param {string} id */
    load(id) { if (scope !== undefined) scopes.run(scope,()=>recordModuleInput(id)); return null; },
  };
}

/** Start one isolated producer's raw Node read trace. Unknown native, network,
 * worker or child-process reads retain the full conservative input closure.
 * @param {string} root @param {string} receipt */
export function startGenerationInputTrace(root,receipt) {
  if(generationScope!==undefined)throw new Error('Generation trace already active');
  moduleKind='F';installInputRecorder();
  const scope={root:raw.real(root),reads:new Map(),writes:new Set(),bundles:0,invalid:[],observing:false,traceOnly:true,opaque:new Set()};
  generationScope=scope;scopes.enterWith(scope);
  for(const file of modules)if(inside(scope.root,file)!==undefined)note('F',file);
  process.on('exit',status=>{
    if(status!==0)return;
    const body={schema:'generation-reads/1',files:[...scope.reads.keys()].filter(entry=>/^[FM] /u.test(entry)).map(entry=>entry.slice(2)).sort((a,b)=>a<b?-1:a>b?1:0),opaque:[...scope.opaque].sort((a,b)=>a<b?-1:a>b?1:0)};
    raw.write(receipt,JSON.stringify({...body,seal:digest(JSON.stringify(body))}));
  });
}
