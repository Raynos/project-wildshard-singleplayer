// oxlint-disable-next-line import/no-nodejs-modules -- Exercise current shipped grass declarations alongside the inactive native producer.
import {readFileSync} from 'node:fs';
import {unzlibSync,zlibSync} from 'fflate';
import {BufferAttribute,InstancedBufferAttribute,InstancedBufferGeometry,Mesh,MeshBasicMaterial,type Group} from 'three';
import {expect,test,vi} from 'vitest';
import * as v from 'valibot';
import {Scope} from '../src/engine/app/scope';
import {TIER} from '../src/engine/core/tier';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {GrassPresentationProfile} from '../src/game/looks/grassPresentation';
import {createSceneBuffers} from '../src/game/shardfile/sceneBuffers';
import {grassRows} from '../src/shards/nalati-grasslands/generators/grassRows';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {GRASS_FILES} from './fixtures/nalatiGrass';

const before=v.parse(GrassPresentationSchema,JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8')));
const encode=(value:object):Uint8Array=>zlibSync(new TextEncoder().encode(JSON.stringify(value)));
function fixture(){
  const files=new Map<string,Uint8Array>(GRASS_FILES),rows=structuredClone(before),banks=new Map<string,Uint8Array>();
  for(const tier of ['phone','desktop']as const){
    const file=`grass/${tier}-channels.bin`,chunks:{offset:number;bytes:Uint8Array}[]=[];
    let length=0;
    const made=grassRows(tier==='phone',(_id,bytes)=>{
      const byteOffset=Math.ceil(length/4)*4;length=byteOffset+bytes.length;
      chunks.push({offset:byteOffset,bytes});return {file,byteOffset};
    });
    const bank=new Uint8Array(length);for(const chunk of chunks)bank.set(chunk.bytes,chunk.offset);
    banks.set(tier,bank);files.set(file,zlibSync(bank));
    const scene=(name:'blades'|'flowers'|'cards'):{file:string}=>{
      const path=`grass/${tier}-${name}.bin`;files.set(path,encode(made.scenes[name]));return {file:path};
    };
    rows[tier]={...rows[tier],channels:{file},scenes:{blades:scene('blades'),flowers:scene('flowers'),cards:scene('cards')}};
  }
  return {rows,files,banks};
}
function inventory(group:Group){
  return group.children.map(child=>{
    if(!(child instanceof Mesh))throw new Error('Missing grass mesh');
    const geometry:unknown=child.geometry;
    if(!(geometry instanceof InstancedBufferGeometry))throw new Error('Missing instanced grass');
    const index=geometry.getIndex();
    const attributes=Object.entries(geometry.attributes).map(([name,attribute])=>{
      if(!(attribute instanceof BufferAttribute))throw new Error('Unexpected interleave');
      return {name,size:attribute.itemSize,normalized:attribute.normalized,instanced:attribute instanceof InstancedBufferAttribute,
        hash:hashImmutableBytes(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength))};
    });
    return {name:child.name,at:child.position.toArray(),frustum:child.frustumCulled,instances:geometry.instanceCount,attributes,
      index:index===null?null:hashImmutableBytes(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength))};
  });
}

for(const tier of ['phone','desktop']as const)test(`${tier} compressed native bank preserves all five real grass geometries and owned words`,()=>{
  const {rows,files,banks}=fixture(),native=new GrassPresentationProfile(rows,files),original=new GrassPresentationProfile(before,GRASS_FILES);
  const channels=native.channelFiles(tier),bank=channels.get(rows[tier].channels?.file??'');
  if(bank===undefined)throw new Error('Missing decoded bank');
  expect(hashImmutableBytes(bank)).toBe(hashImmutableBytes(banks.get(tier)??new Uint8Array()));
  const material=new MeshBasicMaterial(),scope=new Scope('grass-native-parity');
  let disposed=0;
  try{
    for(const key of ['blades','flowers','cards']as const){
      const old=createSceneBuffers(original.scene(original.input[tier].scenes[key]),material,scope);
      const current=createSceneBuffers(native.scene(native.input[tier].scenes[key]),material,scope,undefined,undefined,channels);
      const expected=inventory(old);expect(inventory(current)).toEqual(expected);
      for(const child of current.children){
        if(!(child instanceof Mesh))throw new Error('Missing grass mesh');
        const geometry:unknown=child.geometry;
        if(!(geometry instanceof InstancedBufferGeometry))throw new Error('Missing grass geometry');
        geometry.addEventListener('dispose',()=>{disposed++;});
      }
      // The verified loan can change after construction without changing any owned geometry word.
      const saved=bank.slice();bank.fill(0);expect(inventory(current)).toEqual(expected);bank.set(saved);
    }
    bank.fill(0);
    const fresh=native.channelFiles(tier).get(rows[tier].channels?.file??'');
    if(fresh===undefined)throw new Error('Missing next build bank');
    expect(fresh.buffer).not.toBe(bank.buffer);expect(hashImmutableBytes(fresh)).toBe(hashImmutableBytes(banks.get(tier)??new Uint8Array()));
  }finally{scope.dispose();material.dispose();}
  expect(disposed).toBe(5);
});

test('native bank is prepared once for the selected tier and taken once per build',async()=>{
  const {rows,files}=fixture(),profile=new GrassPresentationProfile(rows,files),read=vi.spyOn(files,'get');
  try{
    await profile.prepare();
    const selected=rows[TIER].channels,other=rows[TIER==='phone'?'desktop':'phone'].channels;
    if(selected===undefined||other===undefined)throw new Error('Missing bank declaration');
    expect(read.mock.calls.filter(([key])=>key===selected.file)).toHaveLength(1);
    expect(read.mock.calls.filter(([key])=>key===other.file)).toHaveLength(0);
    expect(profile.channelFiles(TIER).get(selected.file)?.byteLength).toBeGreaterThan(0);
    expect(read.mock.calls.filter(([key])=>key===selected.file)).toHaveLength(1);
    profile.channelFiles(TIER);
    expect(read.mock.calls.filter(([key])=>key===selected.file)).toHaveLength(2);
  }finally{read.mockRestore();profile.heightTexture().dispose();}
});

test('missing, unsafe, inline, corrupt and truncated banks refuse without changing the old profile',()=>{
  const {rows,files}=fixture(),channels=rows.phone.channels;
  if(channels===undefined)throw new Error('Missing bank declaration');
  expect(grassPresentationFiles(v.parse(GrassPresentationSchema,rows))).toContain(channels.file);
  const missing=new Map(files);missing.delete(channels.file);
  expect(()=>new GrassPresentationProfile(rows,missing)).toThrow('Missing grass file');
  for(const invalid of ['encoded-channels',{file:'../escape.bin'}])expect(()=>new GrassPresentationProfile({...rows,phone:{...rows.phone,channels:invalid}},files)).toThrow();
  const corrupt=new Map(files);corrupt.set(channels.file,new Uint8Array([0,1,2]));
  expect(()=>new GrassPresentationProfile(rows,corrupt).channelFiles('phone')).toThrow();
  const truncated=new Map(files);truncated.set(channels.file,zlibSync(new Uint8Array(4)));
  const profile=new GrassPresentationProfile(rows,truncated),scope=new Scope('grass-truncated'),material=new MeshBasicMaterial();
  try{expect(()=>createSceneBuffers(profile.scene(profile.input.phone.scenes.blades),material,scope,undefined,undefined,profile.channelFiles('phone'))).toThrow('binary length differs');}
  finally{scope.dispose();material.dispose();}
  const legacy=new GrassPresentationProfile(before,GRASS_FILES);
  expect(legacy.channelFiles('phone').size).toBe(0);expect(legacy.channelFiles('desktop').size).toBe(0);
  expect(grassPresentationFiles(legacy.input)).toHaveLength(10);
  // Current compressed product files remain untouched by optional reader support.
  for(const tier of ['phone','desktop']as const)for(const payload of Object.values(before[tier].scenes)){
    if(typeof payload==='string')throw new Error('Expected current product file');
    expect(new TextDecoder().decode(unzlibSync(files.get(payload.file)??new Uint8Array()))).toContain('"bytes":');
  }
});
