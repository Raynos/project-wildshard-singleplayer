import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { componentInventory } from '../shard-components.mjs';

const count=v.pipe(v.number(),v.integer(),v.minValue(0));
const component=v.picklist(['C1','C2','C3','C4','C5','C6','C7','C8','C9']);
const span=v.strictObject({path:v.string(),symbol:v.nullable(v.string()),
  kind:v.picklist(['runtime-ts','additional-glsl','sole-module','sole-export']),component,lines:count,
  start:v.exactOptional(count),end:v.exactOptional(count),reason:v.string()});
const report=v.strictObject({schema:v.literal('shard-platform-spans/1'),measurement:v.literal('source'),
  shard:v.pipe(v.string(),v.regex(/^[a-z0-9_-]+$/u)),total:v.nullable(count),
  counts:v.nullable(v.record(component,count)),spans:v.nullable(v.array(span)),
  unknown:v.nullable(v.array(v.string())),measurementError:v.nullable(v.string())});

/** Publish the existing verified census; never build or count ownership again.
 * @param {string} root
 * @param {Partial<Record<string,import('./ruler-spans.mjs').RulerSpanInput>>} inventory
 * @param {readonly string[]} slugs
 * @param {string|null} measurementError */
export function rulerSpanReports(root,inventory,slugs,measurementError) {
  return Object.fromEntries(slugs.map(shard=>{
    if(measurementError!==null)return [shard,{schema:'shard-platform-spans/1',measurement:'source',shard,
      total:null,counts:null,spans:null,unknown:null,measurementError}];
    const row=inventory[shard];
    if(row?.customSources===undefined)throw new Error(`Ruler: missing source spans for ${shard}`);
    const measured=row.components??componentInventory(root,shard,row.customSources,row.conversion.customRuntimeLines);
    return [shard,{schema:'shard-platform-spans/1',measurement:'source',shard,
      total:measured.total,counts:measured.counts,spans:measured.spans,unknown:measured.unknown,measurementError:null}];
  }));
}

/** Preflight the complete bank before publishing same-revision sibling files.
 * Unknown measurements overwrite old spans with explicit nulls, never zeros.
 * @param {string} directory @param {unknown} input @param {string} revision */
export function writeRulerSpans(directory,input,revision) {
  v.parse(v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u)),revision);
  const rows=v.parse(v.record(v.string(),report),input);
  for(const [slug,row] of Object.entries(rows)) {
    if(slug!==row.shard)throw new Error('Ruler: span shard identity mismatch');
    if(row.measurementError===null) {
      if(row.spans===null||row.counts===null||row.total===null||row.unknown===null
        ||row.spans.reduce((sum,entry)=>sum+entry.lines,0)!==row.total
        ||Object.keys(row.counts).length!==9
        ||Object.values(row.counts).reduce((sum,value)=>sum+value,0)!==row.total
        ||Object.entries(row.counts).some(([key,value])=>row.spans?.filter(entry=>entry.component===key).reduce((sum,entry)=>sum+entry.lines,0)!==value))throw new Error('Ruler: incomplete span totals');
    } else if(row.total!==null||row.counts!==null||row.spans!==null||row.unknown!==null)throw new Error('Ruler: failed span measurement claims counts');
  }
  mkdirSync(directory,{recursive:true});
  for(const [slug,row] of Object.entries(rows)) {
    const file=resolve(directory,`spans-${slug}.json`);
    writeFileSync(`${file}.tmp`,`${JSON.stringify({...row,revision},null,1)}\n`);
    renameSync(`${file}.tmp`,file);
  }
}
