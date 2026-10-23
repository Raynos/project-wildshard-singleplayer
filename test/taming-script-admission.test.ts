import {lendNalatiRiding,ridingModuleBytes,ridingWitnessBytes} from './fixtures/nalati-return-modules';
import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {scriptAdmissionRows,decisionModuleContracts} from '../src/format/scriptContract';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with {type:'json'};
import * as v from 'valibot';
import {readNamedBlob} from '../src/sdk/blobs';
import {NALATI_RIDING_SESSION} from '../src/shards/nalati-grasslands/generators/clientRiding';

test('mounted ABI2 replaces one executable in the complete return/spawn inventory and retains its ABI1 witness',async()=>{
  const candidate=programs.approach.v2,bytes=ridingModuleBytes;
  expect(programs.approach.script.module).toBe('blobs/wasm/84bd39abf54a633b3946e0e1dea7c1816565609c034799f5310db55a7b65d4ca.wasm');
  expect(hashImmutableBytes(bytes)).toBe(candidate.artifact.hash);expect(candidate.artifact.pages).toBe(1);
  expect(candidate.bytes).toBe('');expect(programs.approach.bytes).toBe('');
  expect(hashImmutableBytes(ridingWitnessBytes)).toBe('84bd39abf54a633b3946e0e1dea7c1816565609c034799f5310db55a7b65d4ca');
  const {witnessBytes,...compiled}=programs.compiled;
  expect(witnessBytes).toBe(ridingWitnessBytes.length);
  expect(compiled).toEqual({source:'behaviour/riding.generated.wasm',bytes:47229,hash:'09463dfbd52f3bf943c9f1203ad1bab3febca73ad0da10a8e242aaf418fb0b09'});
  const {compiled:_compiled,...wire}=programs,inline={...programs.approach,bytes:Buffer.from(ridingWitnessBytes).toString('base64'),v2:{...candidate,bytes:btoa(String.fromCodePoint(...bytes))}};
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(inline)))).toBe('bcb91aa391cffd0cc224d14e3a54dcd06a888f724d867eaec2e69f8e39b9ac91');
  const original={...wire,approach:inline,breaking:inline,riding:inline};
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(original)))).toBe('42a29475ac365a10f7a9b041acb4b665ad5653b3463b2806813840298079406d');
  // The initial WT output still contained only these two fallbacks retired by 12a6349f00.
  const stale={...original,population:{...original.population,driver:{...original.population.driver,dogDecision:'dog',stragglerDistance:12}}};
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(stale)))).toBe('4fb8a8739c7e3cf463a59ca27313924f7a381637cff54b43dd1a13db0138e96a');
  expect(Object.hasOwn(NALATI_RIDING_SESSION.programs,'compiled')).toBe(false);
  const rows=scriptAdmissionRows(NALATI_SCRIPT_SECTIONS),active=new Set(rows.filter(row=>row.side==='sim').map(row=>row.module));
  expect(active.size).toBe(8);expect(active.has(programs.approach.script.module)).toBe(false);
  const file=`blobs/wasm/${candidate.artifact.hash}.wasm`;expect(active.has(file)).toBe(true);expect(rows.filter(row=>row.module===file)).toHaveLength(1);
  expect(decisionModuleContracts(rows,rows.map(row=>({kind:'wasm',path:row.module,hash:row.module.slice(11,-5)}))).get(candidate.artifact.hash)).toMatchObject({abi:2,lane:'project',pages:1,ioBytes:candidate.artifact.ioBytes});
  const scope=new Scope('mounted.program');lendNalatiRiding(scope);try{expect(ReturnProgram.page(programs.approach,scope)).toBe(ReturnProgram.page(programs.breaking,scope));expect(ReturnProgram.page(programs.riding,scope)).toBe(ReturnProgram.page(programs.approach,scope));}finally{scope.dispose();}
  const {output}=await import('../src/shards/nalati-grasslands/generators/output');
  const declaration=v.parse(v.object({name:v.string(),kind:v.literal('wasm'),source:v.string(),options:v.object({dependencies:v.array(v.string()),critical:v.boolean(),
    script:v.object({abi:v.literal(2),lane:v.literal('project'),pages:v.number(),ioBytes:v.number(),compilerRevision:v.literal(1),admissionRevision:v.literal(1)})})}),
    output.blobs.find(blob=>blob.name==='behaviour/nalati.mounts.wasm'));
  const actual=await readNamedBlob('src/shards/nalati-grasslands',declaration.name,declaration.source,declaration.kind,declaration.options);
  expect(actual.bytes).toEqual(bytes);expect(actual.file.path).toBe(file);
  const witness=v.parse(v.object({name:v.string(),kind:v.literal('bin'),source:v.string()}),output.blobs.find(blob=>blob.name==='behaviour/riding-witness.bin'));
  const raw=await readNamedBlob('src/shards/nalati-grasslands',witness.name,witness.source,witness.kind);
  expect(raw.bytes).toEqual(ridingWitnessBytes);expect(actual.file.dependencies).toEqual([raw.file.hash]);
  for(const name of ['ride/rules.json','sim/headless-boot.json']){
    const entry=output.namedFiles.find(row=>row.name===name),payload=entry===undefined?undefined:output.assets.get(entry.hash);
    if(payload===undefined)throw new Error('Missing actual riding payload');
    const input:unknown=JSON.parse(new TextDecoder().decode(payload)),row=v.parse(v.record(v.string(),v.unknown()),input);
    expect(name==='ride/rules.json'?row:row['riding']).toEqual(wire);
  }
});
