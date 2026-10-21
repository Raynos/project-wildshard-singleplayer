// A verified local generation phase can survive cache eviction. Every use
// rechecks its current source bytes, source inventories and admitted outputs.
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import * as v from 'valibot';

const path=v.pipe(v.string(),v.check(value=>value.length>0&&!isAbsolute(value)&&!value.includes('\\')&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')));
const hash=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
const Snapshot=v.strictObject({schema:v.literal('generation-phase/1'),root:v.string(),identity:hash,inputs:v.record(path,hash),trees:v.record(path,v.array(path)),outputs:v.record(path,hash),seal:hash});
/** @param {unknown} value */
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Missing, partial, crossed or changed evidence always falls back to jobs.
 * @param {string} file @param {string} identity
 * @param {import('./bake-input-hashes.mjs').InputHashMemo} memo @param {string[]} outputs */
export function verifiedGenerationSnapshot(file,identity,memo,outputs) {
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
export function publishGenerationSnapshot(file,identity,memo,outputs) {
  const source=memo.snapshotData();memo.verifyInputs(outputs);
  const body={schema:'generation-phase/1',root:memo.root,identity,...source,outputs};
  const temporary=`${file}.${process.pid}-${randomBytes(8).toString('hex')}.tmp`;
  try {mkdirSync(dirname(file),{recursive:true});writeFileSync(temporary,JSON.stringify({...body,seal:digest(body)}));renameSync(temporary,file);}
  catch {try {rmSync(temporary,{force:true});} catch { /* A metadata failure leaves the ordinary job path available. */ }}
}

/** Bind the exact validated recipe and current controller/runtime/tool bytes.
 * @param {unknown} value */
export function generationSnapshotIdentity(value) {return digest(value);}
