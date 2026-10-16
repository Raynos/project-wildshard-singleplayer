import {parseClientChannels} from '@wildshard/format/clientChannels';
import {createClientChannels,bindClientChannelInputs,type ClientChannelObservation} from './ui';

/** Copied values may be an existing common read vector or a named observation for independently authored DAGs. */
export interface ChannelProgramObservation {readonly time:number;readonly delta:number;readonly values:readonly number[]|Readonly<Record<string,number>>}
function vector(value:ChannelProgramObservation['values']):value is readonly number[]{return Array.isArray(value);}
/** One bounded group of the existing visual DAG owner; supplied owners expose only explicitly declared numeric fields. */
export function installChannelPrograms(input:unknown,group:string,owners:ReadonlyMap<string,unknown>):{
 evaluate:(observation:ChannelProgramObservation)=>void;capture:()=>()=>void;readonly ids:readonly string[]
}{
 const selected=parseClientChannels(input).filter(row=>row.numeric?.group===group);
 if(selected.length===0)throw new Error(`Missing numeric channel group: ${group}`);
 const lanes=selected.map(row=>{
  const binding=row.numeric;if(binding===undefined)throw new Error('Missing numeric channel metadata');
  const lane=createClientChannels(row),inputs=bindClientChannelInputs(binding.inputs,owners,new Set(lane.reads));
  const ports=lane.bindNumeric(binding.outputs,owners),restoreOnly=lane.bindNumeric(binding.restoreOnly.map(({property,target,path,nullable})=>({property,target,path,restore:true,nullable:nullable??false})),owners),values:number[]=Array.from({length:lane.reads.length},()=>0);
  return {lane,inputs,ports,restoreOnly,values};
 });
 const ids=Object.freeze(selected.map(row=>row.id));
 return Object.freeze({ids,
  evaluate:(observation:ChannelProgramObservation):void=>{
   const external=observation.values,isVector=vector(external);
   // Snapshot every borrowed read before any field is published, including cross-program dependencies.
   for(const {lane,inputs,values} of lanes){
    if(isVector&&(inputs.size>0||external.length!==values.length))throw new Error('Numeric channel vector differs from its declared reads');
    for(const [index,id] of lane.reads.entries()){
     const read=inputs.get(id),value=read===undefined?isVector?external[index]:Object.hasOwn(external,id)?external[id]:undefined:read();
     if(value===undefined||!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error(`Missing or invalid channel observation: ${id}`);
     values[index]=value;
    }
   }
   // Existing evaluators publish only finite complete frames; no visual target changes on a refused input.
   for(const {lane,values} of lanes){const frame:ClientChannelObservation={time:observation.time,delta:observation.delta,values};lane.evaluate(frame);}
   for(const {lane,ports} of lanes)ports.apply(lane.frame);
  },
  capture:()=>{const restore=lanes.flatMap(row=>[row.ports.capture(),row.restoreOnly.capture()]);return()=>{for(const run of restore)run();};},
 });
}
