import {BufferAttribute,BufferGeometry,Color,DataUtils,Float16BufferAttribute,InterleavedBuffer,InterleavedBufferAttribute,Matrix4,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Golden full-wire digests independently pin the pre-optimization GLBs.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {staticGlb,type GlbPrimitive} from './glb';

/** Wire fixtures cover ordinary float coercion and all distinct accessor storage paths. */
function glbByteCases():readonly {name:string;parts:readonly GlbPrimitive[]}[] {
 const plain=new BufferGeometry();
 plain.setAttribute('position',new BufferAttribute(new Float64Array([-0,1/3,1e-46,1+2**-30,-2/3,-1e-46,-1,Math.PI,0]),3));
 plain.setAttribute('normal',new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));
 plain.setAttribute('custom',new BufferAttribute(new Float32Array([1,2,3,4,5,6,7,8,9,10,11,12]),4));
 const native=new BufferGeometry();
 native.setAttribute('position',new BufferAttribute(new Float32Array([-0,0,0,1,0,0,0,1,0]),3));
 native.setAttribute('normal',new Float16BufferAttribute(new Uint16Array([0,0,0x3c00,0,0,0x3c00,0,0,0x3c00]),3));
 native.setAttribute('color',new BufferAttribute(new Uint8Array([255,0,127,255,0,255,63,127,127,63,255,0]),4,true));
 native.setAttribute('pair',new BufferAttribute(new Int16Array([-32767,16384,0,-16384,32767,1]),2,true));
 native.setAttribute('tag',new BufferAttribute(new Uint32Array([0,65536,4294967295]),1));
 native.setIndex(new BufferAttribute(new Uint16Array([2,1,0]),1));
 const indexed=new BufferGeometry();
 indexed.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));
 indexed.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,0,1]),2));
 indexed.setAttribute('tangent',new BufferAttribute(new Float32Array([1,0,0,1,1,0,0,-1,1,0,0,1]),4));
 indexed.setIndex(new BufferAttribute(new Uint32Array([1,2,0]),1));
 const interleaved=new BufferGeometry(), interleavedRows=new InterleavedBuffer(Float32Array.of(-0,0,0,0,0,1,1,0,0,0,0,1,0,1,0,0,0,1),6);
 interleaved.setAttribute('position',new InterleavedBufferAttribute(interleavedRows,3,0));
 interleaved.setAttribute('normal',new InterleavedBufferAttribute(interleavedRows,3,3));
 interleaved.setAttribute('pair',new InterleavedBufferAttribute(new InterleavedBuffer(Uint8Array.of(99,0,255,99,127,63,99,255,0),3),2,1,true));
 const instances=[new Matrix4().makeTranslation(4,2,1),new Matrix4().makeScale(2,3,4)];
 return [
  {name:'source-floats',parts:[{name:'float_values',geometry:plain,material:new MeshStandardMaterial(),customAttributes:{_CUSTOM:'custom'},transform:new Matrix4().makeTranslation(1,2,3)}]},
  {name:'compact-native',parts:[{name:'native_values',geometry:native,material:new MeshStandardMaterial({vertexColors:true}),nativeAttributes:true,compactIndex:true,customAttributes:{_PAIR:'pair',_TAG:'tag'}}]},
  {name:'trs-instances',parts:[{name:'trs_values',geometry:indexed,material:new MeshBasicMaterial(),instances,instanceColours:[new Color(0.25,0.5,0.75),new Color(1,0,0)]}]},
  {name:'interleaved',parts:[{name:'interleaved_values',geometry:interleaved,material:new MeshStandardMaterial(),compactIndex:true,customAttributes:{_PAIR:'pair'}}]},
  {name:'matrix-instances',parts:[{name:'matrix_values',geometry:indexed.clone(),material:new MeshStandardMaterial(),instances,exactInstances:true,nativeAttributes:true}]},
 ];
}



function dispose(cases:ReturnType<typeof glbByteCases>):void {
 for(const {parts} of cases)for(const {geometry,material} of parts){geometry.dispose();material.dispose();}
}

/** Locate only a declared portable channel; the native raw storage remains independent. */
function channelView(bytes:Uint8Array,semantic:string):{view:DataView;count:number} {
 const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=header.getUint32(12,true);
 const doc=v.parse(v.object({meshes:v.array(v.object({primitives:v.array(v.object({attributes:v.record(v.string(),v.number())}))})),
  accessors:v.array(v.object({bufferView:v.number(),count:v.number()})),bufferViews:v.array(v.object({byteOffset:v.number(),byteLength:v.number()}))}),
  JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length))));
 const id=doc.meshes[0]?.primitives[0]?.attributes[semantic],accessor=id===undefined?undefined:doc.accessors[id];
 const buffer=accessor===undefined?undefined:doc.bufferViews[accessor.bufferView];
 if(accessor===undefined||buffer===undefined)throw new Error(`Missing portable channel ${semantic}`);
 return {view:new DataView(bytes.buffer,bytes.byteOffset+28+length+buffer.byteOffset,buffer.byteLength),count:accessor.count};
}

test('retains every pre-optimization GLB byte across accessor and instance encodings',()=>{
 const expected:Record<string,string>={
  'source-floats':'32cb6b6c74d3f24b3fdc50a812e402429374bac71fcc30cb6d18b3493bd473ae',
  'compact-native':'cbf4847049432ab4106f05835aea21425b2acc09bb6cba41e84db0583a4cc24b',
  'trs-instances':'2f92100d0396a5bf603a7bd1d622bc9306831033cd45f69874e50d11d4fe0658',
  'interleaved':'d6f10ee57f68b905e84af17c831c8628a657d9a1e90e5a107f63367a5b6bd483',
  'matrix-instances':'b5f6b7f1819fd3b7286809f75f89aa6854c4d9fd9886751a4ebc325c1d479c23',
 };
 const cases=glbByteCases();
 try {
  expect(cases.map(row=>row.name).sort()).toEqual(Object.keys(expected).sort());
  for(const {name,parts} of cases){
   const bytes=staticGlb(parts);
   if(name==='compact-native'){
    const normal=parts[0]?.geometry.getAttribute('normal');
    if(!(normal instanceof Float16BufferAttribute))throw new Error('Missing half normal');
    const current=channelView(bytes,'NORMAL'),before=bytes.slice(),legacy=channelView(before,'NORMAL');
    for(let i=0;i<current.count;i++)for(let c=0;c<3;c++){
     const numeric=c===0?normal.getX(i):c===1?normal.getY(i):normal.getZ(i);
     expect(current.view.getFloat32((i*3+c)*4,true)).toBe(numeric);
     // Keep the old full-wire pin as a before-control: only the portable
     // numeric normal changes; native half storage and every other byte stay.
     legacy.view.setFloat32((i*3+c)*4,normal.getComponent(i,c),true);
    }
    expect(createHash('sha256').update(before).digest('hex'),name).toBe(expected[name]);
   }else expect(createHash('sha256').update(bytes).digest('hex'),name).toBe(expected[name]);
  }
 }finally{dispose(cases);}
});

test('keeps source-precision bounds and negative zero while encoding float32 wire samples',()=>{
 const cases=glbByteCases(),entry=cases.find(row=>row.name==='source-floats');
 try {
  if(entry===undefined)throw new Error('Missing float fixture');
  const bytes=staticGlb(entry.parts),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonLength=view.getUint32(12,true);
  const document=v.parse(v.object({accessors:v.array(v.looseObject({min:v.optional(v.array(v.number())),max:v.optional(v.array(v.number()))}))}),JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength))));
  expect(document.accessors[0]?.min).toEqual([-1,-2/3,-1e-46]);
  expect(document.accessors[0]?.max).toEqual([1+2**-30,Math.PI,1e-46]);
  expect(Object.is(view.getFloat32(28+jsonLength,true),-0)).toBe(true);
 }finally{dispose(cases);}
});

test.each(['position','normal','custom'] as const)('rejects non-finite %s values before returning any GLB',channel=>{
 for(const value of [Number.NaN,Infinity,-Infinity]) {
  const cases=glbByteCases(),entry=cases.find(row=>row.name==='source-floats'),part=entry?.parts[0];
  try {
   if(entry===undefined||part===undefined)throw new Error('Missing float fixture');
   part.geometry.getAttribute(channel).setComponent(0,0,value);
   expect(()=>staticGlb(entry.parts)).toThrow('Invalid GLB attribute');
  }finally{dispose(cases);}
 }
});


test.each([1,2,3,4])('writes width-%s half channels with numeric axis semantics, including normalization and signed zero',width=>{
 for(const normalized of [false,true]){
  const geometry=new BufferGeometry(),material=new MeshStandardMaterial();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));
  const samples=[-0,1,-2,3.2,65504,2**-24],half=new Float16BufferAttribute(Uint16Array.from({length:3*width},(_,i)=>DataUtils.toHalfFloat(samples[i%samples.length]??0)),width,normalized);
  geometry.setAttribute('half',half);
  try{
   const bytes=staticGlb([{geometry,material,customAttributes:{_HALF:'half'}}]),channel=channelView(bytes,'_HALF');
   expect(channel.count).toBe(3);
   for(let i=0;i<half.count;i++)for(let c=0;c<width;c++){
    const numeric=c===0?half.getX(i):c===1?half.getY(i):c===2?half.getZ(i):half.getW(i);
    expect(Object.is(channel.view.getFloat32((i*width+c)*4,true),Math.fround(numeric))).toBe(true);
   }
  }finally{geometry.dispose();material.dispose();}
 }
});

test.each([0x7c00,0xfc00,0x7e01])('rejects non-finite decoded half storage %s',bits=>{
 const geometry=new BufferGeometry(),material=new MeshStandardMaterial();
 geometry.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));
 geometry.setAttribute('half',new Float16BufferAttribute(Uint16Array.of(bits,0,0),1));
 try{expect(()=>staticGlb([{geometry,material,customAttributes:{_HALF:'half'}}])).toThrow('Invalid GLB attribute');}
 finally{geometry.dispose();material.dispose();}
});
