// Installed package probes never inherit an authored-source inventory. Only
// exact pnpm resolution records shared by the source and installed locks qualify.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,readlinkSync,realpathSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import * as v from 'valibot';

const hash=(/** @type {string|Uint8Array} */ payload)=>createHash('sha256').update(payload).digest('hex');
const Manifest=v.object({name:v.string(),version:v.string()});
const bounded=(/** @type {string} */ file)=>file!==''&&!file.includes('\\')&&file.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
const inside=(/** @type {string} */ root,/** @type {string} */ file)=>{const path=relative(root,file).replaceAll('\\','/');return path===''||bounded(path)&&!path.startsWith('/');};
/** Accept only pnpm 9's exact, single-line registry integrity records. Other
 * resolutions, duplicate keys and unsupported YAML stay unverified.
 * @param {string} text */
function resolutions(text) {
  /** @type {Map<string,string|undefined>} */
  const rows=new Map();
  const versions=text.match(/^lockfileVersion:.*$/gmu);
  if(versions?.length!==1||!/^lockfileVersion: ['"]?9\.0['"]?\s*$/u.test(versions[0]))return rows;
  const block=text.split('\npackages:\n');
  if(block.length!==2)return rows;
  let key;
  for(const line of (block[1]??'').split('\nsnapshots:\n')[0].split('\n')) {
    const header=/^ {2}(?:'([^']+)'|([^\s:'"]+)):\s*$/u.exec(line);
    if(header!==null) {
      key=header[1]??header[2];
      if(key!==undefined) {const duplicate=rows.has(key);rows.set(key,undefined);if(duplicate)key=undefined;}
      continue;
    }
    const integrity=/^ {4}resolution: \{integrity: (sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2})\}$/u.exec(line);
    if(key!==undefined&&integrity?.[1]!==undefined) {
      if(rows.get(key)!==undefined){rows.set(key,undefined);key=undefined;continue;}
      const value=integrity[1];
      // SRI stays textual metadata: canonical length, padding and unused bits.
      if(/^(?:sha256-[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=|sha384-[A-Za-z0-9+/]{64}|sha512-[A-Za-z0-9+/]{85}[AQgw]==)$/u.test(value))rows.set(key,value);
    }
  }
  return rows;
}
/** @param {string} file */
function bytes(file) {try{return readFileSync(file);}catch{return undefined;}}
/** @param {string} file */
function stamp(file) {
  try {
    const row=lstatSync(file,{bigint:true});let target='';
    if(row.isSymbolicLink())try{target=realpathSync(file);}catch(error){target=error instanceof Error&&'code'in error?String(error.code):'unresolved';}
    return [row.dev,row.ino,row.size,row.mtimeNs,row.ctimeNs,target].join(':');
  }
  catch(error) {if(error instanceof Error&&'code'in error)return String(error.code);throw error;}
}
/** @param {Map<string,string>} stamps */
const unchanged=stamps=>[...stamps].every(([file,value])=>stamp(file)===value);
/** Metadata is memoized only while every nanosecond file/link/directory stamp
 * matches. The cache stores no producer observations or package file payloads.
 * @type {{root:string,stamps:Map<string,string>,snapshot:ReturnType<typeof captureInstallation>}|undefined} */
let previous;
/** @param {string} root */
function installation(root) {
  const base=realpathSync(root);
  if(previous?.root===base&&unchanged(previous.stamps))return previous.snapshot;
  const stamps=new Map(),snapshot=captureInstallation(base,stamps);
  if(!unchanged(stamps))throw new Error('Generation dependency metadata changed while reading');
  previous={root:base,stamps,snapshot};return snapshot;
}
/** @param {string} base @param {Map<string,string>} stamps */
function captureInstallation(base,stamps) {
  const touch=(/** @type {string} */ file)=>{
    const value=stamp(file),before=stamps.get(file);
    if(before!==undefined&&before!==value)throw new Error(`Generation dependency metadata changed while reading: ${file}`);
    stamps.set(file,value);return file;
  };
  const read=(/** @type {string} */ file)=>{
    touch(file);
    try {touch(realpathSync(file));}catch { /* Missing metadata remains unverified. */ }
    return bytes(file);
  };
  const source=read(resolve(base,'pnpm-lock.yaml')),installed=read(resolve(base,'node_modules/.pnpm/lock.yaml'));
  const locked=resolutions(source?.toString('utf8')??''),present=resolutions(installed?.toString('utf8')??'');
  /** @type {string|undefined} */
  let store;
  try {store=realpathSync(touch(resolve(base,'node_modules/.pnpm')));}catch { /* An uninstalled fixture grants no dependency model. */ }
  /** @type {Map<string,{target:string,manifest:string,name:string,version:string,integrity:string}>} */
  const packages=new Map();
  /** @type {unknown[]} */
  const layout=[];
  const spaces=['node_modules'],src=resolve(base,'src');
  if(existsSync(touch(src)))for(const entry of readdirSync(src,{withFileTypes:true}))if(entry.isDirectory()){touch(resolve(src,entry.name));spaces.push(`src/${entry.name}/node_modules`);}
  for(const space of spaces.sort()) {
    const directory=touch(resolve(base,space));
    if(!existsSync(directory))continue;
    const aliases=readdirSync(directory).filter(name=>!name.startsWith('.')&&name!=='@wildshard').flatMap(name=>{
      const at=touch(resolve(directory,name));
      if(name.startsWith('@'))try{return readdirSync(at).map(child=>`${name}/${child}`);}catch { /* Missing or non-directory scopes remain unverified aliases. */ }
      return [name];
    });
    for(const name of aliases.sort()) {
      const alias=`${space}/${name}`,at=touch(resolve(base,alias));
      try {
        const target=realpathSync(at),raw=read(resolve(target,'package.json'));
        const address=store!==undefined&&inside(store,target)?`pnpm:${relative(store,target).replaceAll('\\','/')}`:target;
        layout.push([alias,address,raw===undefined?'missing':hash(raw)]);
        const manifest=raw===undefined?undefined:v.safeParse(Manifest,JSON.parse(raw.toString('utf8')));
        if(store===undefined||!inside(store,target)||raw===undefined||manifest?.success!==true||manifest.output.name!==name)continue;
        const {version}=manifest.output,storePath=relative(store,target).replaceAll('\\','/');
        const folder=storePath.slice(0,storePath.indexOf('/'));
        const prefix=`${name.replace('/','+')}@${version}`;
        if(storePath!==`${folder}/node_modules/${name}`||!(folder===prefix||folder.startsWith(`${prefix}_`)||folder.startsWith(`${prefix}(`)))continue;
        const integrity=locked.get(`${name}@${version}`);
        if(integrity===undefined||present.get(`${name}@${version}`)!==integrity)continue;
        packages.set(alias,{target,manifest:hash(raw),name,version,integrity});
      }catch {
        let target;
        try {target=readlinkSync(at);}catch { /* Nonlinked malformed package. */ }
        layout.push([alias,'unverified',target??null]);
      }
    }
  }
  const identity=hash(JSON.stringify({source:source===undefined?null:hash(source),installed:installed===undefined?null:hash(installed),layout}));
  return {identity,base,store,packages,sourceDigest:source===undefined?undefined:hash(source)};
}
/** Capture the exact installed alias layout. It is shared by full job keys,
 * narrowed lookups and completed-phase receipts. No authored filenames enter it.
 * @param {string} root @param {string} [expectedLock] */
export function generationDependencies(root,expectedLock) {
  const {identity,store,packages,sourceDigest}=installation(root);
  /** @type {Map<string,string>} */
  const observed=new Map();
  /** Even a refused model must fence the full-cache fallback. A retargeted
   * nested link cannot turn a narrowed miss into the original full result.
   * @param {string} file */
  const rawProbe=file=>{
    try {
      const at=realpathSync(resolve(root,file)),stat=lstatSync(at);
      return JSON.stringify({path:store!==undefined&&inside(store,at)?`pnpm:${relative(store,at)}`:at,kind:stat.isDirectory()?'directory':stat.isFile()?'file':'other',bytes:stat.isFile()?hash(readFileSync(at)):null});
    }catch(error){return error instanceof Error&&'code'in error?String(error.code):'unverified';}
  };
  /** Presence probes bind exact package metadata, resolved path, path types and
   * existing file bytes. Symlink escapes and absent/unverified aliases refuse
   * modeling rather than borrowing the caller's loose source inventory.
   * @param {string} file */
  const probe=file=>{
    if(!bounded(file))return undefined;
    const match=/^(node_modules(?:\/\.pnpm\/[^/]+\/node_modules)?|src\/[^/]+\/node_modules)\/((?:@[^/]+\/)?[^/]+)(?:\/(.*))?$/u.exec(file);
    if(match?.[1]===undefined||match[2]===undefined)return undefined;
    observed.set(file,rawProbe(file));
    if(sourceDigest===undefined||expectedLock!==sourceDigest)return undefined;
    const alias=`${match[1]}/${match[2]}`;
    let pkg=packages.get(alias);
    if(pkg===undefined&&store!==undefined&&alias.startsWith('node_modules/.pnpm/')) {
      // Only physical package roots already admitted through installed public
      // aliases qualify. Peer links, unknown private packages and store escapes
      // retain the conservative fence; no stage-depth reconstruction is used.
      const target=resolve(store,alias.slice('node_modules/.pnpm/'.length));
      try {if(realpathSync(target)===target)pkg=[...packages.values()].find(row=>row.target===target&&row.name===match[2]);}
      catch { /* Absent or linked package roots grant no narrower identity. */ }
    }
    if(pkg===undefined)return undefined;
    /** @type {unknown[]} */
    const chain=[];
    let at=pkg.target;
    try {
      for(const part of (match[3]??'').split('/').filter(Boolean)) {
        at=resolve(at,part);
        let stat;
        try {stat=lstatSync(at);}catch(error){if(!(error instanceof Error&&'code'in error&&['ENOENT','ENOTDIR'].includes(String(error.code))))throw error;}
        if(stat===undefined){chain.push([part,'absent']);continue;}
        const real=realpathSync(at);
        if(!inside(pkg.target,real))return undefined;
        chain.push([part,stat.isDirectory()?'directory':stat.isFile()?'file':stat.isSymbolicLink()?'link':'other',relative(pkg.target,real),stat.isDirectory()?null:hash(readFileSync(real))]);
      }
      const value=JSON.stringify({name:pkg.name,version:pkg.version,integrity:pkg.integrity,manifest:pkg.manifest,path:store===undefined?pkg.target:relative(store,pkg.target),chain});
      return value;
    }catch {return undefined;}
  };
  return {identity,probe,
    observedIdentity:()=>hash(JSON.stringify([...observed].sort(([a],[b])=>a<b?-1:a>b?1:0))),
    verify:()=>{
      if(installation(root).identity!==identity)throw new Error('Generation installed packages changed');
      for(const[file,value]of observed)if(rawProbe(file)!==value)throw new Error(`Generation installed package probe changed: ${file}`);
    }};
}
