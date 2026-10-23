import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Golden full-wire digests independently pin the pre-optimization GLBs.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {staticGlb} from '../src/sdk/bake/glb';
import {glbByteCases} from './fixtures/glbByteCases';

function dispose(cases:ReturnType<typeof glbByteCases>):void {
 for(const {parts} of cases)for(const {geometry,material} of parts){geometry.dispose();material.dispose();}
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
  for(const {name,parts} of cases)expect(createHash('sha256').update(staticGlb(parts)).digest('hex'),name).toBe(expected[name]);
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
