import * as v from 'valibot';
import {ReturnModulesSchema} from '../../src/format/scriptContract';
import type {Scope} from '../../src/engine/app/scope';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import programs from '../../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
import {ReturnProgramSchema} from '../../src/format/namedJsonContracts';
import {ReturnProjectionV2Schema} from '../../src/format/returnProjectionV2';
import {readFileSync} from 'node:fs';

const projection=programs.wind.v2;
const held=v.parse(v.object({program:v.strictObject({...ReturnProgramSchema.entries,v2:ReturnProjectionV2Schema})}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/heldWeapons.generated.json','utf8')));
export const heldModuleBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/held-weapons.generated.wasm'));
const modules=new Map([[projection.artifact.hash,Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/pasture.generated.wasm'))],
  [held.program.v2.artifact.hash,heldModuleBytes]]);
const rows=v.parse(ReturnModulesSchema,[['nalati.pasture.projection',projection],['nalati.held-weapons.projection',held.program.v2]].map(([id,program])=>{
  if(typeof id!=='string'||typeof program==='string'||program===undefined)throw new Error('Missing fixture return descriptor');
  return {id,module:`blobs/wasm/${program.artifact.hash}.wasm`,side:'sim',abi:2,lane:'project',pages:program.artifact.pages,ioBytes:program.artifact.ioBytes,
    compilerRevision:program.artifact.compilerRevision,admissionRevision:program.artifact.admissionRevision};
}));
/** Lend the real generated binary through the same scoped production API. */
export function lendNalatiPasture(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
/** The held, creature and stealth fixture owners borrow that same admitted map. */
export function lendNalatiHeld(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
