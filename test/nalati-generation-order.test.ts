// oxlint-disable-next-line import/no-nodejs-modules -- Validate the shipping producer catalogue, not a hand-made fixture.
import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as v from 'valibot';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };
import speciesOriginals from './fixtures/nalati-species-files.json' with { type: 'json' };
import heldOriginals from './fixtures/nalati-held-files.json' with { type: 'json' };

it('retires species and held publishers while the source entry owns native construction',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string())}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 expect(jobs.some(job=>job.id==='nalati-species')).toBe(false);
 expect(jobs.some(job=>job.id==='nalati-held-weapons')).toBe(false);
 for(const pin of [...speciesOriginals,...heldOriginals]){
  expect(existsSync(pin.path),pin.path).toBe(false);
  for(const job of jobs){expect(job.inputRoots,job.id).not.toContain(pin.path);expect(job.outputs,job.id).not.toContain(pin.path);}
 }
 expect(readFileSync('src/shards/nalati-grasslands/generators/bake-species.mjs','utf8')).not.toMatch(/\bbyteWriter\b/u);
});

it('retires public painted publication while cover and map use defining authored producers',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string()),catalogueDependencies:v.optional(v.array(v.string()),[])}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 expect(jobs.some(job=>job.id==='nalati-model-paint')).toBe(false);
 // GR6: cover and the map left the scheduler; their build-time producers read the defining painter directly
 for(const id of ['nalati-cover','nalati-data-map'])expect(jobs.some(job=>job.id===id)).toBe(false);
 expect(readFileSync('src/shards/nalati-grasslands/generators/coverBake.mjs','utf8')).toContain("from './modelPaint.mjs'");
 expect(readFileSync('src/shards/nalati-grasslands/generators/mapAssembly.mjs','utf8')).toContain("from './modelPaintProgram.ts'");
 expect(originals).toHaveLength(43);
 for(const pin of originals)expect(existsSync(`public/assets/nalati/baked/painted-models/${pin.file}`),pin.file).toBe(false);
});

it('owns grass keep-outs through the build-time native placements',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string()}))}),JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 // GR6: the grass left the scheduler; the product bakes it over the lattice and the native dressing placements
 expect(jobs.some(job=>job.id==='nalati-grass')).toBe(false);
 expect(readFileSync('src/shards/nalati-grasslands/generators/output.ts','utf8')).toContain('nalatiGrassBake(bytes, await nalatiDressingPlacementProgram(ctx))');
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
