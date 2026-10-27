import { halfFloatBeforeControl } from './fixtures/half-float-before-control';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the isolated historical-control cache only.
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the same bounded source/public roots as the current fixture.
import { resolve } from 'node:path';
import { nineCastsProgram } from '../src/shards/nine-dragon-stack/generators/castsProgram';
import { layout as sourceLayout } from './fixtures/nine-product-inputs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture records hashes, never encoded binary payloads.
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {build} from 'vite';
import {parseGlb} from '../src/sdk/assets';
import {assertConfigBoundary} from '../src/sdk/configBoundary';

import {nineCastBlobs, CASTS} from './fixtures/nine-cast-blobs';
import {bakeFixedKits,readFixedSlots} from '../src/shards/nine-dragon-stack/generators/casts';
import {hookProduct} from '../src/shards/nine-dragon-stack/generators/hookProduct';
import baseline from './fixtures/nine-binary-outputs.json' with {type:'json'};

const CAST_BLOBS=await nineCastBlobs();
const original = await halfFloatBeforeControl(async () => {
  mkdirSync('tmp', { recursive: true });
  const cache = mkdtempSync(resolve('tmp', 'nine-binary-before-'));
  try {
    return await nineCastsProgram(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'b'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]));
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');
test('every named cast retains its frozen pre-correction metadata and GLB byte control',()=>{
  expect([...original.blobs, ...CAST_BLOBS.filter(row=>row.file.kind!=='glb')].map(row=>row.file)).toStrictEqual(baseline.castFiles);
  for(const row of baseline.casts){
    const bytes=row.name==='dragon-hook'?original.blobs.find(blob=>blob.file.name==='geometry/dragon-hook.glb')?.bytes:original.raw.get(row.name);
    if(bytes===undefined)throw new Error('Missing source hook');
    expect(bytes.length,row.name).toBe(row.length);expect(hash(bytes),row.name).toBe(row.hash);
  }
});
test('corrected casts keep their names, exact admitted costs and original draw/triangle counts',()=>{
  expect(CASTS.blobs.map(row=>row.file.name)).toEqual(original.blobs.map(row=>row.file.name));
  for(const blob of CASTS.blobs){
    const previous=original.blobs.find(row=>row.file.name===blob.file.name);
    if(previous===undefined)throw new Error('Missing cast before-control');
    const cost=parseGlb(blob.bytes);
    expect(blob.file).toMatchObject({hash:hash(blob.bytes),compressed:blob.bytes.byteLength,...cost});
    expect(cost.triangles,blob.file.name).toBe(previous.file.triangles);
    expect(cost.draws,blob.file.name).toBe(previous.file.draws);
  }
});
test('the fixed-kit before-control preserves neutral spill and every frozen raw GLB byte',async()=>{
  const layout:unknown=sourceLayout;
  const fixed=await halfFloatBeforeControl(()=>Promise.resolve(bakeFixedKits(readFixedSlots(layout))));
  for(const[name,bytes]of fixed.packs){
    const expected=baseline.casts.find(row=>row.name===name);
    if(expected===undefined)throw new Error(`Missing original fixed kit ${name}`);
    expect(bytes.length,name).toBe(expected.length);expect(hash(bytes),name).toBe(expected.hash);
  }
  for(const geometry of fixed.geometries.values())geometry.dispose();
});
test('the hook producer returns the same original GLB and material without encoding it',async()=>{
  const row=await hookProduct(url=>new Uint8Array(readFileSync(`public${url}`))),expected=baseline.casts.find(value=>value.name==='dragon-hook');
  if(expected===undefined)throw new Error('Missing hook byte witness');
  expect(row.glb).toBeInstanceOf(Uint8Array);expect(hash(row.glb)).toBe(expected.hash);expect(row.material).toStrictEqual(CASTS.material);
});
test.each(['castSources','signAtlasSources'])('%s declarations bundle without file services; SDK reads later',async entry=>{
  const built=await build({configFile:false,publicDir:false,logLevel:'silent',build:{write:false,minify:false,
    lib:{entry:`src/shards/nine-dragon-stack/generators/${entry}.ts`,formats:['es']},rolldownOptions:{external:[/^node:/u]}}});
  const outputs=(Array.isArray(built)?built:[built]).flatMap(bundle=>'output' in bundle?bundle.output:[]),chunks=outputs.filter(row=>row.type==='chunk');
  expect(chunks).toHaveLength(1);
  for(const chunk of chunks)expect(()=>assertConfigBoundary([...chunk.imports,...chunk.dynamicImports])).not.toThrow();
},30_000);
