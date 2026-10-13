import { parseNpcRow } from '@wildshard/format/npcs';
import {expect,it} from 'vitest';
import {BufferGeometry,Float32BufferAttribute,Uint8BufferAttribute,Float16BufferAttribute,InterleavedBuffer,InterleavedBufferAttribute,Mesh,type Object3D} from 'three';
import {pivotNpcParts} from '@wildshard/game/plugin/geometry';
import {releasedPivotNpcParts} from './fixtures/pivot-npc-released';
import {SCOUT_NPC} from '../src/shards/sunscar-dunes/quests/scout';
import {KEEPER_ROW} from '../src/shards/far-reach/data/keeperLook';

function specimen(indexed:boolean,interleaved:boolean):BufferGeometry{
  const geometry=new BufferGeometry();
  const xyz=[-.7,.9,0,-.5,1.1,.2,-.4,1.4,0, .1,.1,0,.2,.3,.2,.3,.5,0, -.8,1.6,0,-.7,1.9,.1,-.5,2,0, -.6,1.2,0,-.7,1.3,.1,-.8,1.4,0];
  if(interleaved){const packed=xyz.flatMap((v,i)=>i%3===0?[91,v,xyz[i+1]??0,xyz[i+2]??0,92]:[]);geometry.setAttribute('position',new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array(packed),5),3,1));}
  else geometry.setAttribute('position',new Float32BufferAttribute(xyz,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(xyz.map((_,i)=>i%3===1?1:0),3));
  geometry.setAttribute('uv',new Float16BufferAttribute(new Uint16Array(Array.from({length:24},(_,i)=>i%2?15360:14336)),2));
  geometry.setAttribute('color',new Uint8BufferAttribute(Array.from({length:48},(_,i)=>(i*37)%256),4,true));
  geometry.setAttribute('weight',new Float32BufferAttribute(Array.from({length:12},(_,i)=>i/7),1));
  if(indexed)geometry.setIndex([0,1,2,3,4,5,6,7,8,9,10,11]);
  return geometry;
}
function isGeometry(value:unknown):value is BufferGeometry{return value instanceof BufferGeometry;}
function snapshot(root:Object3D):unknown[]{
  const rows:unknown[]=[];
  root.traverse(object=>{
    const base={type:object.type,position:object.position.toArray(),rotation:object.rotation.toArray(),scale:object.scale.toArray()};
    if(object instanceof Mesh){const candidate:unknown=object.geometry;if(!isGeometry(candidate))throw new Error('Expected pivot geometry');const g=candidate;rows.push({...base,box:g.boundingBox===null?null:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},sphere:g.boundingSphere===null?null:{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius},attributes:Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,{size:a.itemSize,normalized:a.normalized,bytes:Array.from(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))}]))});}
    else rows.push(base);
  });return rows;
}
it('matches released pivot attributes, flat normals, bounds and hierarchy for both NPC rows and every storage path',()=>{
  for(const row of [parseNpcRow(KEEPER_ROW),SCOUT_NPC])for(const indexed of [false,true])for(const interleaved of [false,true])for(const flat of [false,true]){
    const source=specimen(indexed,interleaved),definition={...row,figure:{...row.figure,flat}};
    const actual=pivotNpcParts(definition,source.clone()),expected=releasedPivotNpcParts(definition,source.clone());
    expect(snapshot(actual.root)).toEqual(snapshot(expected.root));
  }
});
