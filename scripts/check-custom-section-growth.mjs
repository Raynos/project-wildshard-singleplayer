// G518: run after the gate's build, in its immutable mirror. Never build twice.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as v from 'valibot';
import {customSectionGrowthFailures} from './custom-section-policy.mjs';
import {outputSections} from './shard-platform-output.mjs';

const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const measures=v.record(v.string(),v.strictObject({count:natural,bytes:natural}));
const receipt=v.strictObject({revision:v.string(),shards:measures});

/** Old gates did not retain measurements. The committed, exact-base ruler
 * reports every excess. For non-excess metrics its budget is an upper bound:
 * any candidate exceeding that bound necessarily grew. No approximation can
 * grant growth above a budget. Missing/stale reports refuse, never build.
 * @param {string} base @param {Record<string,number>} budgets @param {unknown} report
 * @returns {Record<string,{count:number;bytes:number}>} */
export function rulerSectionBase(base,budgets,report) {
  const ruler=v.parse(v.object({revision:v.literal(base),customSectionFailures:v.array(v.string())}),report);
  const shards={};
  for(const [key,value]of Object.entries(budgets)) {
    const match=/^custom-sections\/([^/]+)\/(count|bytes)$/u.exec(key);
    if(match===null)continue;
    const [,slug,unit]=match;
    (shards[slug]??={})[unit]=value;
  }
  for(const failure of ruler.customSectionFailures) {
    const match=/^([^:]+): custom-section (count|bytes) (\d+) exceeds (\d+)$/u.exec(failure);
    if(match===null)throw new Error(`Cannot recover pushed-base sections: ${failure}`);
    const [,slug,unit,value,budget]=match;
    if(shards[slug]?.[unit]!==Number(budget))throw new Error(`Pushed-base ruler budget mismatch: ${failure}`);
    shards[slug][unit]=Number(value);
  }
  return v.parse(measures,shards);
}

/** @param {string} root @param {string} repo @param {string} base @param {string} revision @param {string} receipts */
export function checkCustomSectionGrowth(root,repo,base,revision,receipts) {
  const gitJson=spec=>JSON.parse(execFileSync('git',['show',spec],{cwd:repo,encoding:'utf8',maxBuffer:16<<20}));
  const budgets=JSON.parse(readFileSync(resolve(root,'lint/ratchet.json'),'utf8')).budgets;
  // Enumerate projects, not existing outputs: a missing product must refuse.
  const projects=execFileSync('git',['ls-tree','-r','--name-only',revision,'--','src/shards'],{cwd:repo,encoding:'utf8'})
    .split('\n').flatMap(path=>/^src\/shards\/([^/]+)\/shard.config.ts$/u.exec(path)?.slice(1)??[]);
  const after=Object.fromEntries(projects.map(slug=>{
    const row=outputSections(root,slug);
    return [slug,{count:row.customSections.length,bytes:row.customSectionBytes}];
  }));
  const previous=resolve(receipts,`${base}.json`);
  let before;
  if(existsSync(previous)) {
    const saved=v.parse(receipt,JSON.parse(readFileSync(previous,'utf8')));
    if(saved.revision!==base)throw new Error('Custom-section receipt does not match pushed base');
    before=saved.shards;
  } else {
    // This fallback is only for migration from gates predating G518. Read the
    // committed report (progress/ is deliberately excluded from build mirrors).
    try {before=rulerSectionBase(base,gitJson(`${base}:lint/ratchet.json`).budgets,
      gitJson(`${revision}:progress/shard-platform/ruler/ruler.json`));}
    catch(error){throw new Error(`Missing custom-section measurement for pushed base ${base}: ${error instanceof Error?error.message:String(error)}`,{cause:error});}
  }
  const failures=customSectionGrowthFailures(budgets,before,after);
  if(failures.length===0) {
    mkdirSync(receipts,{recursive:true});
    const destination=resolve(receipts,`${revision}.json`),temporary=`${destination}.${process.pid}`;
    writeFileSync(temporary,JSON.stringify({revision,shards:after}));renameSync(temporary,destination);
  }
  return failures;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href) {
  const [repo,base,revision,receipts]=process.argv.slice(2);
  if(!repo||!base||!revision||!receipts)throw new Error('Usage: check-custom-section-growth.mjs <repo> <base> <revision> <receipts>');
  const failures=checkCustomSectionGrowth(process.cwd(),repo,base,revision,receipts);
  for(const failure of failures)console.error(failure);
  process.exitCode=failures.length>0?1:0;
}
