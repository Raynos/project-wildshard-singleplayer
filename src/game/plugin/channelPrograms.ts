import * as poseSchema from 'valibot';
import { ClientChannelsSchema, parseClientChannels } from '@wildshard/format/clientChannels';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { lookAngles, squashBody } from '@wildshard/engine/entities/species/rigs';
import {createClientChannels,bindClientChannelInputs} from './channels';

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
  return {lane,inputs,ports,restoreOnly,values,observation:{time:0,delta:0,values}};
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
   for(const {lane,observation:frame} of lanes){frame.time=observation.time;frame.delta=observation.delta;lane.evaluate(frame);}
   for(const {lane,ports} of lanes)ports.apply(lane.frame);
  },
  capture:()=>{const restore=lanes.flatMap(row=>[row.ports.capture(),row.restoreOnly.capture()]);return()=>{for(const run of restore)run();};},
 });
}

const numericPoseSchema = poseSchema.strictObject({
  programs: ClientChannelsSchema,
  group: poseSchema.pipe(poseSchema.string(), poseSchema.minLength(1), poseSchema.maxLength(128)),
  states: poseSchema.optional(poseSchema.pipe(poseSchema.array(poseSchema.pipe(poseSchema.string(), poseSchema.maxLength(128))), poseSchema.maxLength(64)), []),
  look: poseSchema.exactOptional(poseSchema.tuple([poseSchema.pipe(poseSchema.number(), poseSchema.finite()), poseSchema.pipe(poseSchema.number(), poseSchema.finite(), poseSchema.minValue(0)), poseSchema.pipe(poseSchema.number(), poseSchema.finite(), poseSchema.minValue(0))])),
  squash: poseSchema.exactOptional(poseSchema.string()),
  variant: poseSchema.exactOptional(poseSchema.string()),
  alive: poseSchema.exactOptional(poseSchema.boolean()),
});
/** Numeric pose rows on existing joints. Each rig lends its frame and transforms to the existing channel evaluator;
 * optional bones are skipped, and no actor memory, clock, random stream or continuation is added. */
export function numericCreaturePose(input: unknown): (ctx: AnimalRigContext) => void {
  const row = poseSchema.parse(numericPoseSchema, input);
  if (row.programs.length === 0 || row.programs.some(program => {
    const binding = program.numeric;
    return binding === undefined || binding.group !== row.group || binding.restoreOnly.length > 0
      || program.locals !== undefined || program.geometry !== undefined || program.connectors !== undefined
      || program.prompt !== undefined || program.bindings !== undefined || program.mover !== undefined
      || binding.outputs.some(output => !output.target.startsWith('joint.') || output.path.length !== 2
        || !['rotation', 'position', 'scale'].includes(output.path[0] ?? '') || !['x', 'y', 'z'].includes(output.path[1] ?? ''))
      || new Set(binding.outputs.map(output => output.target)).size !== 1;
  })) throw new Error('Invalid creature pose programme');
  const rigs = new WeakMap<AnimalRigContext['bones'], {
    frame: Record<string, unknown>; look: { yaw: number; pitch: number };
    copies: { source: AnimalRigJoint; rotation: { x: number; y: number; z: number } }[];
    observation: { time: number; delta: number; values: Record<string, number> };
    lane: ReturnType<typeof installChannelPrograms> | null;
  }>();
  return c => {
    if ((row.alive !== undefined && row.alive !== c.alive)
      || (row.variant !== undefined && Reflect.get(c.animal, 'variant') !== row.variant)) return;
    let rig = rigs.get(c.bones);
    if (rig === undefined) {
      const frame: Record<string, unknown> = { ...c };
      frame['stateIndex'] = row.states.indexOf(c.state);
      const fields = (source: { x: number; y: number; z: number }) => ({
        get x() { return source.x; }, set x(value: number) { source.x = value; },
        get y() { return source.y; }, set y(value: number) { source.y = value; },
        get z() { return source.z; }, set z(value: number) { source.z = value; },
      });
      const look = { yaw: 0, pitch: 0 }, owners = new Map<string, unknown>(Object.entries(c.bones).map(([name, bone]) => [
        `joint.${name.replaceAll('_', '.')}`, { position: fields(bone.position), rotation: fields(bone.rotation), scale: fields(bone.scale) },
      ]));
      owners.set('frame', frame); owners.set('look', look);
      const copies = Object.entries(c.bones).map(([name, source]) => {
        const rotation = { x: source.rotation.x, y: source.rotation.y, z: source.rotation.z };
        owners.set(`read.joint.${name.replaceAll('_', '.')}`, { rotation });
        return { source, rotation };
      });
      // Every program targets one optional bone; refuse mixed owners rather than silently dropping a partial program.
      const programs = row.programs.filter(program => {
        const targets = new Set(program.numeric?.outputs.map(output => output.target));
        if (targets.size !== 1 || program.numeric?.group !== row.group) throw new Error('Invalid creature pose target');
        return [...targets].every(target => owners.has(target));
      });
      rig = { frame, look, copies, observation: { time: c.t, delta: c.dt, values: {} },
        lane: programs.length === 0 ? null : installChannelPrograms(programs, row.group, owners) };
      rigs.set(c.bones, rig);
    }
    Object.assign(rig.frame, c);
    rig.frame['stateIndex'] = row.states.indexOf(c.state);
    if (row.look !== undefined) Object.assign(rig.look, lookAngles(c, ...row.look));
    for (const copy of rig.copies) {
      copy.rotation.x = copy.source.rotation.x; copy.rotation.y = copy.source.rotation.y; copy.rotation.z = copy.source.rotation.z;
    }
    rig.observation.time = c.t; rig.observation.delta = c.dt;
    rig.lane?.evaluate(rig.observation);
    const body = row.squash === undefined ? undefined : c.bones[row.squash];
    if (body !== undefined) squashBody(body, c.flinch);
  };
}
