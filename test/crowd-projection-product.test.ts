import {expect,test} from 'vitest';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import {emitPlatformSections} from '../src/sdk/platformSections';
import {outputScriptAdmissionRows} from '../src/sdk/outputProduct';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {admitScriptV2} from '../src/format/scriptAdmissionV2';
import {contentHash} from '../src/sdk/project';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with {type:'json'};

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
  expect(admitScriptV2(Uint8Array.from(atob(admission.v2.bytes),byte=>byte.codePointAt(0)??0),{lane:'project',ioBytes:admission.v2.artifact.ioBytes}).lane).toBe('project');
});
