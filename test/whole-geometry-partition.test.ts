import {expect,test} from 'vitest';
import {BufferAttribute,BufferGeometry} from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- Independent pre-change wire and ordinal digests pin partition identity.
import {createHash} from 'node:crypto';
import {partitionWholeGeometry} from '../src/sdk/bake/props';
import {wholePartitionCase} from './fixtures/wholePartitionCases';

test.each(['none','u16','u32'] as const)('preserves exact %s partition ordinals, ownership and raw channels',storage=>{
 const expected={none:'aaefbaeb30063d1970d1f846a61b1c79a763e41828d90010f698531359f7785a',u16:'150af806a0890354f61dcf8186eeb3e19b132a125fdebbe2a6901c5e314315d7',u32:'2bef77ee75b50aeb94ecf80705107e90ccaa7f1c15fced1020125f4a84ab5a56'};
 const {geometry,transform}=wholePartitionCase(storage),parts=partitionWholeGeometry(geometry,transform),hash=createHash('sha256');
 try {
  for(const part of parts) {
   hash.update(JSON.stringify([part.x,part.z,part.vertices,part.triangles,part.geometry.index?.array.constructor.name??null]));
   const index=part.geometry.index;
   if(index!==null)hash.update(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength));
   for(const [name,attribute] of Object.entries(part.geometry.attributes)) {
    const source=geometry.getAttribute(name),width=attribute.itemSize*attribute.array.BYTES_PER_ELEMENT;
    hash.update(JSON.stringify([name,attribute.array.constructor.name,attribute.itemSize,attribute.normalized]));
    const bytes=new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
    hash.update(bytes);
    expect(attribute.array.buffer).not.toBe(source.array.buffer);
    for(const [local,vertex] of part.vertices.entries()) {
     const original=new Uint8Array(source.array.buffer,source.array.byteOffset+vertex*width,width);
     expect(bytes.subarray(local*width,(local+1)*width)).toEqual(original);
    }
   }
   for(const [local,triangle] of part.triangles.entries())for(let corner=0;corner<3;corner++) {
    expect(part.vertices[index?.getX(local*3+corner)??local*3+corner]).toBe(geometry.index?.getX(triangle*3+corner)??triangle*3+corner);
   }
  }
  expect(hash.digest('hex')).toBe(expected[storage]);
  if(storage!=='none')expect(parts.find(part=>part.triangles.includes(0))?.vertices).toEqual([3,4,5,6,7,8]);
 }finally{geometry.dispose();for(const part of parts)part.geometry.dispose();}
});

test('splits a contiguous run at the storage segment cap without dropping vertices',()=>{
 const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(10001*9),3));
 const parts=partitionWholeGeometry(geometry);
 try {
  expect(parts.map(part=>part.triangles.length)).toEqual([10000,1]);
  expect(parts.map(part=>part.geometry.getAttribute('position').count)).toEqual([30000,3]);
  expect(parts.flatMap(part=>part.vertices)).toEqual(Array.from({length:30003},(_,i)=>i));
  expect(parts[1]?.triangles).toEqual([10000]);
 }finally{geometry.dispose();for(const part of parts)part.geometry.dispose();}
});
