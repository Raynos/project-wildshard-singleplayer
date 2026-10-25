// CF1 caches syntax only. Resolve every edge against the current candidate.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';

const MODULE = /\.[cm]?[jt]sx?$/u;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const hash = (/** @type {string} */ text) => createHash('sha256').update(text).digest('hex');
/** @typedef {{imports:string[],digest:string}} ImportRow */
/** @param {string} oid @param {string[]} imports */
const seal = (oid, imports) => hash(JSON.stringify([oid, imports]));

/** Raw import syntax is independent of filename, exports and file inventory.
 * Only verified blob identities may reuse it; cache errors always reparse.
 * @param {string} root @param {import('./precommit-projects.mjs').StagedFiles} staged */
export function candidateImportSources(root, staged) {
  const env = resolve(root) === process.cwd() ? process.env
    : Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd:root,env,encoding:'utf8'}).trim();
  const file = resolve(common, 'commit-imports.json'), stamp = hash(`${ts.version}\n${readFileSync(import.meta.filename,'utf8')}`);
  /** @type {Map<string,ImportRow>} */
  const cached = new Map();
  try {
    if ((statSync(file).size) <= MAX_CACHE_BYTES) {
      /** @type {unknown} */
      const raw = JSON.parse(readFileSync(file,'utf8'));
      if (typeof raw === 'object' && raw !== null && Reflect.get(raw,'stamp') === stamp) {
        const rows = Reflect.get(raw,'rows');
        if (typeof rows === 'object' && rows !== null && !Array.isArray(rows)) for (const [oid,row] of Object.entries(rows)) {
          if (typeof row !== 'object' || row === null) continue;
          const imports = Reflect.get(row,'imports'), digest = Reflect.get(row,'digest');
          if (/^[0-9a-f]{40}$/u.test(oid) && Array.isArray(imports) && imports.every(value => typeof value === 'string')
            && digest === seal(oid,imports)) cached.set(oid,{imports,digest});
        }
      }
    }
  } catch { /* Missing/corrupt cache: actual candidate blobs remain authoritative. */ }
  const modules = staged.paths.filter(path => MODULE.test(path));
  const missing = [...new Set(modules.flatMap(path => {const oid=staged.blobs?.get(path);return oid===undefined || cached.has(oid) ? [] : [oid];}))];
  /** @type {Map<string,string>} */
  const texts = new Map();
  if (missing.length > 0) {
    const bytes = execFileSync('git',['cat-file','--batch'],{cwd:root,env,input:`${missing.join('\n')}\n`,maxBuffer:1<<28});
    let offset=0;
    for (const oid of missing) {
      const end=bytes.indexOf(10,offset), header=bytes.subarray(offset,end).toString('utf8').split(' '), size=Number(header[2]);
      if (end===-1 || header[0]!==oid || header[1]!=='blob' || !Number.isSafeInteger(size) || size<0 || end+size+1>=bytes.length)
        throw new Error('Missing candidate import blob');
      texts.set(oid,bytes.subarray(end+1,end+size+1).toString('utf8'));offset=end+size+2;
    }
    if (offset!==bytes.length) throw new Error('Unexpected candidate import batch suffix');
  }
  /** @type {Map<string,string>} */
  const sources=new Map();
  /** @type {Map<string,readonly string[]>} */
  const imports=new Map();
  /** @type {Map<string,ImportRow>} */
  const current=new Map();
  let hits=0, misses=0;
  for (const path of modules) {
    const oid=staged.blobs?.get(path), held=oid===undefined?undefined:cached.get(oid);
    let row=held ?? (oid===undefined?undefined:current.get(oid));
    if (row===undefined) {
      const source=oid===undefined?staged.read(path):texts.get(oid);
      if (source===undefined) throw new Error(`Missing candidate import source: ${path}`);
      const names=ts.preProcessFile(source,true,true).importedFiles.map(entry=>entry.fileName);
      row={imports:names,digest:seal(oid??'',names)};misses++;
    } else hits++;
    sources.set(path,'');imports.set(path,row.imports);
    if (oid!==undefined) current.set(oid,row);
  }
  // Export maps are read afresh, then resolution uses the complete new index.
  for (const path of staged.paths.filter(name=>/^src\/[^/]+\/package\.json$/u.test(name))) {
    const source=staged.read(path);if(source===undefined)throw new Error(`Missing candidate exports: ${path}`);
    sources.set(path,source);
  }
  const temporary=`${file}.${process.pid}`;
  try {
    const text=JSON.stringify({stamp,rows:Object.fromEntries(current)});
    if (Buffer.byteLength(text)<=MAX_CACHE_BYTES) {mkdirSync(common,{recursive:true});writeFileSync(temporary,text);renameSync(temporary,file);}
  } catch { /* Optional acceleration never replaces strict source reads. */ }
  finally {rmSync(temporary,{force:true});}
  return {sources,imports,hits,misses};
}
