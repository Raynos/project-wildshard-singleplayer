import {lendNalatiRiding,ridingModuleBytes,ridingWitnessBytes} from './fixtures/nalati-return-modules';
import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {scriptAdmissionRows,decisionModuleContracts} from '../src/format/scriptContract';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {NALATI_SCRIPT_SECTIONS} from './fixtures/nalati-script-inventory';
import { NALATI_RIDING_PROGRAMS as programs, NALATI_RIDING_WASM, NALATI_RIDING_WITNESS_BYTES } from './fixtures/nalati-riding';
import * as v from 'valibot';
import {nameBlob} from '../src/sdk/blobs';
import {SCRIPT_V2_REVISIONS} from '../src/format/scriptAdmissionV2';
import {ridingModuleOptions,NALATI_RIDING_MODULE,NALATI_RIDING_WITNESS} from '../src/shards/nalati-grasslands/generators/ridingProgram';
import {nalatiRidingSession} from '../src/shards/nalati-grasslands/generators/clientRiding';

test('mounted ABI2 replaces one executable in the complete return/spawn inventory and names its ABI1 witness',async()=>{
  const candidate=programs.approach.v2,bytes=ridingModuleBytes;
  expect(programs.approach.script.module).toBe(`blobs/wasm/${hashImmutableBytes(ridingWitnessBytes)}.wasm`);
  expect(hashImmutableBytes(bytes)).toBe(candidate.artifact.hash);expect(candidate.artifact.pages).toBe(1);
  expect(candidate.bytes).toBe('');expect(programs.approach.bytes).toBe('');
  const {witnessBytes,...compiled}=programs.compiled;
  expect(witnessBytes).toBe(ridingWitnessBytes.length);
  expect(compiled).toEqual({source:'behaviour/nalati.mounts.wasm',bytes:bytes.length,hash:hashImmutableBytes(bytes)});
  const {compiled:_compiled,...wire}=programs;
  expect(Object.hasOwn(nalatiRidingSession(programs).programs,'compiled')).toBe(false);
  const rows=scriptAdmissionRows(NALATI_SCRIPT_SECTIONS),active=new Set(rows.filter(row=>row.side==='sim').map(row=>row.module));
  expect(active.size).toBe(8);expect(active.has(programs.approach.script.module)).toBe(false);
  const file=`blobs/wasm/${candidate.artifact.hash}.wasm`;expect(active.has(file)).toBe(true);expect(rows.filter(row=>row.module===file)).toHaveLength(1);
  expect(decisionModuleContracts(rows,rows.map(row=>({kind:'wasm',path:row.module,hash:row.module.slice(11,-5)}))).get(candidate.artifact.hash)).toMatchObject({abi:2,lane:'project',pages:1,ioBytes:candidate.artifact.ioBytes});
  const scope=new Scope('mounted.program');lendNalatiRiding(scope);try{expect(ReturnProgram.page(programs.approach,scope)).toBe(ReturnProgram.page(programs.breaking,scope));expect(ReturnProgram.page(programs.riding,scope)).toBe(ReturnProgram.page(programs.approach,scope));}finally{scope.dispose();}
  const {output}=await import('./fixtures/nalati-output-original');
  // GR6: the build program publishes the module and its witness (ridingProgram.ts); no template row names a generated file
  const actual=nameBlob(NALATI_RIDING_MODULE,'wasm',NALATI_RIDING_WASM,ridingModuleOptions(programs,SCRIPT_V2_REVISIONS));
  expect(actual.bytes).toEqual(bytes);expect(actual.file.path).toBe(file);
  const raw=nameBlob(NALATI_RIDING_WITNESS,'bin',NALATI_RIDING_WITNESS_BYTES,{critical:true});
  expect(raw.bytes).toEqual(ridingWitnessBytes);expect(actual.file.dependencies).toEqual([raw.file.hash]);
  for(const name of ['ride/rules.json','sim/headless-boot.json']){
    const entry=output.namedFiles.find(row=>row.name===name),payload=entry===undefined?undefined:output.assets.get(entry.hash);
    if(payload===undefined)throw new Error('Missing actual riding payload');
    const input:unknown=JSON.parse(new TextDecoder().decode(payload)),row=v.parse(v.record(v.string(),v.unknown()),input);
    expect(name==='ride/rules.json'?row:row['riding']).toEqual(wire);
  }
});
