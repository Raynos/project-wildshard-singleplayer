// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original authored float32 buffers.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, InstancedBufferGeometry, InstancedBufferAttribute } from 'three';
import * as dataLook from '../src/engine/render/dataLook';
import { parsePaintedLook, type PaintedLookRow } from '../src/format/paintedLook';
import { productPaintedLook } from '../src/game/looks/paintedLook';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readNamedBlob } from '../src/sdk/blobs';
import { skyPaintedPresentation, SKY_PAINTED_GRAPHS, SKY_PAINTED_ATTRIBUTE_SOURCES } from '../src/shards/far-reach/generators/paintedLook';
import dressing from '../src/shards/far-reach/data/skyDressing.json';

const card=dressing.cumulus.cards.cards[0];if(card===undefined)throw new Error('Missing original card');
const attributes=card.instances;
const files=new Map(SKY_PAINTED_ATTRIBUTE_SOURCES.map(row=>[row.name,new Uint8Array(readFileSync(`src/shards/far-reach/${row.source}`))]));
const hashes=['8563553704ebb3b2c27816b8ce1059402c8b9fed2dc670331cc18febe0ebad23',
  'c92ae573ee25873c2373da9f82c0300753f2fb9a6bfdedf93ba258097aeb7112',
  '732dc156d8ce01332313d0190fd3e7d307e4942e1a79b39a42bd28d6e905baf1',
  'caacc971c63b3c6050bdb7d50712f6b83096aa4b70476e553ee6ceda87d60660',
  'df5e6568ca3a3da969d339ffe722480aff89f29615661fe56fc371502d09b457',
  '06400506d05c177941624d073953a275ac73948fa298bf94b80017d7bea8b094'];
function rows(instances:unknown):PaintedLookRow {
  return parsePaintedLook({look:skyPaintedPresentation().look,images:{},dressing:{name:'finite-cloud',draws:[
    {name:'copies',graph:'sky-cumulus',order:-5,geometry:{kind:'plane',size:[2,2],instances}}]}});
}
function product(input:unknown,bank:ReadonlyMap<string,Uint8Array>=files){
  const source=emptyShardfile({slug:'painted-file-fixture',name:'Fixture',author:'Fixture',revision:1,seed:1});
  const byHash=new Map([...bank].map(([,bytes])=>[hashImmutableBytes(bytes),bytes]));
  const read=vi.fn((hash:string)=>{const bytes=byHash.get(hash);return bytes===undefined?Promise.reject(new Error('Missing test file')):Promise.resolve(bytes);});
  return {read,value:createShardProduct({slug:'painted-file-fixture',revision:1,shardfile:{...source,look:{...source.look,materials:SKY_PAINTED_GRAPHS}},
    sections:new Map([['look/painted',input]]),files:new Map([...bank].map(([name,bytes])=>[name,{hash:hashImmutableBytes(bytes),url:`/fixture/${name}`}])),read})};
}
afterEach(()=>vi.restoreAllMocks());

test('all six declared files preserve original bytes, order, width and honest GPU costs',async()=>{
  expect(Object.keys(attributes)).toEqual(['aFar','aAt','aCell']);
  expect(Object.values(attributes).map(row=>[row.size,row.count])).toEqual([[1,738],[4,2952],[2,1476]]);
  let total=0;
  for(const [i,row] of SKY_PAINTED_ATTRIBUTE_SOURCES.entries()){
    const blob=await readNamedBlob('src/shards/far-reach',row.name,row.source,row.kind,row.options);
    expect(blob.file.hash).toBe(hashes[i]);expect(blob.bytes).toEqual(files.get(row.name));
    expect(blob.file.gpu).toBe(blob.bytes.byteLength);total+=blob.bytes.byteLength;
  }
  expect(total).toBe(21236);
});

test('named attributes retain complete predecessor buffers and independently owned native arrays',async()=>{
  const inline=Object.fromEntries(Object.entries(attributes).map(([name,row])=>{
    const bytes=files.get(row.file);if(bytes===undefined)throw new Error('Missing authored bytes');
    return [name,{size:row.size,float32:Buffer.from(bytes).toString('base64')}];
  }));
  // Retain the predecessor's complete decoded storage as a separate test-only byte oracle.
  const predecessor=new Map(Object.entries(attributes).map(([name,row])=>{
    const prior=inline[name];if(prior===undefined)throw new Error('Missing predecessor attribute');
    return [row.file,Uint8Array.from(atob(prior.float32),byte=>byte.codePointAt(0)??0)];
  }));
  const originalFactory=dataLook.paintedLookFromRow;
  let build:Parameters<typeof originalFactory>[1]['dressing'];
  vi.spyOn(dataLook,'paintedLookFromRow').mockImplementation((row,ports)=>{
    build=ports.dressing;const{dressing:_dressing,...rest}=ports;return originalFactory(row,rest);
  });
  const material=new MeshBasicMaterial(),graph=vi.fn(()=>Promise.resolve(material));
  for(const bank of [predecessor,files]){
    const source=product(rows(attributes),bank),look=await productPaintedLook(source.value),draw=build;
    if(draw===undefined)throw new Error('Missing actual dressing builder');
    try{
      const first=await draw({graph}),second=await draw({graph}),a=first.group.children[0],b=second.group.children[0];
      if(!(a instanceof Mesh)||!(b instanceof Mesh))throw new Error('Missing native painted mesh');
      const ga:unknown=a.geometry,gb:unknown=b.geometry;
      if(!(ga instanceof InstancedBufferGeometry)||!(gb instanceof InstancedBufferGeometry))throw new Error('Missing native instance geometry');
      expect(a.renderOrder).toBe(-5);expect(a.position.toArray()).toEqual([0,0,0]);
      expect(ga.instanceCount).toBe(738);
      expect(Object.keys(ga.attributes)).toEqual(['position','uv','aFar','aAt','aCell']);
      for(const [name,row]of Object.entries(attributes)){
        const attr=ga.getAttribute(name),other=gb.getAttribute(name),bytes=files.get(row.file);
        if(!(attr instanceof InstancedBufferAttribute)||!(other instanceof InstancedBufferAttribute))throw new Error('Missing native instance attribute');
        expect(attr.itemSize).toBe(row.size);expect(attr.count).toBe(738);expect(attr.normalized).toBe(false);
        expect(new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength)).toEqual(bytes);
        expect(other.array).not.toBe(attr.array);const before=other.getX(0);attr.setX(0,999);expect(other.getX(0)).toBe(before);
      }
      ga.dispose();gb.dispose();
      expect(source.read).toHaveBeenCalledTimes(3);
    }finally{look.dispose?.();}
  }
  material.dispose();
});

test('malformed and missing suffixes refuse before reads or look construction',async()=>{
  const factory=vi.spyOn(dataLook,'paintedLookFromRow');
  expect(()=>rows({...attributes,aCell:{...attributes.aCell,count:2}})).toThrow();
  for(const first of [{size:1,count:1,file:'x',float32:'AAAAAA=='},{size:3,count:2,file:'x'},{size:1,count:49153,file:'x'}]){
    const source=product({look:skyPaintedPresentation().look,images:{},dressing:{name:'bad',draws:[{name:'bad',graph:'sky-cumulus',order:0,geometry:{kind:'plane',size:[2,2],instances:{aAt:first}}}]}});
    await expect(productPaintedLook(source.value)).rejects.toThrow();expect(source.read).not.toHaveBeenCalled();
  }
  const bank=new Map(files);bank.delete(attributes.aCell.file);const missing=product(rows(attributes),bank);
  await expect(productPaintedLook(missing.value)).rejects.toThrow('Missing binary source');expect(missing.read).not.toHaveBeenCalled();expect(factory).not.toHaveBeenCalled();
});

test('a second finite attribute row preserves signed zero in its original storage',async()=>{
  const bytes=new Uint8Array(new Float32Array([-0,1.25]).buffer),bank=new Map([['finite.bin',bytes]]);
  const original=dataLook.paintedLookFromRow;let build:Parameters<typeof original>[1]['dressing'];
  vi.spyOn(dataLook,'paintedLookFromRow').mockImplementation((row,ports)=>{
    build=ports.dressing;const{dressing:_dressing,...rest}=ports;return original(row,rest);
  });
  const look=await productPaintedLook(product(rows({aSeed:{size:1,count:2,file:'finite.bin'}}),bank).value),draw=build;
  if(draw===undefined)throw new Error('Missing finite row builder');
  const material=new MeshBasicMaterial();
  try{
    const built=await draw({graph:()=>Promise.resolve(material)}),mesh=built.group.children[0];
    if(!(mesh instanceof Mesh))throw new Error('Missing second native mesh');
    const geometry:unknown=mesh.geometry;if(!(geometry instanceof InstancedBufferGeometry))throw new Error('Missing finite geometry');
    const attribute=geometry.getAttribute('aSeed');expect(Object.is(attribute.getX(0),-0)).toBe(true);expect(attribute.getX(1)).toBe(1.25);
    expect(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength)).toEqual(bytes);geometry.dispose();
  }finally{look.dispose?.();material.dispose();}
});

test('wrong byte counts and nonfinite float32 refuse before constructing any look',async()=>{
  const factory=vi.spyOn(dataLook,'paintedLookFromRow');
  for(const bad of [new Uint8Array(1),(()=>{const bytes=new Uint8Array(5904);new DataView(bytes.buffer).setFloat32(0,Number.NaN,true);return bytes;})()]){
    const bank=new Map(files);bank.set(attributes.aCell.file,bad);
    await expect(productPaintedLook(product(rows(attributes),bank).value)).rejects.toThrow();expect(factory).not.toHaveBeenCalled();
  }
});

test('modern painted products refuse inline attributes before any read or look allocation',async()=>{
  const factory=vi.spyOn(dataLook,'paintedLookFromRow');
  const bytes=files.get(attributes.aFar.file);if(bytes===undefined)throw new Error('Missing original attribute');
  const inline={size:attributes.aFar.size,float32:Buffer.from(bytes).toString('base64')};
  for(const input of [{aFar:inline},{...attributes,aFar:inline}]){
    const source=product(rows(input));
    const load=productPaintedLook(source.value).then(look=>{look.dispose?.();return look;});
    await expect(load).rejects.toThrow('Painted attributes require named binary files');
    expect(source.read).not.toHaveBeenCalled();expect(factory).not.toHaveBeenCalled();
  }
});


test('the complete shipped Far Reach dressing uses only its admitted binary attribute sources',()=>{
  const presentation=skyPaintedPresentation(),sources=new Map(SKY_PAINTED_ATTRIBUTE_SOURCES.map(row=>[row.name,row]));
  let count=0;
  for(const draw of presentation.dressing?.draws??[])if(draw.geometry.kind==='plane')
    for(const attribute of Object.values(draw.geometry.instances??{})){
      expect('file'in attribute).toBe(true);
      if(!('file'in attribute))throw new Error('Inline shipped painted attribute');
      const source=sources.get(attribute.file);expect(source).toBeDefined();
      if(source===undefined)throw new Error('Missing shipped attribute source');
      const bytes=readFileSync(`src/shards/far-reach/${source.source}`);
      expect(bytes.byteLength).toBe(attribute.count*4);count++;
    }
  expect(count).toBe(6);
});


test('glow attributes retain every predecessor byte and reconstruct the full authored dressing',()=>{
  const original=structuredClone(dressing);
  const pins=['caacc971c63b3c6050bdb7d50712f6b83096aa4b70476e553ee6ceda87d60660',
    'df5e6568ca3a3da969d339ffe722480aff89f29615661fe56fc371502d09b457',
    '06400506d05c177941624d073953a275ac73948fa298bf94b80017d7bea8b094'];
  let total=0,index=0;
  for(const glowCard of original.glow.cards.cards)for(const [name,row]of Object.entries(glowCard.instances)){
    const source=SKY_PAINTED_ATTRIBUTE_SOURCES.find(item=>item.name===row.file);
    if(source===undefined)throw new Error('Missing original glow source');
    const bytes=readFileSync(`src/shards/far-reach/${source.source}`);total+=bytes.byteLength;
    expect(hashImmutableBytes(bytes)).toBe(pins[index++]);
    const parent:Record<string,unknown>=glowCard.instances;
    parent[name]={size:row.size,float32:Buffer.from(bytes).toString('base64')};
  }
  expect(total).toBe(572);
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(original)))).toBe('6a71db3ad59d25188c6fe203f943f94ddda910e181b0bffbb297712f7a19f248');
});
