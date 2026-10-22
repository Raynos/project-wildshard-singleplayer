import * as poseSchema from 'valibot';
import { NumericPoseSchema, type NumericPoseInputSchema, parseClientChannels } from '@wildshard/format/clientChannels';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { lookAngles, squashBody } from '@wildshard/engine/entities/species/rigs';
import {createClientChannels,bindClientChannelInputs} from './channels';

/** Copied values may be an existing common read vector or a named observation for independently authored DAGs. */
export interface ChannelProgramObservation {readonly time:number;readonly delta:number;readonly values:readonly number[]|Readonly<Record<string,number>>}
function vector(value:ChannelProgramObservation['values']):value is readonly number[]{return Array.isArray(value);}
/** Pose memory is a numeric record, never an accessor on an authored owner. */
function poseMemory(memory: Readonly<Record<string, number>>, name: string): number | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(memory, name);
  if (descriptor === undefined) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) throw new Error('Creature pose memory must be a numeric record');
  const value: unknown = descriptor.value;
  if (typeof value !== 'number') throw new Error('Creature pose memory must be numeric');
  return value;
}
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

/** Numeric pose rows on existing joints. Each rig lends its frame and transforms to the existing channel evaluator;
 * optional bones are skipped, and no actor memory, clock, random stream or continuation is added. */
export function numericCreaturePose(poseData: unknown): (ctx: AnimalRigContext) => void {
  const row = poseSchema.parse(NumericPoseSchema, poseData);
  if (new Set(row.scalars.map(scalar => scalar.name)).size !== row.scalars.length
    || row.scalars.some(scalar => [scalar.name, ...scalar.path].some(key => ['constructor', 'prototype', '__proto__'].includes(key)))) throw new Error('Invalid creature pose scalar');
  if (row.programs.length === 0 || row.programs.some(program => {
    const binding = program.numeric;
    return binding.group !== row.group || binding.restoreOnly.length > 0
      || program.locals !== undefined || program.geometry !== undefined || program.connectors !== undefined
      || program.prompt !== undefined || program.bindings !== undefined || program.mover !== undefined
      || binding.outputs.some(output => !output.target.startsWith('joint.') || output.path.length !== 2
        || !['rotation', 'position', 'scale'].includes(output.path[0] ?? '') || !['x', 'y', 'z'].includes(output.path[1] ?? ''))
      || new Set(binding.outputs.map(output => output.target)).size !== 1;
  })) throw new Error('Invalid creature pose programme');
  const rigs = new WeakMap<AnimalRigContext['bones'], {
    look: { yaw: number; pitch: number }; scalars: Record<string, number>;
    inputs: readonly poseSchema.InferOutput<typeof NumericPoseInputSchema>[]; joints: ReadonlyMap<string, AnimalRigJoint>;
    memory: Record<string, number | undefined>;
    observation: { time: number; delta: number; values: Record<string, number> };
    lane: ReturnType<typeof installChannelPrograms> | null;
  }>();
  return c => {
    if ((row.alive !== undefined && row.alive !== c.alive)
      || (row.variant !== undefined && (!('variant' in c.animal) || c.animal.variant !== row.variant))) return;
    // Detached observations only: missing old-save memory can supply an authored default without a write.
    const scalarValues = row.scalars.map(scalar => {
      const [key, field] = scalar.path;
      const dimensions: Readonly<Record<string, number | undefined>> = { bodyY: c.dims.bodyY, bodyHalfLen: c.dims.bodyHalfLen,
        bodyRadius: c.dims.bodyRadius, headRadius: c.dims.headRadius, legLen: c.dims.legLen, halfWidth: c.dims.halfWidth, bodyPitch: c.dims.bodyPitch };
      const value = key === 'mem' ? poseMemory(c.mem, field)
        : key === 'dims' ? !Object.hasOwn(dimensions, field) ? undefined : dimensions[field] : c[key];
      const number = value ?? scalar.fallback;
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error('Invalid creature pose scalar observation');
      return number;
    });
    let rig = rigs.get(c.bones);
    if (rig === undefined) {
      const fields = (source: { x: number; y: number; z: number }) => ({
        get x() { return source.x; }, set x(value: number) { source.x = value; },
        get y() { return source.y; }, set y(value: number) { source.y = value; },
        get z() { return source.z; }, set z(value: number) { source.z = value; },
      });
      const look = { yaw: 0, pitch: 0 }, owners = new Map<string, unknown>(Object.entries(c.bones).map(([name, bone]) => [
        `joint.${name.replaceAll('_', '.')}`, { position: fields(bone.position), rotation: fields(bone.rotation), scale: fields(bone.scale) },
      ]));
      const scalars: Record<string, number> = Object.fromEntries(row.scalars.map((scalar, i) => [scalar.name, scalarValues[i] ?? Number.NaN]));
      const joints = new Map(Object.entries(c.bones).map(([name, joint]) => [name.replaceAll('_', '.'), joint]));
      // Every program targets one optional bone; refuse mixed owners rather than silently dropping a partial program.
      const programs = row.programs.filter(program => {
        const targets = new Set(program.numeric.outputs.map(output => output.target));
        if (targets.size !== 1 || program.numeric.group !== row.group) throw new Error('Invalid creature pose target');
        return [...targets].every(target => owners.has(target));
      });
      const inputs = new Map<string, poseSchema.InferOutput<typeof NumericPoseInputSchema>>();
      const detached: ReturnType<typeof parseClientChannels> = [];
      for (const program of programs) {
      for (const input of program.numeric.inputs) {
        const prior = inputs.get(input.input);
        if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(input)) throw new Error('Ambiguous creature pose input');
        inputs.set(input.input, input);
      }
      detached.push({ ...program, numeric: { ...program.numeric, inputs: [] } });
      }
      rig = { look, scalars, joints, memory: {}, inputs: [...inputs.values()], observation: { time: c.t, delta: c.dt, values: {} },
        lane: programs.length === 0 ? null : installChannelPrograms(detached, row.group, owners) };
      rigs.set(c.bones, rig);
    }
    row.scalars.forEach((scalar, i) => { rig.scalars[scalar.name] = scalarValues[i] ?? Number.NaN; });
    if (row.look !== undefined) Object.assign(rig.look, lookAngles(c, ...row.look));
    const frame = { t: c.t, dt: c.dt, seed: c.seed, scale: c.scale, speed: c.speed, strafe: c.strafe,
      phase: c.phase, attack: c.attack, brace: c.brace, flinch: c.flinch, deathT: c.deathT,
      stateIndex: row.states.indexOf(c.state), yaw: c.yaw, lookWeight: c.lookWeight };
    const dimensions: Readonly<Record<string, number | undefined>> = { bodyY: c.dims.bodyY, bodyHalfLen: c.dims.bodyHalfLen,
      bodyRadius: c.dims.bodyRadius, headRadius: c.dims.headRadius, legLen: c.dims.legLen, halfWidth: c.dims.halfWidth, bodyPitch: c.dims.bodyPitch };
    for (const input of rig.inputs) if (input.kind === 'scalar' && input.record === 'memory')
      rig.memory[input.name] = poseMemory(c.mem, input.name);
    for (const input of rig.inputs) {
      const joint = input.kind === 'joint' ? rig.joints.get(input.joint) : undefined;
      const record = input.kind === 'scalar' ? input.record === 'declared' ? rig.scalars : input.record === 'memory' ? rig.memory : dimensions : undefined;
      const value = input.kind === 'frame' ? frame[input.field] : input.kind === 'scalar'
        ? record !== undefined && Object.hasOwn(record, input.name) ? record[input.name] : undefined : input.kind === 'look' ? rig.look[input.axis]
        : joint?.[input.transform][input.axis];
      if (value === undefined || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`Invalid numeric input ${input.input}`);
      rig.observation.values[input.input] = value;
    }
    rig.observation.time = c.t; rig.observation.delta = c.dt;
    rig.lane?.evaluate(rig.observation);
    const body = row.squash === undefined ? undefined : c.bones[row.squash];
    if (body !== undefined) squashBody(body, c.flinch);
  };
}
