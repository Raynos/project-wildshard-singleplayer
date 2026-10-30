// oxlint-disable-next-line import/no-nodejs-modules -- Verify the original generated wire and raw sidecar bytes.
import {readFileSync} from 'node:fs';
import { NALATI_KOKPAR, NALATI_KOKPAR_WASM, NALATI_CURRENT_KOKPAR, predecessorKokparScript } from './fixtures/nalati-kokpar';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {ReturnProgramSchema} from '../src/format/namedJsonContracts';
import {parseHeldSlots} from '../src/format/heldArms';
import {scriptAdmissionRows} from '../src/format/scriptContract';
import {NALATI_SCRIPT_SECTIONS} from './fixtures/nalati-script-inventory';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {nameBlob} from '../src/sdk/blobs';
import {kokparModuleOptions,NALATI_KOKPAR_MODULE} from '../src/shards/nalati-grasslands/generators/kokparRows';
import {kokparProgram,kokparModuleBytes,lendNalatiKokpar} from './fixtures/nalati-return-modules';

const original=hashImmutableBytes(kokparModuleBytes);
const input:unknown=structuredClone(NALATI_KOKPAR);
const stored=v.parse(v.looseObject({program:ReturnProgramSchema,course:ReturnProgramSchema,
  compiled:v.strictObject({source:v.string(),bytes:v.number()})}),
  input);
const inline={...kokparProgram,bytes:Buffer.from(kokparModuleBytes).toString('base64')};

test('predecessor script order retains every raw compiler field and refuses metadata changes', () => {
  const before = NALATI_KOKPAR.program.script, current = NALATI_CURRENT_KOKPAR.program.script;
  expect(Object.keys(before).at(-1)).toBe('sourceHash');
  expect(JSON.stringify(predecessorKokparScript(before, current))).toBe(JSON.stringify(before));
  expect(before).toEqual(current);
  for (const changed of [{ ...before, pages: before.pages + 1 }, { ...before, sourceHash: '0'.repeat(64) },
    { ...before, fields: {} }, { ...before, unexpected: true }]) {
    expect(() => predecessorKokparScript(changed, current)).toThrow('Original compiler metadata or order differs');
  }
  const { sourceHash: _sourceHash, ...missing } = before;
  expect(() => predecessorKokparScript(missing, current)).toThrow('Original compiler metadata or order differs');
});

test('the quest and bow guest names its shipped module and shares one program',()=>{
  expect(kokparProgram.bytes).toBe('');
  expect(kokparProgram.script.module).toBe(`blobs/wasm/${original}.wasm`);
  const {compiled,...wire}=stored;
  expect(compiled).toEqual({source:'behaviour/nalati.kokpar.wasm',bytes:kokparModuleBytes.byteLength});
  expect(wire.program).toEqual(kokparProgram);
  const variant=v.parse(v.object({program:ReturnProgramSchema}),JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/bowVariant.json','utf8')));
  const slots=parseHeldSlots(JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/mountedLoadout.json','utf8')));
  expect(variant.program).toEqual(wire.program);expect(variant.program.bytes).toBe('');
  expect(slots.upgrades.find(row=>row.kind==='bow')?.power?.rows.program).toEqual(wire.program);
  expect(new Set(scriptAdmissionRows(NALATI_SCRIPT_SECTIONS).map(row=>row.module)).size).toBe(8);
});

test('the original named ABI1 module ships as the build program blob, every byte unchanged',()=>{
  // GR6: kokparProgram.ts publishes the compiled round module itself; no template row names a generated source file
  const blob=nameBlob(NALATI_KOKPAR_MODULE,'wasm',NALATI_KOKPAR_WASM,kokparModuleOptions());
  expect(blob.file).toMatchObject({name:'behaviour/nalati.kokpar.wasm',kind:'wasm',critical:true});
  expect(blob.file.hash).toBe(original);expect(blob.bytes).toEqual(kokparModuleBytes);
  expect(blob.file.compressed).toBe(kokparModuleBytes.byteLength);expect(blob.file.decoded).toBe(kokparModuleBytes.byteLength);
});

test('raw bow and quest projections retain outputs, cache and original lifetime refusals',()=>{
  const parent=new Scope('kokpar.raw'),owner=parent.child('entered'),other=new Scope('kokpar.foreign');
  try{
    expect(()=>ReturnProgram.page(kokparProgram,owner)).toThrow('raw return module loan');
    expect(()=>ReturnProgram.page(kokparProgram)).toThrow('raw return module loan');
    lendNalatiKokpar(parent);
    const raw=ReturnProgram.page(kokparProgram,owner),legacy=ReturnProgram.page(inline);
    expect(ReturnProgram.page(kokparProgram,owner)).toBe(raw);
    const fields=Object.fromEntries(Object.values(kokparProgram.script.fields).map(name=>[name,0]));
    for(const n of [0,.5,1,2])for(const name of Object.keys(kokparProgram.script.signals)){
      expect(raw.project(name,{...fields,bowPower:n,bowThreshold:1,bowBaseDamage:10,bowPierce:3,bowCrush:2,bowCrushScale:3})).toEqual(
        legacy.project(name,{...fields,bowPower:n,bowThreshold:1,bowBaseDamage:10,bowPierce:3,bowCrush:2,bowCrushScale:3}));
    }
    expect(()=>ReturnProgram.page(kokparProgram,other)).toThrow('raw return module loan');
    const broken=owner.child('broken');
    expect(()=>ReturnProgram.lendModules(broken,new Map([[original,new Uint8Array([0])]]),[kokparProgram.script])).toThrow('hash mismatch');
    const retirement=parent.disposeSteps();retirement.next();
    expect(()=>raw.project('bow',fields)).toThrow('disposed');
    for(const _ of retirement){/* Finish the actual ancestor retirement. */}
  }finally{parent.dispose();other.dispose();}
});
