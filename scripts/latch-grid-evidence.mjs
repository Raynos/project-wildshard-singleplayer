#!/usr/bin/env node
// Record only qualified measured passes. Existing latches are immutable here; regression removal is manual.
// node scripts/latch-grid-evidence.mjs --receipt=PATH --commit=RECEIPT_COMMIT --shards=a,b
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import * as v from 'valibot';
import {GRID_READY_LATCHES,GridReadyLatchesSchema} from './grid-ready-latches.mjs';
import {runtimeGridEvidence} from './grid-runtime-evidence.mjs';

const arg=key=>process.argv.find(value=>value.startsWith(`--${key}=`))?.slice(key.length+3)??'';
const root=resolve(import.meta.dirname,'..'),receipt=arg('receipt'),receiptCommit=arg('commit'),shards=arg('shards').split(',');
if(!receipt||!/^[a-f0-9]{40}$/u.test(receiptCommit)||shards.some(slug=>slug===''))throw new Error('Requires --receipt, full --commit, --shards');
const bytes=readFileSync(resolve(root,receipt));
const committed=execFileSync('git',['show',`${receiptCommit}:${receipt}`],{cwd:root});
if(!bytes.equals(committed))throw new Error('Receipt differs from its committed observation');
const observation=JSON.parse(bytes.toString('utf8')),source=observation.source??observation.sha;
if(typeof source!=='string'||!/^[a-f0-9]{40}$/u.test(source))throw new Error('Missing measured source SHA');
const path=resolve(root,GRID_READY_LATCHES);
const latches=v.parse(GridReadyLatchesSchema,existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{schema:'grid-ready-latches/1',entries:[]});
const caps=JSON.parse(readFileSync(resolve(root,'src/format/memoryGates.json'),'utf8'));
for(const shard of shards) {
 const criteria=runtimeGridEvidence(root,shard,source,[receipt],caps);
 for(const criterion of /** @type {const} */ (['memory','oneFrameLooks'])) {
  if(latches.entries.some(row=>row.shard===shard&&row.criterion===criterion))continue;
  if(criteria[criterion]?.verdict!=='pass')continue;
  latches.entries.push({shard,criterion,source,receiptCommit,receipt,latchedAt:new Date().toISOString()});
  console.info(`Latched ${shard} ${criterion} from ${receiptCommit}:${receipt}`);
 }
}
latches.entries.sort((a,b)=>a.shard.localeCompare(b.shard)||a.criterion.localeCompare(b.criterion));
mkdirSync(dirname(path),{recursive:true});writeFileSync(path,`${JSON.stringify(latches,null,2)}\n`);
