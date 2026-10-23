import {expect,test} from 'vitest';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
import pasture from '../src/shards/nalati-grasslands/behaviour/pasture.generated.json' with {type:'json'};
import {prepareProjectOutput} from '../src/sdk/projectOutput';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {lendNalatiPasture} from './fixtures/nalati-return-modules';

test('the generated programme stays binary through the existing project reader and original scope',async()=>{
 const meta=programs.compiled.pasture,row=pasture.v2;
 expect(row.bytes).toBe('');expect(programs.fire.v2.bytes).toBe('');expect(programs.wind.v2.bytes).toBe('');
 expect(meta.hash).toBe(row.artifact.hash);
 const output=await prepareProjectOutput(decodeURIComponent(new URL('../src/shards/nalati-grasslands',import.meta.url).pathname),{blobs:[{
  name:'behaviour/nalati.pasture.wasm',kind:'wasm',source:meta.source,options:{critical:true,script:{abi:2,lane:'project',
   pages:row.artifact.pages,ioBytes:row.artifact.ioBytes,compilerRevision:row.artifact.compilerRevision,admissionRevision:row.artifact.admissionRevision}}
 }]});
 const blob=output.blobs[0];if(blob===undefined)throw new Error('Missing raw programme');
 expect(blob.bytes.length).toBe(meta.bytes);expect(hashImmutableBytes(blob.bytes)).toBe(meta.hash);
 expect(blob.file.path).toBe(`blobs/wasm/${meta.hash}.wasm`);
 const owner=new Scope('original-binary-programme');
 try{lendNalatiPasture(owner);const program=ReturnProgram.page(pasture,owner);
  expect(ReturnProgram.page(programs.wind,owner)).toBe(program);expect(program.prepareGroup).toBeTypeOf('function');
  expect(program.groupBindings).toStrictEqual(row.groups);
 }finally{owner.dispose();}
});
