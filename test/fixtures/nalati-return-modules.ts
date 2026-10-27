import { originalHeldMetadata } from './nalati-held-original';
import { NALATI_RIDING_PROGRAMS, NALATI_RIDING_WASM, NALATI_RIDING_WITNESS_BYTES } from './nalati-riding';
import { NALATI_KOKPAR, NALATI_KOKPAR_WASM } from './nalati-kokpar';
import { originalSpeciesFile } from './nalati-original-species';
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
import {titanWitnessBytes,pastureWitnessBytes} from './titanInlineWitness';

const kokparInput=v.parse(v.object({program:ReturnProgramSchema}),JSON.parse(JSON.stringify(NALATI_KOKPAR)));
const kokparScript=parseDecisionScripts([kokparInput.program.script])[0];
if(kokparScript===undefined)throw new Error('Missing actual Kokpar script');
export const kokparProgram={...kokparInput.program,script:kokparScript};
export const kokparModuleBytes=Uint8Array.from(NALATI_KOKPAR_WASM);
const admissionInput=v.parse(v.object({...ReturnProgramSchema.entries}),JSON.parse(readFileSync('src/shards/nalati-grasslands/behaviour/admission.generated.json','utf8')));
const admissionScript=parseDecisionScripts([admissionInput.script])[0];
if(admissionScript===undefined||admissionInput.v2===undefined)throw new Error('Missing actual admission script');
export const admission={...admissionInput,script:admissionScript,v2:admissionInput.v2};
export const admissionWitnessBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/admission-witness.generated.bin'));
/** Rebuild only the original unit-test oracle; production borrows the raw witness. */
export const admissionLegacy={script:admissionScript,bytes:Buffer.from(admissionWitnessBytes).toString('base64')};
export const admissionModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/admission.generated.wasm'));
const projection=programs.wind.v2;
const held=v.parse(v.object({program:v.strictObject({...ReturnProgramSchema.entries,v2:ReturnProjectionV2Schema})}),
  originalHeldMetadata().held);
const mounts=v.parse(v.object({approach:v.strictObject({...ReturnProgramSchema.entries,v2:ReturnProjectionV2Schema})}),
  structuredClone(NALATI_RIDING_PROGRAMS));
export const heldWitnessBytes=originalSpeciesFile('held-witness.bin');
export const heldModuleBytes=originalSpeciesFile('held-weapons.wasm');
export const ridingWitnessBytes=Uint8Array.from(NALATI_RIDING_WITNESS_BYTES);
export const ridingModuleBytes=Uint8Array.from(NALATI_RIDING_WASM);
export const titanModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/titan.generated.wasm'));
const heldScript=parseDecisionScripts([held.program.script])[0];
if(heldScript===undefined)throw new Error('Missing actual held script');
const ridingScript=parseDecisionScripts([mounts.approach.script])[0];
if(ridingScript===undefined)throw new Error('Missing actual riding script');
const modules=new Map([[kokparScript.module.slice('blobs/wasm/'.length,-'.wasm'.length),kokparModuleBytes],[admissionScript.module.slice('blobs/wasm/'.length,-'.wasm'.length),admissionWitnessBytes],[ridingScript.module.slice('blobs/wasm/'.length,-'.wasm'.length),ridingWitnessBytes],[heldScript.module.slice('blobs/wasm/'.length,-'.wasm'.length),heldWitnessBytes],[programs.attack.script.module.slice('blobs/wasm/'.length,-'.wasm'.length),titanWitnessBytes],[programs.wind.script.module.slice('blobs/wasm/'.length,-'.wasm'.length),pastureWitnessBytes],[programs.attack.v2.artifact.hash,titanModuleBytes],[projection.artifact.hash,Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/pasture.generated.wasm'))],
  [held.program.v2.artifact.hash,heldModuleBytes],[mounts.approach.v2.artifact.hash,ridingModuleBytes],[admission.v2.artifact.hash,admissionModuleBytes]]);
const rows=v.parse(ReturnModulesSchema,[kokparScript,...[['nalati.titan.projection',programs.attack.v2],['nalati.pasture.projection',projection],['nalati.held-weapons.projection',held.program.v2],['nalati.mounts.projection',mounts.approach.v2],['nalati.admission.projection',admission.v2]].map(([id,program])=>{
  if(typeof id!=='string'||typeof program==='string'||program===undefined)throw new Error('Missing fixture return descriptor');
  return {id,module:`blobs/wasm/${program.artifact.hash}.wasm`,side:'sim',abi:2,lane:'project',pages:program.artifact.pages,ioBytes:program.artifact.ioBytes,
    compilerRevision:program.artifact.compilerRevision,admissionRevision:program.artifact.admissionRevision};
})]);
/** Bow and quest fixtures borrow the original admitted ABI1 module map. */
export function lendNalatiKokpar(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
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

/** Titan fixtures borrow the same real file and original entered scope. */
export function lendNalatiTitan(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
