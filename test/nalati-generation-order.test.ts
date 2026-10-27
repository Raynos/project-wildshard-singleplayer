// oxlint-disable-next-line import/no-nodejs-modules -- Validate the shipping producer catalogue, not a hand-made fixture.
import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };
import speciesOriginals from './fixtures/nalati-species-files.json' with { type: 'json' };
import heldOriginals from './fixtures/nalati-held-files.json' with { type: 'json' };

it('retires species and held publishers while the source entry owns native construction',()=>{
 for(const pin of [...speciesOriginals,...heldOriginals]){
  expect(existsSync(pin.path),pin.path).toBe(false);
 }
 expect(readFileSync('src/shards/nalati-grasslands/generators/bake-species.mjs','utf8')).not.toMatch(/\bbyteWriter\b/u);
});

it('retires public painted publication while cover and map use defining authored producers',()=>{
 expect(readFileSync('src/shards/nalati-grasslands/generators/coverBake.mjs','utf8')).toContain("from './modelPaint.mjs'");
 expect(readFileSync('src/shards/nalati-grasslands/generators/mapAssembly.mjs','utf8')).toContain("from './modelPaintProgram.ts'");
 expect(originals).toHaveLength(43);
 for(const pin of originals)expect(existsSync(`public/assets/nalati/baked/painted-models/${pin.file}`),pin.file).toBe(false);
});

it('owns grass keep-outs through the build-time native placements',()=>{
 expect(readFileSync('src/shards/nalati-grasslands/generators/output.ts','utf8')).toContain('nalatiGrassBake(bytes, await nalatiDressingPlacementProgram(ctx))');
});

it('retires the dressing publisher and all eighteen physical row handoffs',()=>{
 const groups=['boulder','slab','stone','juniper','rose','willow','lupin','daisy','reed','logs','stumps','ovoos','poles','fences','gates','drifts','colliders','clutter'];
 expect(groups).toHaveLength(18);
 for(const group of groups)expect(existsSync(`src/shards/nalati-grasslands/data/dressing-${group}.generated.json`),group).toBe(false);
});
