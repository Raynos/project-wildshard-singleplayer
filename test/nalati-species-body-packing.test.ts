import { originalSpeciesJson, originalSpeciesFile, originalSpeciesOutput } from './fixtures/nalati-original-species';
// oxlint-disable-next-line import/no-nodejs-modules -- Check complete original species files and authored body bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the existing native compression stream exactly.
import { deflateSync, inflateSync } from 'node:zlib';
import { checkNalatiSpeciesSource } from './fixtures/check-nalati-species-source';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle only the pure source entry without publishing a file.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { unshuffleLanes } from '../src/engine/core/deflate';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { CompactSpeciesBodiesSchema } from '../src/format/speciesLooks';
import { packNalatiSpeciesBodies, type SpeciesBodySource } from '../src/shards/nalati-grasslands/generators/speciesBodyPacking';
import originals from './fixtures/nalati-species-files.json' with { type: 'json' };

const parts=v.array(v.array(v.number()));
const bodyRows=v.parse(v.object({bytes:v.number(),bodies:v.array(v.object({key:v.string(),bones:v.unknown(),dims:v.unknown(),fur:parts,hard:parts,eye:parts}))}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/bodies.json','utf8')));
const raw=unshuffleLanes(inflateSync(readFileSync('public/assets/nalati/baked/bodies.bin')));
const original=v.parse(v.object({packedBodies:v.object({file:v.string(),bytes:v.number(),bodies:v.unknown()}),
  presentation:v.object({packedBodies:CompactSpeciesBodiesSchema})}),originalSpeciesJson('species.json'));

test('pure packing preserves all 27 bodies, complete metadata and original compressed bytes with detached results',()=>{
  const sourceJson=JSON.stringify(bodyRows),sourceHash=hashImmutableBytes(raw);
  const padded=new Uint8Array(raw.length+19);padded.set(raw,11);
  const made=packNalatiSpeciesBodies(bodyRows,padded.subarray(11,11+raw.length));
  expect(made.bodies).toHaveLength(27);
  expect({file:original.packedBodies.file,bytes:made.bytes.length,bodies:made.bodies}).toEqual(original.packedBodies);
  expect({file:original.packedBodies.file,bytes:made.bytes.length,attrs:made.attrs,skeletons:made.skeletons,rows:made.rows}).toEqual(original.presentation.packedBodies);
  const packed=originalSpeciesFile('bodies.bin'),expanded=inflateSync(packed);
  expect(Buffer.compare(made.bytes,expanded)).toBe(0);
  expect(Buffer.compare(deflateSync(made.bytes,{level:9}),packed)).toBe(0);
  expect(hashImmutableBytes(packed)).toBe(original.packedBodies.file.split('bodies-')[1]?.replace('.bin',''));
  expect(JSON.stringify(bodyRows)).toBe(sourceJson);expect(hashImmutableBytes(raw)).toBe(sourceHash);
  made.bytes.fill(0);const first=made.bodies[0];if(first===undefined)throw new Error('Missing packed body');first.bones={changed:true};
  const attribute=made.attrs[0];if(attribute===undefined)throw new Error('Missing packed channel');attribute[0]='mutated';
  const rebuilt=packNalatiSpeciesBodies(bodyRows,raw);
  expect(Buffer.compare(rebuilt.bytes,expanded)).toBe(0);
  expect({file:original.packedBodies.file,bytes:rebuilt.bytes.length,bodies:rebuilt.bodies}).toEqual(original.packedBodies);
  expect(JSON.stringify(bodyRows)).toBe(sourceJson);expect(hashImmutableBytes(raw)).toBe(sourceHash);
});

test('pairing a 65-part list widens rebased indices and retains both material groups',()=>{
  const counts=[40000,30000,...Array.from({length:63},()=>0)],length=counts.reduce((n,count)=>n+count*72+(count>0?8:0),0);
  const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);let offset=0;
  const fur=counts.map((count,index)=>{
    if(count===0)return[0,0];
    bytes.fill(37+index,offset,offset+count*72);offset+=count*72;
    view.setUint16(offset,0,true);view.setUint16(offset+2,count-1,true);view.setUint16(offset+4,1,true);offset+=8;
    return[count,3,0,3,4+index];
  });
  const input:SpeciesBodySource={bytes:length,bodies:[{key:'horse:test',bones:[],dims:{},fur,hard:[],eye:[]}]};
  const made=packNalatiSpeciesBodies(input,bytes),body=made.bodies[0];if(body===undefined)throw new Error('Missing paired body');
  expect(body.fur).toHaveLength(33);const first=body.fur[0];if(first===undefined)throw new Error('Missing paired part');
  expect(first.row.count).toBe(70000);expect(first.row.index).toBe('u32');expect(first.row.indexCount).toBe(6);
  expect(first.groups).toEqual([[0,3,4],[3,3,5]]);
  const at=first.offsets[7];if(at===undefined)throw new Error('Missing paired indices');
  const result=new DataView(made.bytes.buffer,made.bytes.byteOffset+at,24);
  expect(Array.from({length:6},(_,i)=>result.getUint32(i*4,true))).toEqual([0,39999,1,40000,69999,40001]);
});

test('truncated bytes, incomplete layouts, fractional counts and corrupt indices refuse',()=>{
  expect(()=>packNalatiSpeciesBodies(bodyRows,raw.subarray(1))).toThrow('source byte length');
  expect(()=>packNalatiSpeciesBodies({...bodyRows,bodies:bodyRows.bodies.slice(1)},raw)).toThrow('offsets do not cover');
  for(const fur of [[[1.5,0]],[[0,0,1]]])expect(()=>packNalatiSpeciesBodies({bytes:0,bodies:[{key:'bad:x',bones:[],dims:{},fur,hard:[],eye:[]}]},new Uint8Array())).toThrow('Invalid creature body part layout');
  const bytes=new Uint8Array(80);new DataView(bytes.buffer).setUint16(72,2,true);
  expect(()=>packNalatiSpeciesBodies({bytes:80,bodies:[{key:'bad:x',bones:[],dims:{},fur:[[1,3]],hard:[],eye:[]}]},bytes)).toThrow('index exceeds its source part');
});

test('the actual species source preserves all five complete original files',()=>{
  checkNalatiSpeciesSource();
  expect(originals).toHaveLength(5);
  for(const pin of originals){const bytes=originalSpeciesOutput(pin.path);expect(bytes.length,pin.path).toBe(pin.bytes);expect(hashImmutableBytes(bytes),pin.path).toBe(pin.sha256);}
});

test('body packing remains one pure publication-free author chunk',async()=>{
  const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,
    lib:{entry:resolve('src/shards/nalati-grasslands/generators/speciesBodyPacking.ts'),formats:['es']},rolldownOptions:{output:{codeSplitting:false}}}});
  const built=Array.isArray(result)?result[0]:result;if(built===undefined||!('output'in built))throw new Error('Missing pure species packer');
  const chunks=built.output.filter(row=>row.type==='chunk');expect(chunks).toHaveLength(1);
  for(const chunk of chunks){expect(chunk.imports).toEqual([]);expect(chunk.dynamicImports).toEqual([]);expect(Object.keys(chunk.modules)).toHaveLength(1);}
});
