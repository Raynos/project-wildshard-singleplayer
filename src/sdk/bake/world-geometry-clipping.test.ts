import {Matrix4} from 'three';
import type {WorldPrimitive} from './world';
import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Digests pin all pre-optimization vertex-channel bytes.
import {createHash} from 'node:crypto';
import {worldGeometry} from './worldGeometry';

function clippingPrimitive(triangles:readonly (readonly number[])[],colours=4):WorldPrimitive {
 const positions=new Float64Array(triangles.flat()),count=positions.length/3;
 return {node:'clipping-fixture',objectId:null,material:0,terrain:false,positions,
  indices:Uint32Array.from({length:count},(_,i)=>i),
  normals:Float32Array.from({length:count*3},(_,i)=>(i%7-3)/4),
  colours:Float32Array.from({length:count*colours},(_,i)=>(i%11)/10),
  uv:Float32Array.from({length:count*2},(_,i)=>(i%9)/8),
  tangents:Float32Array.from({length:count*4},(_,i)=>(i%5-2)/2)};
}

function worldGeometryCases() {
 const source=clippingPrimitive([
  [-4,0,0,-3,1,1,-2,0,0], [2,0,0,3,1,1,4,0,0],
  [0,0,-4,1,1,-3,0,0,-2], [0,0,2,1,1,3,0,0,4],
  [-2,0,-2,2,1,0,0,2,2], [-1,0,-1,-1,2,-1,-1,0,1],
  [1,0,-1,1,2,-1,1,0,1], [-1,0,-1,1,2,-1,1,0,-1],
  [-1,0,1,1,2,1,1,0,1], [0,0,0,0,0,0,0,0,0],
  [0,0,0,2**-30,1,0,0,0,2**-30],
  [-2,0,-1e20,2,1,-1,0,2,-1e20],
 ]);
 const bounds:readonly [number,number,number,number]=[-1,1,-1,1];
 const rgb=clippingPrimitive([[0,0,0,1,0,0,0,1,1]],3);
 const missing={...rgb,normals:null,uv:null,colours:null,tangents:null};
 return [
  {name:'all-channels',source,bounds,transform:undefined},
  {name:'unbounded',source,bounds:undefined,transform:undefined},
  {name:'transformed',source,bounds,transform:new Matrix4().makeRotationY(0.37).setPosition(3,4,5).toArray()},
  {name:'rgb',source:rgb,bounds,transform:undefined},
  {name:'computed-normals',source:missing,bounds,transform:undefined},
  {name:'reversed-bounds',source,bounds:[1,-1,1,-1] as const,transform:undefined},
 ];
}



test.each(worldGeometryCases())('preserves pre-optimization $name channel bytes',row=>{
 const expected:Record<string,string>={
  'all-channels':'17cce455d17be5c39266d2833c2fffa0e43343870230b6d071fdad4299967a6d',
  unbounded:'38edd3952ac38efe18f4b15551a4de9079fc64442b4ab2c28be17737187a6ee6',
  transformed:'c08283f8a7a415f86143a49eaaa6aad822019a8a6cc00e325ad826891806d404',
  rgb:'6c095b8e96736ba1c0cd628cee8dffa2e5b5042ac54d0f28f40d8159e48bbc21',
  'computed-normals':'da156e7801c9fa1ebeb6692eb6268d5c39d2a4e0d20050d427e0ba2778582238',
  'reversed-bounds':'fb233235fb7121586790072287db85fb61de85b6b6dbe09139a599ca1bfdc774',
 };
 const geometry=worldGeometry(row.source,row.bounds,row.transform),hash=createHash('sha256');
 try {
  for(const key of Object.keys(geometry.attributes).sort()){
   const attribute=geometry.getAttribute(key);
   hash.update(JSON.stringify([key,attribute.itemSize,attribute.count,attribute.normalized]));
   hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
  expect(hash.digest('hex')).toBe(expected[row.name]);
 }finally{geometry.dispose();}
});

test.each([
 [-1,0,-1,-1,2,-1,-1,0,1], [1,0,-1,1,2,-1,1,0,1],
 [-1,0,-1,1,2,-1,1,0,-1], [-1,0,1,1,2,1,1,0,1],
])('retains vertical triangles exactly on a tile boundary',(...coordinates)=>{
 const geometry=worldGeometry(clippingPrimitive([coordinates]),[-1,1,-1,1]);
 try{expect(Array.from(geometry.getAttribute('position').array)).toEqual(coordinates);}
 finally{geometry.dispose();}
});

test('retains triangles crossing a tile even when every original vertex is outside',()=>{
 const geometry=worldGeometry(clippingPrimitive([[-3,0,0,3,0,0,0,2,3]]),[-1,1,-1,1]);
 try{
  const position=geometry.getAttribute('position');
  expect(position.count).toBeGreaterThan(0);
  for(let i=0;i<position.count;i++){
   expect(position.getX(i)).toBeGreaterThanOrEqual(-1);
   expect(position.getX(i)).toBeLessThanOrEqual(1);
   expect(position.getZ(i)).toBeGreaterThanOrEqual(-1);
   expect(position.getZ(i)).toBeLessThanOrEqual(1);
  }
 }finally{geometry.dispose();}
});
