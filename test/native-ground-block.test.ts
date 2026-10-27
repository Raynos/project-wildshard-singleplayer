import { originalNalatiPhysics } from './fixtures/nalati-physics-original';
import {originalNativeGround} from './fixtures/native-bake-inline';
// oxlint-disable-next-line import/no-nodejs-modules -- Assert the captured native authoring bytes, not a browser asset alias.
import { readFileSync } from 'node:fs';
import { expect,test } from 'vitest';
import * as v from 'valibot';
import { nativeGroundRecordSchema } from '../src/format/nativePhysics';
import { nativeBakeGround,createNativeBakeReader } from '../src/game/population/nativeBake';
import { hashImmutableBytes } from '../src/sdk/immutable';

const file='data/physics-ground.bin';
const rows={label:'Orchard',resolution:2,size:4,parked:false,rig:'segments',provenance:'piece',shapes:[1,2,6,9]};
const field={rows:1,cols:1,friction:.9,groups:1,scale:{x:4,y:1,z:4},at:{x:0,y:0,z:0}};
const values=Float32Array.from([-0,1.25,-2,3]),bytes=new Uint8Array(values.buffer);
const inline=btoa(String.fromCodePoint(...bytes));
const input={version:1,ground:{...field,heights:{file}},solids:[],actors:[],herds:[]};

test('raw floor admission is explicit, strict and bounded; original callers retain their grammar',()=>{
  const original=nativeGroundRecordSchema(2),raw=nativeGroundRecordSchema(2,true);
  expect(v.parse(original,{...field,heights:inline})).toEqual({...field,heights:inline});
  expect(()=>v.parse(original,input.ground)).toThrow();expect(v.parse(raw,input.ground)).toEqual(input.ground);
  for(const heights of [{file:'../floor.bin'},{file:'/floor.bin'},{file:'floor.json'},{file:'floor.bin',extra:1}])
    expect(()=>v.parse(raw,{...field,heights})).toThrow();
});

test('the same native reader owns copied raw f32 bytes and retains memoized output',()=>{
  const transport=Uint8Array.from(bytes),block={file,bytes:transport};
  const reader=createNativeBakeReader(input,rows,block),actual=reader.read();
  const original={ground:originalNativeGround({...field,heights:inline},2,4,'Orchard'),solids:[],actors:[],parked:[],herds:[]};
  expect(actual).toEqual(original);expect(Object.is(actual.ground.heights[0],-0)).toBe(true);
  expect(reader.read()).toBe(actual);expect(actual.ground.heights.buffer).not.toBe(transport.buffer);
  transport.fill(0);expect(actual).toEqual(original);
  const second=createNativeBakeReader(input,rows,{file,bytes}).read();
  expect(second.ground.heights.buffer).not.toBe(actual.ground.heights.buffer);
});

test('missing, mismatched, malformed and short floor blocks publish no decoded result',()=>{
  expect(()=>createNativeBakeReader(input,rows).read()).toThrow('Missing native floor block');
  expect(()=>createNativeBakeReader(input,rows,{file:'other.bin',bytes}).read()).toThrow('Missing native floor block');
  for(const length of [0,3,12,20])expect(()=>createNativeBakeReader(input,rows,{file,bytes:new Uint8Array(length)}).read()).toThrow();
  expect(()=>nativeBakeGround(input.ground,2,5,'Orchard',{file,bytes})).toThrow('lattice');
});

test('the Nalati raw floor is byte-exact to the original 256-square capture',()=>{
  const raw=readFileSync('src/shards/nalati-grasslands/data/physics-ground.bin');
  expect(raw.length).toBe(262144);expect(hashImmutableBytes(raw)).toBe('13d0dbaf5c19066bad33a1ca49587029430ce44538665094fae7bdd5568660f5');
  const source:unknown=originalNalatiPhysics();
  const ground=v.parse(v.object({ground:nativeGroundRecordSchema(256,true)}),source).ground;
  const decoded=nativeBakeGround(ground,256,500,'Nalati',{file,bytes:raw});
  expect(new Uint8Array(decoded.heights.buffer)).toEqual(Uint8Array.from(raw));
  expect(decoded.scale).toEqual({x:500,y:1,z:500});expect(decoded.at).toEqual({x:0,y:0,z:0});
});

test('the producer lends the exact floor through standard named binary admission',async()=>{
  const {nalatiPhysicsSources}=await import('../src/shards/nalati-grasslands/generators/physics');
  const {readNamedBlob}=await import('../src/sdk/blobs');
  const [source]=nalatiPhysicsSources();if(source===undefined)throw new Error('Missing native floor declaration');
  expect(source).toEqual({name:file,kind:'bin',source:file,options:{decoded:262144}});
  const blob=await readNamedBlob('src/shards/nalati-grasslands',source.name,source.source,source.kind,source.options);
  expect(blob.bytes.length).toBe(262144);expect(blob.file.decoded).toBe(262144);
  expect(hashImmutableBytes(blob.bytes)).toBe('13d0dbaf5c19066bad33a1ca49587029430ce44538665094fae7bdd5568660f5');
});
