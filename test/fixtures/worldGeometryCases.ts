import {Matrix4} from 'three';
import type {WorldPrimitive} from '../../src/sdk/bake/world';

export function clippingPrimitive(triangles:readonly (readonly number[])[],colours=4):WorldPrimitive {
 const positions=new Float64Array(triangles.flat()),count=positions.length/3;
 return {node:'clipping-fixture',objectId:null,material:0,terrain:false,positions,
  indices:Uint32Array.from({length:count},(_,i)=>i),
  normals:Float32Array.from({length:count*3},(_,i)=>(i%7-3)/4),
  colours:Float32Array.from({length:count*colours},(_,i)=>(i%11)/10),
  uv:Float32Array.from({length:count*2},(_,i)=>(i%9)/8),
  tangents:Float32Array.from({length:count*4},(_,i)=>(i%5-2)/2)};
}

export function worldGeometryCases() {
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
