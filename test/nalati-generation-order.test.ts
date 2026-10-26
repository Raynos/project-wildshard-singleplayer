// oxlint-disable-next-line import/no-nodejs-modules -- Validate the shipping producer catalogue, not a hand-made fixture.
import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as v from 'valibot';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };

it('retires public painted publication while cover and map use defining authored producers',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string()),catalogueDependencies:v.optional(v.array(v.string()),[])}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 expect(jobs.some(job=>job.id==='nalati-model-paint')).toBe(false);
 for(const id of ['nalati-cover','nalati-data-map']){
  const job=jobs.find(row=>row.id===id);if(job===undefined)throw new Error('Missing native Nalati consumer');
  expect(job.inputRoots).toContain('src/shards/nalati-grasslands/generators/modelPaint.mjs');
  expect(job.catalogueDependencies).not.toContain('nalati-model-paint');
  expect(job.inputRoots.some(file=>file.endsWith('/bake-model-paint.mjs'))).toBe(false);
 }
 expect(originals).toHaveLength(43);
 for(const pin of originals)expect(existsSync(`public/assets/nalati/baked/painted-models/${pin.file}`),pin.file).toBe(false);
});

it('prepares the dressing keep-outs before the grass coverage reader',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string()),buildTimeOutputs:v.optional(v.array(v.string()),[])}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 const dressing=jobs.find(job=>job.id==='nalati-dressing-plan');
 const grass=jobs.find(job=>job.id==='nalati-grass');
 if(dressing===undefined||grass===undefined)throw new Error('Missing Nalati producer');
 const coverInputs=grass.inputRoots.filter(file=>file.includes('/dressing-')&&file.endsWith('.generated.json'));
 expect(coverInputs.length).toBeGreaterThan(0);
 expect(jobs.indexOf(dressing)).toBeLessThan(jobs.indexOf(grass));
 for(const file of coverInputs){
  expect(dressing.outputs).toContain(file);
  expect(dressing.buildTimeOutputs).toContain(file);
 }
});
