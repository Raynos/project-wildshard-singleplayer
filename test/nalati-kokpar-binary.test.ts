// oxlint-disable-next-line import/no-nodejs-modules -- Verify the original generated wire and raw sidecar bytes.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {ReturnProgramSchema} from '../src/format/namedJsonContracts';
import {parseHeldSlots} from '../src/format/heldArms';
import {scriptAdmissionRows} from '../src/format/scriptContract';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {readNamedBlob} from '../src/sdk/blobs';
import {kokparProgram,kokparModuleBytes,lendNalatiKokpar} from './fixtures/nalati-return-modules';

const original='9b537d68433363e0ab4e432ef35f73fcd799638b31be7c83d0a499042ef3557f';
const input:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/data/kokpar.generated.json','utf8'));
const stored=v.parse(v.looseObject({program:ReturnProgramSchema,course:ReturnProgramSchema,
  compiled:v.strictObject({source:v.string(),bytes:v.number()})}),
  input);
const inline={...kokparProgram,bytes:Buffer.from(kokparModuleBytes).toString('base64')};

test('the original quest and bow guest retains every metadata and module byte',()=>{
  expect(kokparProgram.bytes).toBe('');expect(kokparModuleBytes.byteLength).toBe(10468);
  expect(hashImmutableBytes(kokparModuleBytes)).toBe(original);
  expect(kokparProgram.script.module).toBe(`blobs/wasm/${original}.wasm`);
  const {compiled,...wire}=stored;
  expect(compiled).toEqual({source:'behaviour/kokpar.generated.wasm',bytes:10468});
  // Compare the original producer order, before schema default normalization.
  const metadata=Object.fromEntries(Object.entries(v.parse(v.record(v.string(),v.unknown()),input)).filter(([key])=>key!=='compiled'));
  const programme=v.parse(v.record(v.string(),v.unknown()),metadata['program']);
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify({...metadata,program:{...programme,bytes:inline.bytes}})))).toBe('dd0e1fb5444bf4b1bb2bb1d35fdedb55d407956efc14666efd640b3fa9f3c70b');
  expect(wire.program).toEqual(kokparProgram);
  const variant=v.parse(v.object({program:ReturnProgramSchema}),JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/bowVariant.generated.json','utf8')));
  const slots=parseHeldSlots(JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/mountedLoadout.generated.json','utf8')));
  expect(variant.program).toEqual(wire.program);expect(variant.program.bytes).toBe('');
  expect(slots.upgrades.find(row=>row.kind==='bow')?.power?.rows.program).toEqual(wire.program);
  expect(hashImmutableBytes(Uint8Array.from(atob(stored.course.bytes),byte=>byte.codePointAt(0)??0))).toBe('6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102');
  expect(new Set(scriptAdmissionRows(NALATI_SCRIPT_SECTIONS).map(row=>row.module)).size).toBe(8);
});

test('the original named ABI1 file ships directly from its registered raw producer',async()=>{
  const {output}=await import('./fixtures/nalati-output-original');
  const row=output.blobs.find(file=>file.name==='behaviour/nalati.kokpar.wasm');
  expect(row).toMatchObject({kind:'wasm',source:stored.compiled.source,options:{critical:true,script:{abi:1,pages:1}}});
  expect(output.namedFiles.some(file=>file.name==='behaviour/nalati.kokpar.wasm')).toBe(false);
  const blob=await readNamedBlob('src/shards/nalati-grasslands','behaviour/nalati.kokpar.wasm',stored.compiled.source,'wasm',{critical:true,script:{abi:1,pages:1}});
  expect(blob.file.hash).toBe(original);expect(blob.bytes).toEqual(kokparModuleBytes);
  expect(blob.file.compressed).toBe(10468);expect(blob.file.decoded).toBe(10468);
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
