import * as poseSchema from 'valibot';
import type { Euler } from 'three';
import { NumericPoseSchema, type NumericPoseInputSchema, parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { lookAngles, squashBody } from '@wildshard/engine/entities/species/rigs';
import {admittedClientChannels,bindClientChannelInputs} from './channels';
import { parsePackedCreatureLooks } from '@wildshard/format/speciesLooks';

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
/** G639: one admission per channel table: a page installs one table group by group (Nalati's sky, weather, figures, its
 *  crowd), and each install parsed the whole table again (0.3-0.65 s frames in its grid entry). The admitted rows are
 *  frozen, so every lane reads them in place (admittedClientChannels copies only rows it does not know are fixed). */
const tables=new WeakMap<object,readonly ClientChannelProgram[]>();
const freeze=<T,>(value:T):T=>{if(typeof value==='object'&&value!==null&&!Object.isFrozen(value)){for(const field of Object.values(value))freeze(field);Object.freeze(value);}return value;};
export function admittedChannelTable(input:unknown):readonly ClientChannelProgram[]{
 if(typeof input!=='object'||input===null)return parseClientChannels(input);
 let rows=tables.get(input);if(rows===undefined){rows=freeze(parseClientChannels(input));tables.set(input,rows);}
 return rows;
}
/** One bounded group of the existing visual DAG owner; supplied owners expose only explicitly declared numeric fields. */
export function installChannelPrograms(input:unknown,group:string,owners:ReadonlyMap<string,unknown>):{
 evaluate:(observation:ChannelProgramObservation)=>void;capture:()=>()=>void;readonly ids:readonly string[]
}{
 const selected=admittedChannelTable(input).filter(row=>row.numeric?.group===group);
 if(selected.length===0)throw new Error(`Missing numeric channel group: ${group}`);
 const lanes=selected.map(row=>{
  const binding=row.numeric;if(binding===undefined)throw new Error('Missing numeric channel metadata');
  const lane=admittedClientChannels(row),inputs=bindClientChannelInputs(binding.inputs,owners,new Set(lane.reads));
  const ports=lane.bindNumeric(binding.outputs,owners),restoreOnly=lane.bindNumeric(binding.restoreOnly.map(({property,target,path,nullable})=>({property,target,path,restore:true,nullable:nullable??false})),owners),values:number[]=Array.from({length:lane.reads.length},()=>0);
  // each read's bound input (undefined: it comes from the observation), looked up once
  const readers=lane.reads.map(id=>inputs.get(id));
  return {lane,inputs,readers,ports,restoreOnly,values,observation:{time:0,delta:0,values}};
 });
 const ids=Object.freeze(selected.map(row=>row.id));
 return Object.freeze({ids,
  evaluate:(observation:ChannelProgramObservation):void=>{
   const external=observation.values,isVector=vector(external);
   // Snapshot every borrowed read before any field is published, including cross-program dependencies.
   for(const {lane,inputs,readers,values} of lanes){
    if(isVector&&(inputs.size>0||external.length!==values.length))throw new Error('Numeric channel vector differs from its declared reads');
    const reads=lane.reads;
    for(let index=0;index<reads.length;index++){
     const id=reads[index]??'',read=readers[index],value=read===undefined?isVector?external[index]:Object.hasOwn(external,id)?external[id]:undefined:read();
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

/** A bone rotation's pending axes (see numericCreaturePose). */
interface Turn { readonly euler: Euler; x: number; y: number; z: number; dirty: boolean }
/** Numeric pose rows on existing joints. Each rig lends its frame and transforms to the existing channel evaluator;
 * optional bones are skipped, and no actor memory, clock, random stream or continuation is added. */
export function numericCreaturePose(poseData: unknown): (ctx: AnimalRigContext) => void {
  return compileNumericCreaturePose(poseSchema.parse(NumericPoseSchema, poseData));
}
/** The book parser already admits every nested pose. Only its immutable output
 * can take the shared path; unknown books still pass complete admission here. */
export function numericCreaturePoseFromBook(input: unknown, id: string): (ctx: AnimalRigContext) => void {
  const row = parsePackedCreatureLooks(input).poses[id];
  if (row === undefined) throw new Error('Missing packed creature joint pose');
  return compileNumericCreaturePose(row);
}
function compileNumericCreaturePose(row: poseSchema.InferOutput<typeof NumericPoseSchema>): (ctx: AnimalRigContext) => void {
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
  // G639: one detached table per distinct set of programmes a rig carries, so the table is admitted once, not per rig (a
  // herd's first frame admitted it once for every body: most of a 350 ms Nalati cell-activation frame)
  // (with the programmes' merged inputs, which depend on the set alone)
  type PoseInput = poseSchema.InferOutput<typeof NumericPoseInputSchema>;
  const detachedTables = new Map<string, { readonly table: ReturnType<typeof parseClientChannels>; readonly inputs: readonly PoseInput[] }>();
  const detach = (programs: readonly (typeof row.programs)[number][]): { readonly table: ReturnType<typeof parseClientChannels>; readonly inputs: readonly PoseInput[] } => {
    const key = programs.map(program => row.programs.indexOf(program)).join(',');
    let detached = detachedTables.get(key);
    if (detached === undefined) {
      const inputs = new Map<string, PoseInput>();
      for (const program of programs) for (const input of program.numeric.inputs) {
        const prior = inputs.get(input.input);
        if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(input)) throw new Error('Ambiguous creature pose input');
        inputs.set(input.input, input);
      }
      // NumericPoseProgramsSchema already checked every DAG and aggregate cap.
      // Subsetting rows and removing their borrowed inputs preserves that proof;
      // keep this private frozen table instead of parsing the whole DAG again.
      const table = freeze(programs.map(program => ({ ...program, numeric: { ...program.numeric, inputs: [] } })));
      tables.set(table, table);
      detached = { table, inputs: [...inputs.values()] };
      detachedTables.set(key, detached);
    }
    return detached;
  };
  // a rig with every joint (the usual case) takes the whole table: admitted here, as the look loads, not in the frame a
  // herd first poses (G639: ~6 ms of a 200 ms Nalati cell-activation frame at phone 4x)
  admittedChannelTable(detach(row.programs).table);
  const rigs = new WeakMap<AnimalRigContext['bones'], {
    look: { yaw: number; pitch: number }; scalars: Record<string, number>;
    inputs: readonly poseSchema.InferOutput<typeof NumericPoseInputSchema>[]; joints: ReadonlyMap<string, AnimalRigJoint>;
    memory: Record<string, number | undefined>;
    observation: { time: number; delta: number; values: Record<string, number> };
    lane: ReturnType<typeof installChannelPrograms> | null; turns: readonly Turn[];
  }>();
  // Value-only scratch is lent to one synchronous invocation, including during getter reentry.
  // It retains no context, joint, actor or owner when the invocation returns or refuses.
  type FrameField = Extract<PoseInput, { kind: 'frame' }>['field'];
  const makeObservation = (): { scalarValues: Float64Array; dimensions: Record<string, number | undefined>; frame: Record<FrameField, number> } => ({
    scalarValues: new Float64Array(row.scalars.length), dimensions: {}, frame: { t: 0, dt: 0, seed: 0, scale: 0, speed: 0, strafe: 0,
      phase: 0, attack: 0, brace: 0, flinch: 0, deathT: 0, stateIndex: 0, yaw: 0, lookWeight: 0 },
  });
  const copyDimensions = (dimensions: Record<string, number | undefined>, c: AnimalRigContext): void => {
    dimensions['bodyY'] = c.dims.bodyY; dimensions['bodyHalfLen'] = c.dims.bodyHalfLen;
    dimensions['bodyRadius'] = c.dims.bodyRadius; dimensions['headRadius'] = c.dims.headRadius;
    dimensions['legLen'] = c.dims.legLen; dimensions['halfWidth'] = c.dims.halfWidth; dimensions['bodyPitch'] = c.dims.bodyPitch;
  };
  let available: ReturnType<typeof makeObservation> | undefined;
  return c => {
    if ((row.alive !== undefined && row.alive !== c.alive)
      || (row.variant !== undefined && (!('variant' in c.animal) || c.animal.variant !== row.variant))) return;
    // Detached observations only: missing old-save memory can supply an authored default without a write.
    const observation = available ?? makeObservation(); available = undefined;
    try {
    const { scalarValues, dimensions, frame } = observation;
    for (let i = 0; i < row.scalars.length; i++) {
      const scalar = row.scalars[i]; if (scalar === undefined) throw new Error('Missing creature pose scalar');
      const key=scalar.path[0],field=scalar.path[1];
      copyDimensions(dimensions, c);
      let value:number|undefined;
      if(key==='mem'||key==='dims'){
        if(field===undefined)throw new Error('Missing creature pose field');
        value=key==='mem'?poseMemory(c.mem,field):!Object.hasOwn(dimensions,field)?undefined:dimensions[field];
      }else value=c[key];
      const number = value ?? scalar.fallback;
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error('Invalid creature pose scalar observation');
      scalarValues[i] = number;
    }
    let rig = rigs.get(c.bones);
    if (rig === undefined) {
      const fields = (source: { x: number; y: number; z: number }) => ({
        get x() { return source.x; }, set x(value: number) { source.x = value; },
        get y() { return source.y; }, set y(value: number) { source.y = value; },
        get z() { return source.z; }, set z(value: number) { source.z = value; },
      });
      // a programme writes a rotation an axis at a time and every Euler write recomputes the bone's quaternion: the axes
      // gather here and land as one Euler.set a bone after the lane runs (G639: setFromEuler, ~0.14 ms a Nalati look frame)
      const turns: Turn[] = [], turned = (euler: Euler) => {
        const turn: Turn = { euler, x: 0, y: 0, z: 0, dirty: false }; turns.push(turn);
        const start = (): void => { if (!turn.dirty) { turn.x = euler.x; turn.y = euler.y; turn.z = euler.z; turn.dirty = true; } };
        return {
          get x() { return turn.dirty ? turn.x : euler.x; }, set x(value: number) { start(); turn.x = value; },
          get y() { return turn.dirty ? turn.y : euler.y; }, set y(value: number) { start(); turn.y = value; },
          get z() { return turn.dirty ? turn.z : euler.z; }, set z(value: number) { start(); turn.z = value; },
        };
      };
      const look = { yaw: 0, pitch: 0 }, owners = new Map<string, unknown>(Object.entries(c.bones).map(([name, bone]) => [
        `joint.${name.replaceAll('_', '.')}`, { position: fields(bone.position), rotation: turned(bone.rotation), scale: fields(bone.scale) },
      ]));
      const scalars: Record<string, number> = Object.fromEntries(row.scalars.map((scalar, i) => [scalar.name, scalarValues[i] ?? Number.NaN]));
      const joints = new Map(Object.entries(c.bones).map(([name, joint]) => [name.replaceAll('_', '.'), joint]));
      // Every program targets one optional bone; refuse mixed owners rather than silently dropping a partial program.
      const programs = row.programs.filter(program => {
        const targets = new Set(program.numeric.outputs.map(output => output.target));
        if (targets.size !== 1 || program.numeric.group !== row.group) throw new Error('Invalid creature pose target');
        return [...targets].every(target => owners.has(target));
      });
      const detached = detach(programs);
      rig = { look, scalars, joints, memory: {}, inputs: detached.inputs, observation: { time: c.t, delta: c.dt, values: {} },
        lane: programs.length === 0 ? null : installChannelPrograms(detached.table, row.group, owners), turns };
      rigs.set(c.bones, rig);
    }
    for (let i = 0; i < row.scalars.length; i++) {
      const scalar = row.scalars[i]; if (scalar === undefined) throw new Error('Missing creature pose scalar');
      rig.scalars[scalar.name] = scalarValues[i] ?? Number.NaN;
    }
    if (row.look !== undefined) Object.assign(rig.look, lookAngles(c, ...row.look));
    frame.t = c.t; frame.dt = c.dt; frame.seed = c.seed; frame.scale = c.scale; frame.speed = c.speed; frame.strafe = c.strafe;
    frame.phase = c.phase; frame.attack = c.attack; frame.brace = c.brace; frame.flinch = c.flinch; frame.deathT = c.deathT;
    frame.stateIndex = row.states.indexOf(c.state); frame.yaw = c.yaw; frame.lookWeight = c.lookWeight;
    copyDimensions(dimensions, c);
    for(let index=0;index<rig.inputs.length;index++){
      const input=rig.inputs[index];if(input===undefined)throw new Error('Missing creature pose input');
      if(input.kind==='scalar'&&input.record==='memory')rig.memory[input.name]=poseMemory(c.mem,input.name);
    }
    for(let index=0;index<rig.inputs.length;index++){
      const input=rig.inputs[index];if(input===undefined)throw new Error('Missing creature pose input');
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
    for(let index=0;index<rig.turns.length;index++){
      const turn=rig.turns[index];if(turn===undefined)throw new Error('Missing creature pose rotation');
      if(turn.dirty){turn.dirty=false;turn.euler.set(turn.x,turn.y,turn.z);}
    }
    const body = row.squash === undefined ? undefined : c.bones[row.squash];
    if (body !== undefined) squashBody(body, c.flinch);
    } finally { available = observation; }
  };
}
