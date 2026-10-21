import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as v from 'valibot';

export const GRID_READY_LATCHES='progress/shard-platform/grid-ready-latches.json';
const sha=v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u));
export const GridReadyLatchesSchema=v.pipe(v.strictObject({schema:v.literal('grid-ready-latches/1'),entries:v.array(v.strictObject({
 shard:v.string(),criterion:v.picklist(['memory','oneFrameLooks']),source:sha,receiptCommit:sha,receipt:v.string(),latchedAt:v.string(),quiet:v.optional(v.boolean()),
}))}),v.check(value=>new Set(value.entries.map(row=>`${row.shard}:${row.criterion}`)).size===value.entries.length,'Duplicate grid-ready latch'));

/** A measured pass is trusted until a person removes its entry for a real regression (G560).
 * Product changes, runtime changes, receipt checksums and later failing samples never expire a latch.
 * @param {string} root @param {string} slug
 * @returns {Partial<Record<'memory'|'oneFrameLooks',import('./shard-milestones.mjs').Criterion>>} */
export function latchedGridEvidence(root,slug) {
 const path=resolve(root,GRID_READY_LATCHES);if(!existsSync(path))return {};
 const latches=v.parse(GridReadyLatchesSchema,JSON.parse(readFileSync(path,'utf8')));
 return Object.fromEntries(latches.entries.filter(row=>row.shard===slug).map(row=>[row.criterion,{verdict:'pass',
  evidence:`${GRID_READY_LATCHES}: latched G560 pass; source ${row.source}; receipt ${row.receiptCommit}:${row.receipt}${row.quiet===undefined?'':`; quiet ${row.quiet}`}; retained until manual regression removal`} ]));
}
