/** Dual compile an unchanged stateless AS decision closure. The candidate uses
 * ws_project and the defining v2 SDK, while the public v1 artifact is retained. */
import { parseDecisionScripts,scriptV1Identifier } from '@wildshard/format/decisionScripts';
import { parseReturnProjectionV2,returnProjectionV2Layout,type ReturnProjectionV2Rows } from '@wildshard/format/returnProjectionV2';
import { compileDecisionScripts,type DecisionBuildOptions } from './buildDecisionScripts';
import type { DecisionRegistries } from './decisionBindingMap';
import { compileScriptV2 } from './bake/compileScriptV2';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { v2CoreSource } from './as/wsV2';
import { hashImmutableBytes } from './immutable';
import { decisionBindingsPath } from './decisionScriptBindings';

export async function compileReturnProjectionV2(input:unknown,registries:DecisionRegistries,authored:ReadonlyMap<string,string>,options:DecisionBuildOptions):Promise<{
  readonly legacy:{readonly script:ReturnType<typeof parseDecisionScripts>[number];readonly bytes:string};readonly candidate:ReturnProjectionV2Rows;
}> {
  const row=parseDecisionScripts([input])[0];
  if(row?.side!=='sim'||row.state.length>0||row.tick!==null||row.timers.length>0||row.on.length!==1||row.on[0]!=='signal'
    ||row.reads.some(read=>read!=='field'&&read!=='random')||row.commands.some(command=>command!=='channel')||Object.keys(row.params).length>0)throw new Error('Not a numeric return projection');
  const old=await compileDecisionScripts([row],registries,authored,{...options,singleSignal:true}),script=old.rows[0],blob=old.blobs[0];
  if(script===undefined||blob===undefined)throw new Error('Missing legacy projection');
  const fields=Object.values(row.fields).sort(),signals=Object.values(row.signals).sort(),channels=Object.values(row.channels).sort();
  const layout=returnProjectionV2Layout(fields.length,row.pages),path=decisionBindingsPath(row);
  const lines=["import * as core from '../../sdk/as/wsV2';"];
  for(const [kind,namespace,names]of [['fields','Field',fields],['signals','Signal',signals],['channels','Channel',channels]] as const){
    lines.push(`export namespace ${namespace}{`,...Object.entries(row[kind]).map(([alias,name])=>`export const ${scriptV1Identifier(alias)}:i32=${names.indexOf(name)+1};`),'}');
  }
  lines.push(`export class Read{
    static field(actor:i32,id:i32):f64{assert(actor>=0&&actor<=8&&id>0&&id<=${fields.length});return core.field(actor*${fields.length}+id-1);}
    static random():f64{return core.random(1);}
  }
  export class Do{static channel(id:i32,value:f64):void{assert(id>0&&id<=${channels.length});core.pageOutput(id,value);}}`);
  // The legacy compiler has already checked the entire source budget and the
  // entry's captured import closure. Supply those exact texts to both wrappers.
  const sources:Record<string,string>={[path]:lines.join('\n'),'sdk/as/wsV2.ts':v2CoreSource(0)};
  for(const [name,text]of authored)sources[`${name.slice(0,-3)}.ts`]=text;
  const source=`import {onSignal} from './${row.source.slice(0,-3)}';
    import * as core from './sdk/as/wsV2';
    export function ws_abi():i32{return 2;}
    export function ws_io():i32{return 0;}
    export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return fuel;}
    export function ws_project(fuel:i32):i32{core.beginState();assert(core.beginBinding(0));onSignal(i32(core.parameter(0)),0,0);core.endBinding();return fuel;}`;
  const bytes=await compileScriptV2(source,{maximumPages:row.pages,ioBytes:layout.bytes,lane:'project',sources});
  const candidate=parseReturnProjectionV2({artifact:{abi:2,minor:0,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission,
    hash:hashImmutableBytes(bytes),lane:'project',pages:row.pages,ioBytes:layout.bytes},fields,signals,channels,bytes:btoa(Array.from(bytes,byte=>String.fromCodePoint(byte)).join(''))});
  return {legacy:{script,bytes:btoa(Array.from(blob.bytes,byte=>String.fromCodePoint(byte)).join(''))},candidate};
}
