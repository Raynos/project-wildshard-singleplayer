import * as v from 'valibot';
import {ReturnProgramSchema} from '../src/format/namedJsonContracts';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual registered module bytes and descriptor witnesses.
import {readFileSync} from 'node:fs';
import {Scope} from '../src/engine/app/scope';
import {readNamedBlob} from '../src/sdk/blobs';
import {expect,test} from 'vitest';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import {emitPlatformSections} from '../src/sdk/platformSections';
import {outputScriptAdmissionRows} from '../src/sdk/outputProduct';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {admitScriptV2} from '../src/format/scriptAdmissionV2';
import {contentHash} from '../src/sdk/project';
import {admission,admissionModuleBytes,lendNalatiAdmission} from './fixtures/nalati-return-modules';

test('complete emitted return AND spawn admission replaces the admission witness one for one within the unchanged eight module cap',()=>{
  const rows=outputScriptAdmissionRows(emitPlatformSections(NALATI_SCRIPT_SECTIONS));
  const sim=rows.filter(row=>row.side==='sim');
  expect(new Set(sim.map(row=>row.module)).size).toBe(8);
  expect(sim.some(row=>row.module===admission.script.module)).toBe(false);
  const selected=sim.filter(row=>row.id==='nalati.admission.projection');
  expect(selected).toHaveLength(1);expect(selected[0]).toMatchObject({abi:2,lane:'project',pages:1,module:`blobs/wasm/${admission.v2.artifact.hash}.wasm`});
  const bytes=Uint8Array.from(atob(admission.bytes),byte=>byte.codePointAt(0)??0);
  expect(admission.script.module).toBe('blobs/wasm/60c94c58be1c785e9fbaed7692fa8b849b924c9cb48cbe83696ec31d7ad00bc8.wasm');
  expect(`blobs/wasm/${contentHash(bytes)}.wasm`).toBe(admission.script.module);
  expect(()=>ReturnProgram.page({script:admission.script,bytes:admission.bytes})).not.toThrow();
  expect(admitScriptV2(admissionModuleBytes,{lane:'project',ioBytes:admission.v2.artifact.ioBytes}).lane).toBe('project');
});


test('the raw admission file retains the exact complete inline descriptor and selected owner',async()=>{
  const input:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/behaviour/admission.generated.json','utf8'));
  const declaration=v.parse(v.object({...ReturnProgramSchema.entries,compiled:v.object({source:v.string(),bytes:v.number(),hash:v.string()})}),input);
  const {compiled,...wire}=declaration;
  expect(compiled).toEqual({source:'behaviour/admission.generated.wasm',bytes:15747,hash:'b05ee4ff6fe77d8e269a40f23ac3d53bec85ec197a3d7af87beba1c17a65faaf'});
  expect(wire.v2?.bytes).toBe('');
  const original={...wire,v2:{...wire.v2,bytes:btoa(String.fromCodePoint(...admissionModuleBytes))}};
  expect(contentHash(new TextEncoder().encode(JSON.stringify(original)))).toBe('680ff5770a009920b97ced733cc077c75672123b9a13b9a2fdf791ce6aba3fbe');
  const {output}=await import('../src/shards/nalati-grasslands/generators/output');
  const source=output.blobs.find(row=>row.name==='behaviour/nalati.admission.wasm');
  expect(source).toMatchObject({source:compiled.source,kind:'wasm'});
  const bootFile=output.namedFiles.find(row=>row.name==='sim/headless-boot.json');
  const bootBytes=bootFile===undefined?undefined:output.assets.get(bootFile.hash);
  if(bootBytes===undefined)throw new Error('Missing emitted native boot');
  const payload:unknown=JSON.parse(new TextDecoder().decode(bootBytes));
  expect(v.parse(v.object({admission:ReturnProgramSchema}),payload).admission).toEqual(wire);
  expect(v.parse(v.object({admission:v.record(v.string(),v.unknown())}),payload).admission).not.toHaveProperty('compiled');
  const blob=await readNamedBlob('src/shards/nalati-grasslands','behaviour/nalati.admission.wasm',compiled.source,'wasm',
    {critical:true,script:{abi:2,lane:'project',pages:admission.v2.artifact.pages,ioBytes:admission.v2.artifact.ioBytes,compilerRevision:1,admissionRevision:1}});
  expect(blob.bytes).toEqual(admissionModuleBytes);expect(blob.file.hash).toBe(compiled.hash);
  const scope=new Scope('admission.raw');lendNalatiAdmission(scope);
  try{const programme=ReturnProgram.page(wire,scope);expect(ReturnProgram.page(wire,scope)).toBe(programme);
    expect(programme.project('eliteRule',{rule:0,phase:0,storm:0})).toEqual({accept:1});
  }finally{scope.dispose();}
});
