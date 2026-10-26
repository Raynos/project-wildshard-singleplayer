// oxlint-disable-next-line import/no-nodejs-modules -- Validate the shipping producer catalogue, not a hand-made fixture.
import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as v from 'valibot';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };
import speciesOriginals from './fixtures/nalati-species-files.json' with { type: 'json' };

it('retires species publication while held metadata owns its explicit source constructor',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string())}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 expect(jobs.some(job=>job.id==='nalati-species')).toBe(false);
 const held=jobs.find(job=>job.id==='nalati-held-weapons');
 if(held===undefined)throw new Error('Missing held source consumer');
 expect(held.inputRoots).toContain('src/shards/nalati-grasslands/generators/bake-species.mjs');
 for(const pin of speciesOriginals){
  expect(existsSync(pin.path),pin.path).toBe(false);
  for(const job of jobs){expect(job.inputRoots,job.id).not.toContain(pin.path);expect(job.outputs,job.id).not.toContain(pin.path);}
 }
 expect(readFileSync('src/shards/nalati-grasslands/generators/bake-species.mjs','utf8')).not.toMatch(/\bbyteWriter\b/u);
});

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

it('owns grass keep-outs through explicit native terrain and scalar inputs',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string()),buildTimeOutputs:v.optional(v.array(v.string()),[])}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 const grass=jobs.find(job=>job.id==='nalati-grass');
 if(grass===undefined)throw new Error('Missing Nalati producer');
 const coverInputs=grass.inputRoots.filter(file=>file.includes('/dressing-')&&file.endsWith('.generated.json'));
 expect(coverInputs).toEqual([]);
 expect(grass.inputRoots).toContain('src/shards/nalati-grasslands/generators/nativeDressingPlacements.mjs');
 expect(grass.inputRoots).toContain('src/shards/nalati-grasslands/generators/dressingPlacementProgram.ts');
 expect(grass.inputRoots).toContain('public/assets/baked/nalati-grasslands/terrain.bin');
 for(const field of ['pond','red','green','blue','forest'])expect(grass.inputRoots).toContain(`src/shards/nalati-grasslands/data/geography-${field}.bin`);
});

it('retires the dressing publisher and all eighteen physical row handoffs',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string())}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 expect(jobs.some(job=>job.id==='nalati-dressing-plan')).toBe(false);
 for(const job of jobs)for(const file of [...job.inputRoots,...job.outputs])expect(file.includes('/dressing-')&&file.endsWith('.generated.json'),job.id).toBe(false);
 const groups=['boulder','slab','stone','juniper','rose','willow','lupin','daisy','reed','logs','stumps','ovoos','poles','fences','gates','drifts','colliders','clutter'];
 expect(groups).toHaveLength(18);
 for(const group of groups)expect(existsSync(`src/shards/nalati-grasslands/data/dressing-${group}.generated.json`),group).toBe(false);
});
