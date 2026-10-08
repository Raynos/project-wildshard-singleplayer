#!/usr/bin/env node
// SF68 / E462: committed reports -> typed static admin bundle. No game build, browser or deploy.
import { execFileSync } from 'node:child_process';
import { existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectAdminData,safeSourcePath,stableJson } from './admin-data/collect.mjs';

/** Never observe the shared index/working tree. A single resolved commit pins all subsequent blob reads.
 * @param {string} root @param {string} rev @returns {import('./admin-data/collect.mjs').CommittedTree} */
export function committedAdminTree(root,rev){
  const git=/** @param {string[]} args */args=>execFileSync('git',['-C',root,...args],{maxBuffer:64_000_000});
  const revision=git(['rev-parse','--verify',`${rev}^{commit}`]).toString('utf8').trim();
  if(!/^[a-f\d]{40}$/u.test(revision))throw new Error('Could not resolve report revision');
  const entries=git(['ls-tree','-r','-z',revision,'--','progress/memory','progress/loading/sf67','art/playtest','docs/plans/SHARD-PLATFORM.md']).toString('utf8').split('\0').filter(Boolean);
  const paths=entries.map(entry=>{
    const tab=entry.indexOf('\t'),meta=entry.slice(0,tab),path=entry.slice(tab+1);
    if(!meta.startsWith('100644 blob ')&&!meta.startsWith('100755 blob '))throw new Error(`Report tree contains a non-regular file: ${path}`);
    return path;
  });
  return {revision,paths,read:path=>git(['show',`${revision}:${path}`])};
}
/** Explicit build-export adapter for hosts without .git. The caller must supply a clean archive of rev.
 * Never a fallback for the mutable shared checkout; the pin is provenance supplied by the export producer.
 * @param {string} root @param {string} revision @returns {import('./admin-data/collect.mjs').CommittedTree} */
export function exportedAdminTree(root,revision){
  if(!/^[a-f\d]{40}$/u.test(revision))throw new Error('Clean export requires its full committed revision');
  if(existsSync(join(root,'.git')))throw new Error('Use committedAdminTree for a Git checkout');
  /** @type {string[]} */
  const paths=[];
  /** @param {string} path */
  const walk=path=>{
    safeSourcePath(path);
    const file=join(root,path);
    if(!existsSync(file))return;
    const stat=lstatSync(file);
    if(stat.isSymbolicLink())throw new Error(`Report export contains a symbolic link: ${path}`);
    if(stat.isDirectory())for(const entry of readdirSync(file))walk(`${path}/${entry}`);
    else if(stat.isFile())paths.push(path);
    else throw new Error(`Report export contains a non-regular file: ${path}`);
  };
  for(const path of ['progress/memory','progress/loading/sf67','art/playtest','docs/plans/SHARD-PLATFORM.md'])walk(path);
  return {revision,paths,read:path=>readFileSync(join(root,safeSourcePath(path)))};
}
/** Writes a complete fresh directory atomically; stale assets from older bundles cannot survive.
 * @param {import('./admin-data/collect.mjs').CommittedTree} tree @param {string} output */
export function writeAdminData(tree,output){
  const {bundle,files}=collectAdminData(tree),destination=resolve(output);
  if(existsSync(destination))throw new Error('Admin output directory must be new');
  mkdirSync(dirname(destination),{recursive:true});
  const scratch=mkdtempSync(join(dirname(destination),'.admin-data-'));
  try{
    for(const [path,bytes]of files){const target=join(scratch,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
    writeFileSync(join(scratch,'bundle.json'),stableJson(bundle));
    for(const file of ['schema.json','loading.schema.json'])writeFileSync(join(scratch,file),readFileSync(new URL(`admin-data/${file}`,import.meta.url)));
    renameSync(scratch,destination);
  }finally{rmSync(scratch,{recursive:true,force:true});}
  return bundle;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const options=new Map(process.argv.slice(2).map(arg=>{const index=arg.indexOf('=');if(index===-1)throw new Error('Use --root=REPO --rev=HEAD --out=NEW_DIR');return [arg.slice(0,index),arg.slice(index+1)];}));
    for(const key of options.keys())if(!['--root','--rev','--out','--snapshot-root'].includes(key))throw new Error(`Unknown option ${key}`);
    const output=options.get('--out');if(!output)throw new Error('--out=NEW_DIR is required');
    const snapshot=options.get('--snapshot-root');
    if(snapshot&&options.has('--root'))throw new Error('Use either --root or --snapshot-root');
    const tree=snapshot?exportedAdminTree(resolve(snapshot),options.get('--rev')??''):committedAdminTree(resolve(options.get('--root')??'.'),options.get('--rev')??'HEAD');
    const bundle=writeAdminData(tree,output);
    console.info(`Admin data ${bundle.revision}: ${bundle.memory.length} memory reports, ${bundle.playtests.length} playtests, loading ${bundle.loading.status}`);
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
