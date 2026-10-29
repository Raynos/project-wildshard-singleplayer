// oxlint-disable-next-line import/no-nodejs-modules -- The named-file reader reads a scratch project's files.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Scratch project paths.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The scratch project lives in the OS temp directory.
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { parse } from 'valibot';
import { ReturnModulesSchema } from '../src/format/scriptContract';
import { titanRawPrograms as programs, titanWitnessBytes } from './fixtures/titanInlineWitness';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareProjectOutput } from '../src/sdk/projectOutput';
import { Scope } from '../src/engine/app/scope';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { lendNalatiTitan, titanModuleBytes } from './fixtures/nalati-return-modules';
import { nalatiRidingBlobs, nalatiTitanBlobs } from '../src/shards/nalati-grasslands/generators/output';
import { NALATI_TITAN } from './fixtures/nalati-titan';
import { NALATI_RIDING_PROGRAMS, NALATI_RIDING_WASM, NALATI_RIDING_WITNESS_BYTES } from './fixtures/nalati-riding';

// GR6: the named-file reader reads the build program's bytes from a scratch project, as it reads any source
function scratchProject(files:Record<string,Uint8Array>):string{
  const root=mkdtempSync(join(tmpdir(),'nalati-titan-'));
  for(const [name,bytes] of Object.entries(files)){mkdirSync(join(root,dirname(name)),{recursive:true});writeFileSync(join(root,name),bytes);}
  return root;
}
const selected=hashImmutableBytes(titanModuleBytes);

test('the standard named-file reader ships that exact admitted module',async()=>{
  const row=programs.attack.v2;
  const project=scratchProject({[programs.compiled.attack.source]:titanModuleBytes,'behaviour/titan-witness.bin':titanWitnessBytes});
  const output=await prepareProjectOutput(project,{blobs:[{
    name:'behaviour/nalati.titan.attack.v2.wasm',kind:'wasm',source:programs.compiled.attack.source,options:{dependencies:[hashImmutableBytes(titanWitnessBytes)],critical:true,script:{abi:2,lane:'project',
      pages:row.artifact.pages,ioBytes:row.artifact.ioBytes,compilerRevision:row.artifact.compilerRevision,admissionRevision:row.artifact.admissionRevision}}
  },{name:'behaviour/titan-witness.bin',kind:'bin',source:'behaviour/titan-witness.bin'}]});
  const blob=output.blobs[0];if(blob===undefined)throw new Error('Missing raw Titan programme');
  expect(blob.bytes).toEqual(titanModuleBytes);expect(blob.file.path).toBe(`blobs/wasm/${selected}.wasm`);
  expect(blob.file.dependencies).toEqual([hashImmutableBytes(titanWitnessBytes)]);
  expect(output.blobs[1]?.bytes).toEqual(titanWitnessBytes);
  expect(output.blobs[1]?.file.kind).toBe('bin');
  expect(blob.file.compressed).toBe(titanModuleBytes.byteLength);expect(blob.file.decoded).toBe(titanModuleBytes.byteLength);
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


test('raw witnesses retain hash and ABI1 admission before selected construction',()=>{
  const row=programs.attack,artifact=row.v2.artifact,hash=hashImmutableBytes(titanWitnessBytes);
  const contract={id:'witness.projection',module:`blobs/wasm/${artifact.hash}.wasm`,side:'sim' as const,abi:2 as const,lane:'project' as const,
    pages:artifact.pages,ioBytes:artifact.ioBytes,compilerRevision:artifact.compilerRevision,admissionRevision:artifact.admissionRevision};
  const owner=new Scope('witness.refusals'),assets=new Map([[artifact.hash,titanModuleBytes]]);
  try{
    ReturnProgram.lendModules(owner,assets,parse(ReturnModulesSchema,[contract]));
    expect(()=>ReturnProgram.page(row,owner)).toThrow('hash mismatch');
    assets.set(hash,new Uint8Array([0]));
    expect(()=>ReturnProgram.page(row,owner)).toThrow('hash mismatch');
    const wrong={...row,script:{...row.script,module:contract.module}};
    expect(()=>ReturnProgram.page(wrong,owner)).toThrow();
    assets.set(hash,titanWitnessBytes);
    const program=ReturnProgram.page(row,owner);
    expect(program.project('bossClamp',{fullHp:100,share:.3})).toStrictEqual({hp:30});
    assets.set(hash,new Uint8Array([0]));
    expect(()=>ReturnProgram.page(row,owner)).toThrow('hash mismatch');
  }finally{owner.dispose();}
});

test('every witness dependency stays in the critical cohort with its executable',async()=>{
  const {output}=await import('./fixtures/nalati-output-original');
  for(const name of ['held']){
    const row=output.blobs.find(file=>file.name===`behaviour/${name}-witness.bin`);
    expect(row,`${name} witness must not become a render-library root`).toMatchObject({kind:'bin',options:{critical:true}});
  }
  // GR6: the titan, pasture and riding witnesses are their build programs' named blobs, added beside their modules
  for(const name of ['titan','pasture']){
    const row=nalatiTitanBlobs(NALATI_TITAN).find(file=>file.file.name===`behaviour/${name}-witness.bin`);
    expect(row?.file,`${name} witness must not become a render-library root`).toMatchObject({kind:'bin',critical:true});
  }
  const [riding]=nalatiRidingBlobs({programs:NALATI_RIDING_PROGRAMS,wasm:NALATI_RIDING_WASM,witness:NALATI_RIDING_WITNESS_BYTES});
  expect(riding?.file,'riding witness must not become a render-library root').toMatchObject({name:'behaviour/riding-witness.bin',kind:'bin',critical:true});
});
