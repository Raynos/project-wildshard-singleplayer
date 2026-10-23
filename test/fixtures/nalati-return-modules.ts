import {afterEach} from 'vitest';
import {parseDecisionScripts} from '../../src/format/decisionScripts';
import type {SimHost} from '../../src/engine/sim';
import * as v from 'valibot';
import {ReturnModulesSchema} from '../../src/format/scriptContract';
import {Scope} from '../../src/engine/app/scope';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import programs from '../../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
import {ReturnProgramSchema} from '../../src/format/namedJsonContracts';
import {ReturnProjectionV2Schema} from '../../src/format/returnProjectionV2';
import {readFileSync} from 'node:fs';

const admissionInput=v.parse(v.object({...ReturnProgramSchema.entries}),JSON.parse(readFileSync('src/shards/nalati-grasslands/behaviour/admission.generated.json','utf8')));
const admissionScript=parseDecisionScripts([admissionInput.script])[0];
if(admissionScript===undefined||admissionInput.v2===undefined)throw new Error('Missing actual admission script');
export const admission={...admissionInput,script:admissionScript,v2:admissionInput.v2};
export const admissionModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/admission.generated.wasm'));
const projection=programs.wind.v2;
const held=v.parse(v.object({program:v.strictObject({...ReturnProgramSchema.entries,v2:ReturnProjectionV2Schema})}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/heldWeapons.generated.json','utf8')));
const mounts=v.parse(v.object({approach:v.strictObject({...ReturnProgramSchema.entries,v2:ReturnProjectionV2Schema})}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/behaviour/riding.generated.json','utf8')));
export const heldModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/held-weapons.generated.wasm'));
export const ridingModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/riding.generated.wasm'));
const modules=new Map([[projection.artifact.hash,Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/pasture.generated.wasm'))],
  [held.program.v2.artifact.hash,heldModuleBytes],[mounts.approach.v2.artifact.hash,ridingModuleBytes],[admission.v2.artifact.hash,admissionModuleBytes]]);
const rows=v.parse(ReturnModulesSchema,[['nalati.pasture.projection',projection],['nalati.held-weapons.projection',held.program.v2],['nalati.mounts.projection',mounts.approach.v2],['nalati.admission.projection',admission.v2]].map(([id,program])=>{
  if(typeof id!=='string'||typeof program==='string'||program===undefined)throw new Error('Missing fixture return descriptor');
  return {id,module:`blobs/wasm/${program.artifact.hash}.wasm`,side:'sim',abi:2,lane:'project',pages:program.artifact.pages,ioBytes:program.artifact.ioBytes,
    compilerRevision:program.artifact.compilerRevision,admissionRevision:program.artifact.admissionRevision};
}));
/** Lend the real generated binary through the same scoped production API. */
export function lendNalatiPasture(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
/** The held, creature and stealth fixture owners borrow that same admitted map. */
export function lendNalatiHeld(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
/** Riding fixtures use the same file, contract and scope intake as the live session. */
export function lendNalatiRiding(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
/** Fixtures lend the original raw module to the actual lifetime owner. */
export function lendNalatiAdmission(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
const admissionOwners:Scope[]=[];
afterEach(()=>{for(const owner of admissionOwners.splice(0))owner.dispose();});
export function admissionPage(owner?:Scope):ReturnProgram {
  if(owner===undefined){owner=new Scope('admission.fixture');admissionOwners.push(owner);}
  lendNalatiAdmission(owner);return ReturnProgram.page(admission,owner);
}
export function admissionNative(host:SimHost):ReturnProgram {
  lendNalatiAdmission(host.scope);return ReturnProgram.native(host,admission);
}
