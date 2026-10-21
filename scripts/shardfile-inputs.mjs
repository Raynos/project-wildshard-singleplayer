// Product-only read receipts. Node records file access; the Vite bridge records
// Rust-bundled module inputs and resolution candidates which bypass Node fs.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';

const raw = { read:fs.readFileSync, stat:fs.lstatSync, list:fs.readdirSync, real:fs.realpathSync, write:fs.writeFileSync, mkdir:fs.mkdirSync };
const digest = (/** @type {string|Uint8Array} */ bytes) => createHash('sha256').update(bytes).digest('hex');
const schema = 'shardfile-inputs/1', modules = new Set([import.meta.filename,resolve(import.meta.dirname,'bake-input-hashes.mjs')]);
const Receipt = v.strictObject({schema:v.literal(schema),node:v.string(),inputs:v.pipe(v.array(v.pipe(v.string(),v.regex(/^[FD] /u))),v.minLength(1)),seal:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))});
/** @type {AsyncLocalStorage<{root:string,reads:Map<string,string>,writes:Set<string>,bundles:number,invalid:string[],observing:boolean}>} */
const scopes = new AsyncLocalStorage();
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
    const stat = raw.stat(at);
    if (stat.isSymbolicLink()) throw new Error(`Linked product input: ${file}`);
    if (!raw.real(at).startsWith(root+sep)) throw new Error(`Escaped product input: ${file}`);
    if (stat.isDirectory()) return kind === 'D' ? `directory:${digest(raw.list(at).sort().join('\0'))}` : 'directory';
    if (!stat.isFile()) throw new Error(`Nonregular product input: ${file}`);
    return memo === undefined ? digest(raw.read(at)) : memo.hash(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return 'absent';
    throw error;
  }
}
/** @param {string} kind @param {unknown} target */
function note(kind, target) {
  const scope = scopes.getStore(), path = localPath(target);
  if (scope === undefined || scope.observing || path === undefined) return;
  const file = inside(scope.root,path); if (file === undefined) return;
  if (kind === 'W') { scope.writes.add(file); return; }
  const entry = `${kind} ${file}`;
  if (scope.reads.has(entry)) return;
  scope.observing = true;
  try { scope.reads.set(entry,value(scope.root,entry)); } catch (error) { scope.invalid.push(`${entry}: ${String(error)}`); }
  finally { scope.observing = false; }
}
/** Install once in the compiler process, before its entry imports load. */
export function installInputRecorder() {
  if (installed) return; installed = true;
  registerHooks({load(url,context,next) { if (url.startsWith('file:')) modules.add(fileURLToPath(url)); return next(url,context); }});
  /** @param {Record<string,unknown>} table @param {string[]} names @param {string} kind */
  const wrap = (table,names,kind) => {
    for (const name of names) {
      const original = table[name]; if (typeof original !== 'function') continue;
      /** @this {unknown} @param {...unknown} args */
      const traced = function traced(...args) { note(kind,args[0]); if (name === 'copyFileSync' || name === 'cpSync' || name === 'copyFile' || name === 'cp') note('W',args[1]); return Reflect.apply(original,this,args); };
      Object.defineProperties(traced,Object.getOwnPropertyDescriptors(original)); table[name] = traced;
    }
  };
  wrap(fs,['readFileSync','readFile','existsSync','statSync','stat','lstatSync','lstat','openSync','open','createReadStream','accessSync','access','realpathSync','copyFileSync','cpSync'],'F');
  wrap(fs,['readdirSync','readdir','opendirSync','opendir'],'D');
  wrap(fs,['writeFileSync','writeFile','appendFileSync','appendFile'],'W');
  wrap(fsp,['readFile','stat','lstat','open','access','realpath','copyFile','cp'],'F');
  wrap(fsp,['readdir','opendir'],'D'); wrap(fsp,['writeFile','appendFile'],'W');
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
  const scope = scopes.getStore(); if (scope === undefined) return;
  scope.bundles++;
  for (const build of Array.isArray(result) ? result : [result]) if (build !== null && typeof build === 'object' && 'output' in build && Array.isArray(build.output)) {
    for (const chunk of build.output) if (chunk.type === 'chunk') for (const id of chunk.moduleIds ?? Object.keys(chunk.modules ?? {})) if (typeof id === 'string' && isAbsolute(id)) note('F',id.split('?')[0]);
  }
}
/** A successful, complete compiler writes its receipt after checking read stability.
 * @param {string} root @param {string} receipt @param {()=>Promise<void>} run */
export async function captureProductInputs(root,receipt,run) {
  installInputRecorder();
  const scope = {root:raw.real(root),reads:new Map(),writes:new Set(),bundles:0,invalid:[],observing:false};
  await scopes.run(scope,async () => {
    for (const file of modules) note('F',file);
    await run();
  });
  if (scope.invalid.length > 0 || scope.bundles === 0) throw new Error(`Incomplete product input trace: ${scope.invalid.join('; ')}`);
  const inputs = [...scope.reads].sort(([a],[b])=>a.localeCompare(b)).map(([entry,before])=>{
    const after = value(scope.root,entry);
    if (after !== before && !scope.writes.has(entry.slice(2)) && ![...scope.writes].some(file=>file.startsWith(`${entry.slice(2)}/`))) throw new Error(`Product input changed during build: ${entry}`);
    return entry;
  });
  const body = {schema,node:process.version,inputs};
  raw.mkdir(dirname(receipt),{recursive:true}); raw.write(receipt,JSON.stringify({...body,seal:digest(JSON.stringify(body))}));
}
/** A missing/malformed receipt always misses. Unread generated files never enter it.
 * @param {string} root @param {string} receipt @param {string[]} args @param {import('./bake-input-hashes.mjs').InputHashMemo} memo */
export function productInputKey(root,receipt,args,memo) {
  try {
    const saved = v.parse(Receipt,JSON.parse(raw.read(receipt,'utf8')));
    if (saved.node !== process.version
      || saved.inputs.some(entry=> inside(root,resolve(root,entry.slice(2))) !== entry.slice(2))
      || saved.seal !== digest(JSON.stringify({schema:saved.schema,node:saved.node,inputs:saved.inputs}))) return undefined;
    return digest(JSON.stringify({schema,node:process.version,args,inputs:saved.inputs.map(entry=>[entry,value(root,entry,memo)])}));
  } catch { return undefined; }
}
if (process.execArgv.some((arg,index)=>arg==='--import' && process.execArgv[index+1] === import.meta.filename)) installInputRecorder();

/** SDK/format changes deliberately rebuild every product; unread generated tables
 * are omitted here and enter individual receipts only when actually consumed.
 * @param {string} root @param {import('./bake-input-hashes.mjs').InputHashMemo} memo */
export function productToolchainKey(root,memo) {
  /** @type {string[]} */
  const files = [];
  /** @param {string} folder */
  const walk = folder => {
    for (const row of raw.list(resolve(root,folder),{withFileTypes:true})) {
      if (['node_modules','dist','client','client-devserver'].includes(row.name)) continue;
      const file = `${folder}/${row.name}`;
      if (row.isDirectory()) walk(file);
      else if (row.isFile() && /\.(?:[cm]?[jt]s|json)$/u.test(row.name) && !row.name.includes('.generated.')) files.push(file);
    }
  };
  for (const folder of ['src/sdk','src/format']) walk(folder);
  for (const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml']) files.push(file);
  return digest(JSON.stringify(files.sort().map(file=>[file,memo.hash(file)])));
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
