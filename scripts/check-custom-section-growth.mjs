// G518: run after the gate's build, in its immutable mirror. Never build twice.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as v from 'valibot';
import {customSectionGrowthFailures} from './custom-section-policy.mjs';
import {outputSections} from './shard-platform-output.mjs';
import {legacyInventory} from './legacy-shards.mjs';

const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const measures=v.record(v.string(),v.strictObject({count:natural,bytes:natural}));
const receipt=v.strictObject({revision:v.string(),shards:measures});

/** @param {string} root @param {string} repo @param {string} base @param {string} revision @param {string} receipts */
export function checkCustomSectionGrowth(root,repo,base,revision,receipts) {
  const budgets=JSON.parse(readFileSync(resolve(root,'lint/ratchet.json'),'utf8')).budgets;
  const frozen=legacyInventory(root).shards;
  // Enumerate projects, not existing outputs: a missing product must refuse.
  const projects=execFileSync('git',['ls-tree','-r','--name-only',revision,'--','src/shards'],{cwd:repo,encoding:'utf8'})
    .split('\n').flatMap(path=>/^src\/shards\/([^/]+)\/shard.config.ts$/u.exec(path)?.slice(1)??[])
    .filter(slug=>!Object.hasOwn(frozen,slug));
  const after=Object.fromEntries(projects.map(slug=>{
    const row=outputSections(root,slug);
    return [slug,{count:row.customSections.length,bytes:row.customSectionBytes}];
  }));
  const previous=resolve(receipts,`${base}.json`);
  const needsBase=Object.entries(after).some(([slug,row])=>['count','bytes'].some(unit=>row[unit]>budgets[`custom-sections/${slug}/${unit}`]));
  let before;
  // A shard fitting both budgets needs no historical measurement to grow.
  if(!needsBase) {
    before={};
  } else if(existsSync(previous)) {
    const saved=v.parse(receipt,JSON.parse(readFileSync(previous,'utf8')));
    if(saved.revision!==base)throw new Error('Custom-section receipt does not match pushed base');
    before=saved.shards;
  } else {
    throw new Error(`Missing custom-section measurement for pushed base ${base}; exact receipt required`);
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
