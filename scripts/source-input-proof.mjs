// A verified local generation phase can survive cache eviction. Every use
// rechecks its current source bytes, source inventories and admitted outputs.
import {createHash,randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {InputHashMemo} from './bake-input-hashes.mjs';
import * as v from 'valibot';

const path=v.pipe(v.string(),v.check(value=>value.length>0&&!isAbsolute(value)&&!value.includes('\\')&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')));
const hash=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
const Snapshot=v.strictObject({schema:v.literal('generation-phase/1'),root:v.string(),identity:hash,inputs:v.record(path,hash),trees:v.record(path,v.array(path)),outputs:v.record(path,hash),seal:hash});
/** @param {unknown} value */
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Missing, partial, crossed or changed evidence always refuses reuse.
 * @param {string} file @param {string} identity
 * @param {import('./bake-input-hashes.mjs').InputHashMemo} memo @param {string[]} outputs */
export function verifiedSourceSnapshot(file,identity,memo,outputs) {
  try {
    const saved=v.parse(Snapshot,JSON.parse(readFileSync(file,'utf8')));
    const {seal,...body}=saved;
    if(saved.root!==memo.root||saved.identity!==identity||digest(body)!==seal)return false;
    if(JSON.stringify(Object.keys(saved.outputs).sort())!==JSON.stringify([...new Set(outputs)].sort()))return false;
    // Inventory checks include negative source evidence: adding an input to a
    // broad declared root invalidates the phase even when old files match.
    memo.verifyInputs(saved.inputs);memo.verifyInputs(saved.outputs);
    for(const [folder,files] of Object.entries(saved.trees))if(JSON.stringify(memo.paths(folder,true))!==JSON.stringify(files))return false;
    return true;
  } catch {return false;}
}

/** Publish only after the complete phase and its source verification pass.
 * @param {string} file @param {string} identity
 * @param {import('./bake-input-hashes.mjs').InputHashMemo} memo
 * @param {Record<string,string>} outputs */
export function publishSourceSnapshot(file,identity,memo,outputs) {
  const source=memo.snapshotData();memo.verifyInputs(outputs);
  const body={schema:'generation-phase/1',root:memo.root,identity,...source,outputs};
  const temporary=`${file}.${process.pid}-${randomBytes(8).toString('hex')}.tmp`;
  try {mkdirSync(dirname(file),{recursive:true});writeFileSync(temporary,JSON.stringify({...body,seal:digest(body)}));renameSync(temporary,file);}
  catch (error) {try {rmSync(temporary,{force:true});} catch { /* Preserve the publication error. */ }throw error;}
}

/** Bind the exact validated recipe and current controller/runtime/tool bytes.
 * @param {unknown} value */
export function sourceSnapshotIdentity(value) {return digest(value);}

/** Freeze the committed source program inputs before any outputs are published.
 * Existing exact-run artifact transport retains the independently sealed receipt.
 * @param {string} root @param {readonly string[]} products @returns {()=>void} */
export function beginProgramInputProof(root,products) {
  const registry=JSON.parse(readFileSync(resolve(root,'scripts/source-generation-outputs.json'),'utf8'));
  /** @type {Set<string>} */
  const outputs=new Set(Object.values(registry.producers).flat());
  const source=file=>!outputs.has(file)&&!file.includes('.generated.')&&!file.includes('/.wildshard/')&&!file.includes('/node_modules/');
  const tracked=()=>execFileSync('git',['ls-files','-z','--','src','scripts','lint','vite','budgets','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(file=>file!==''&&source(file)).sort();
  const inputs=tracked(),memo=new InputHashMemo(root);
  memo.enableSnapshot(file=>outputs.has(file)||!source(file));
  for(const file of inputs)memo.hash(file);
  const identity=sourceSnapshotIdentity({node:process.version,platform:process.platform,arch:process.arch,products,inputs});
  return ()=>{
    if(JSON.stringify(inputs)!==JSON.stringify(tracked()))throw new Error('Source-program input inventory changed');
    memo.verifySnapshot();
    /** @type {Record<string,string>} */
    const hashes={};
    for(const file of outputs)if(existsSync(resolve(root,file)))hashes[file]=memo.hash(file,true);
    publishSourceSnapshot(resolve(root,'.cache/generation-phase.json'),identity,memo,hashes);
  };
}
