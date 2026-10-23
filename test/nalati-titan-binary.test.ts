import {expect,test} from 'vitest';
import {titanRawPrograms as programs} from './fixtures/titanInlineWitness';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {prepareProjectOutput} from '../src/sdk/projectOutput';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {lendNalatiTitan,titanModuleBytes} from './fixtures/nalati-return-modules';

const selected='459dfc9d9f511f4722e23e97079a5f44722a5cdf5734985c535ec8383b396054';
test('Titan keeps every original witness and metadata byte while selected bytes stay raw',()=>{
  expect(programs.attack.v2.bytes).toBe('');expect(programs.rules.v2.bytes).toBe('');
  expect(titanModuleBytes.length).toBe(33384);expect(hashImmutableBytes(titanModuleBytes)).toBe(selected);
  expect(programs.compiled.attack).toStrictEqual({source:'behaviour/titan.generated.wasm',bytes:33384,hash:selected});
  for(const key of ['attack','rules','wind','fire'] as const){
    const expected=key==='attack'||key==='rules'?'ba56b0de486d84b2dcf05695844f5ad61579d1eb4f3530d5211b85b2568f1e3b':'17a68c74224d7e331d3d53dbb217d44b433254df0897e2b2a064651870d94327';
    expect(hashImmutableBytes(Uint8Array.from(atob(programs[key].bytes),byte=>byte.codePointAt(0)??0))).toBe(expected);
  }
  const metadata={attack:programs.attack,rules:programs.rules,wind:programs.wind,fire:programs.fire};
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(metadata)))).toBe('d3b7a245ed44ef2a39ee0d4f396492b09d7ed2d29fdf6770f30103a781b2ebcc');
});

test('the standard named-file reader ships that exact admitted module',async()=>{
  const row=programs.attack.v2;
  const output=await prepareProjectOutput(decodeURIComponent(new URL('../src/shards/nalati-grasslands',import.meta.url).pathname),{blobs:[{
    name:'behaviour/nalati.titan.attack.v2.wasm',kind:'wasm',source:programs.compiled.attack.source,options:{critical:true,script:{abi:2,lane:'project',
      pages:row.artifact.pages,ioBytes:row.artifact.ioBytes,compilerRevision:row.artifact.compilerRevision,admissionRevision:row.artifact.admissionRevision}}
  }]});
  const blob=output.blobs[0];if(blob===undefined)throw new Error('Missing raw Titan programme');
  expect(blob.bytes).toEqual(titanModuleBytes);expect(blob.file.path).toBe(`blobs/wasm/${selected}.wasm`);
  expect(blob.file.compressed).toBe(33384);expect(blob.file.decoded).toBe(33384);
});

test('attack and rules borrow one selected module from the original live owner',()=>{
  const owner=new Scope('raw-titan.owner'),child=owner.child('entered'),other=new Scope('raw-titan.foreign');
  try{
    expect(()=>ReturnProgram.page(programs.attack)).toThrow('raw return module loan');
    expect(()=>ReturnProgram.page(programs.attack,other)).toThrow('loan');
    lendNalatiTitan(owner);
    const attack=ReturnProgram.page(programs.attack,child);
    expect(ReturnProgram.page(programs.rules,child)).toBe(attack);
    expect(attack.project('bossClamp',{fullHp:100,share:.3})).toStrictEqual({hp:30});
    const malformed=structuredClone(programs.attack);malformed.v2.artifact.hash='0'.repeat(64);
    expect(()=>ReturnProgram.page(malformed,child)).toThrow('loan');
    const retirement=owner.disposeSteps();retirement.next();
    expect(()=>ReturnProgram.page(programs.attack,child)).toThrow('disposed');
    for(const _ of retirement){/* finish the same original scope teardown */}
  }finally{owner.dispose();other.dispose();}
});
