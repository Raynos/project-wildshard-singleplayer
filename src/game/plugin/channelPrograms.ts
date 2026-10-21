import { registerRigidCorpseAnimation } from '@wildshard/engine/entities/rigidCorpsePose';
import * as poseSchema from 'valibot';
import { ClientChannelsSchema, parseClientChannels } from '@wildshard/format/clientChannels';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { lookAngles, squashBody } from '@wildshard/engine/entities/species/rigs';
import { borrowedDecisionControl } from '../shardfile/borrowedDecisions';
import {createClientChannels,bindClientChannelInputs} from './channels';
import { PracticeFootContactSchema } from './practiceFootContact';
import { sha256 } from './brain';
import { PracticePoseTransitionSchema, registerPracticePoseTransition, registerNumericPoseDefinition } from './practicePoseContract';

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

/** Stable read-only pose encoding; these numbers never drive the strike runner. */
const STRIKE_POSE_PHASE = { idle: 0, windup: 1, active: 2, recover: 3, cooldown: 4 } as const;
const numericPoseSchema = poseSchema.strictObject({
  practiceTransition: poseSchema.exactOptional(PracticePoseTransitionSchema),
  footContact: poseSchema.exactOptional(PracticeFootContactSchema),
  strikeIds: poseSchema.exactOptional(poseSchema.pipe(poseSchema.array(poseSchema.pipe(poseSchema.string(),
    poseSchema.regex(/^[a-z][a-zA-Z0-9.:-]{0,127}$/u))), poseSchema.minLength(1), poseSchema.maxLength(2),
    poseSchema.check(ids => new Set(ids).size === ids.length, 'Unique strike identities'))),
  programs: ClientChannelsSchema,
  group: poseSchema.pipe(poseSchema.string(), poseSchema.minLength(1), poseSchema.maxLength(128)),
  states: poseSchema.optional(poseSchema.pipe(poseSchema.array(poseSchema.pipe(poseSchema.string(), poseSchema.maxLength(128))), poseSchema.maxLength(64)), []),
  look: poseSchema.exactOptional(poseSchema.tuple([poseSchema.pipe(poseSchema.number(), poseSchema.finite()), poseSchema.pipe(poseSchema.number(), poseSchema.finite(), poseSchema.minValue(0)), poseSchema.pipe(poseSchema.number(), poseSchema.finite(), poseSchema.minValue(0))])),
  squash: poseSchema.exactOptional(poseSchema.string()),
  variant: poseSchema.exactOptional(poseSchema.string()),
  alive: poseSchema.exactOptional(poseSchema.boolean()),
  scalars: poseSchema.optional(poseSchema.pipe(poseSchema.array(poseSchema.strictObject({
    name: poseSchema.pipe(poseSchema.string(), poseSchema.regex(/^[a-zA-Z][a-zA-Z0-9.-]{0,63}$/u)),
    path: poseSchema.union([poseSchema.tuple([poseSchema.picklist(['t', 'seed', 'speed', 'strafe', 'phase', 'attack', 'brace', 'flinch', 'deathT'])]),
      poseSchema.tuple([poseSchema.picklist(['mem', 'dims']), poseSchema.pipe(poseSchema.string(), poseSchema.regex(/^[a-zA-Z][a-zA-Z0-9.-]{0,63}$/u))])]),
    fallback: poseSchema.exactOptional(poseSchema.pipe(poseSchema.number(), poseSchema.finite())),
  })), poseSchema.maxLength(64)), []),
});
/** Keep lazy compilation and admission on one immutable, compiler-owned definition. */
function freezeNumericDefinition(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const item of Object.values(value)) freezeNumericDefinition(item);
  Object.freeze(value);
}
/** Canonical parsed data, not function text or caller tags. Preserve signed zero (atan2/pow observe it),
 * array order and every schema field; object key order and omitted optional values are immaterial. */
function numericDefinitionBytes(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(numericDefinitionBytes).join(',')}]`;
  if (typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${numericDefinitionBytes(item)}`).join(',')}}`;
  throw new Error('Invalid numeric definition value');
}
/** Numeric pose rows on existing joints. Each rig lends its frame and transforms to the existing channel evaluator;
 * optional bones are skipped, and no actor memory, clock, random stream or continuation is added. */
export function numericCreaturePose(input: unknown): (ctx: AnimalRigContext) => void {
  // Own the same detached definition for both lazy evaluation and continuation admission.
  const row = structuredClone(poseSchema.parse(numericPoseSchema, input));
  freezeNumericDefinition(row);
  if (new Set(row.scalars.map(scalar => scalar.name)).size !== row.scalars.length
    || row.scalars.some(scalar => [scalar.name, ...scalar.path].some(key => ['constructor', 'prototype', '__proto__'].includes(key)))) throw new Error('Invalid creature pose scalar');
  if (row.programs.length === 0 || row.programs.some(program => {
    const binding = program.numeric;
    return binding === undefined || binding.group !== row.group || binding.restoreOnly.length > 0
      || program.locals !== undefined || program.geometry !== undefined || program.connectors !== undefined
      || program.prompt !== undefined || program.bindings !== undefined || program.mover !== undefined
      || binding.outputs.some(output => !output.target.startsWith('joint.') || output.path.length !== 2
        || !['rotation', 'position', 'scale'].includes(output.path[0] ?? '') || !['x', 'y', 'z'].includes(output.path[1] ?? ''))
      || new Set(binding.outputs.map(output => output.target)).size !== 1;
  })) throw new Error('Invalid creature pose programme');
  if (row.practiceTransition !== undefined) {
    const joints = new Set(row.practiceTransition.joints.map(name => `joint.${name.replaceAll('_', '.')}`));
    if (row.look !== undefined || row.squash !== undefined || row.alive !== undefined || row.variant !== undefined
      || row.scalars.some(scalar => scalar.path[0] === 'mem')
      || row.programs.some(program => program.numeric?.outputs.some(output => !joints.has(output.target)) !== false
        || program.numeric.inputs.some(read => {
          if (read.owner.startsWith('solved.')) return row.footContact === undefined
            || !row.footContact.feet.some(foot => foot.joints.includes(read.owner.slice(7)))
            || read.path.length !== 2 || read.path[0] !== 'rotation' || !['x', 'y', 'z'].includes(String(read.path[1]));
          if (read.owner.startsWith('entry.')) return !joints.has(`joint.${read.owner.slice(6)}`)
            || read.path.length !== 2 || !['position', 'rotation', 'scale'].includes(String(read.path[0]))
            || !['x', 'y', 'z'].includes(String(read.path[1]));
          if (read.owner === 'transition') return read.path.length !== 1 || !['ordinal', 'kind', 'elapsed'].includes(String(read.path[0]));
          if (read.owner === 'motion') return read.path.length !== 1 || !['x', 'y', 'z', 'distance', 'total', 'heading'].includes(String(read.path[0]));
          if (read.owner === 'strike') return row.strikeIds === undefined || read.path.length !== 1 || !['phase', 'elapsed', 'index'].includes(String(read.path[0]));
          if (read.owner === 'scalars') return read.path.length !== 1 || !row.scalars.some(scalar => scalar.name === read.path[0]);
          return read.owner !== 'frame' || read.path.length !== 1
            || !['t', 'dt', 'seed', 'scale', 'speed', 'strafe', 'phase', 'deathT', 'flinch', 'brace', 'attack', 'yaw', 'stateIndex'].includes(String(read.path[0]));
        }))) throw new Error('Invalid practice pose transition programme');
  }
  if (row.footContact !== undefined) {
    if (row.practiceTransition === undefined) throw new Error('Contact requires native practice ownership');
    const contact = row.footContact, legs = new Set(contact.feet.flatMap(foot => foot.joints));
    if (row.programs.some(program => program.numeric?.outputs.some(output =>
      contact.ancestors.some(name => output.target === `joint.${name}`) || output.path[0] !== 'rotation')))
      throw new Error('Contact requires bind-constant ancestors and rigid translations/scales');
    for (const joint of legs) for (const axis of ['x', 'y', 'z']) {
      const writers = row.programs.filter(program => program.numeric?.outputs.some(output => output.target === `joint.${joint}` && output.path[1] === axis));
      const writer = writers[0];
      if (writers.length !== 1 || writer === undefined) throw new Error('Contact legs require exclusive direct-copy solved rotations');
      const binding = writer.numeric;
      if (binding?.outputs.length !== 1) throw new Error('Contact legs require exclusive direct-copy solved rotations');
      const output = binding.outputs[0], borrowed = binding.inputs[0];
      if (output?.path[0] !== 'rotation' || binding.inputs.length !== 1
        || borrowed?.owner !== `solved.${joint}` || borrowed.path.join('.') !== `rotation.${axis}`
        || writer.reads.length !== 1 || writer.nodes.length !== 1 || writer.nodes[0]?.op !== 'read'
        || writer.nodes[0].index !== 0 || writer.channels.length !== 1 || writer.channels[0]?.value !== 0
        || writer.channels[0].property !== axis || output.property !== axis || borrowed.input !== writer.reads[0])
        throw new Error('Contact legs require exclusive direct-copy solved rotations');
    }
  }
  const rigs = new WeakMap<AnimalRigContext['bones'], {
    frame: Record<string, unknown>; look: { yaw: number; pitch: number }; scalars: Record<string, number>;
    copies: { source: AnimalRigJoint; rotation: { x: number; y: number; z: number } }[];
    observation: { time: number; delta: number; values: Record<string, number> };
    strike: { phase: number; elapsed: number; index: number };
    transitionOwners: Map<string, unknown> | undefined;
    lane: ReturnType<typeof installChannelPrograms> | null;
  }>();
  const animate = (c: AnimalRigContext): void => {
    if ((row.alive !== undefined && row.alive !== c.alive)
      || (row.variant !== undefined && Reflect.get(c.animal, 'variant') !== row.variant)) return;
    // Strict opt-in, sampled before any joint writes. Authority lookup never creates or advances an owner.
    const strike = { phase: 0, elapsed: 0, index: 0 };
    const transition = c.transition;
    if (row.practiceTransition !== undefined && (transition === undefined
      || row.practiceTransition.joints.some(name => {
        const entry = transition.entry[name];
        return c.bones[name] === undefined || entry === undefined
          || [entry.position, entry.rotation, entry.scale].some(value => ![value.x, value.y, value.z].every(n => Number.isFinite(n) && Math.abs(n) <= 1e12));
      })
      || ![transition.ordinal, transition.kind, transition.elapsed, ...Object.values(transition.displacement)].every(Number.isFinite)))
      throw new Error('Missing native practice pose transition owner');
    if (row.strikeIds !== undefined) {
      const control = borrowedDecisionControl(c.animal), admitted = control.strikeIds;
      if (row.strikeIds.some(id => !admitted.includes(id))) throw new Error('Unadmitted creature pose strike');
      const phase = STRIKE_POSE_PHASE[control.strikeState], elapsed = control.strikeTime, current = control.current;
      const index = current === null ? -1 : row.strikeIds.indexOf(current.id);
      if (!Object.hasOwn(STRIKE_POSE_PHASE, control.strikeState) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 1e12
        || (current !== null && index < 0) || (current === null && phase !== 0)) throw new Error('Invalid creature pose strike observation');
      strike.phase = phase; strike.elapsed = elapsed; strike.index = index + 1;
    }
    // Detached observations only: missing old-save memory can supply an authored default without a write.
    const scalarValues = row.scalars.map(scalar => {
      const [key, field] = scalar.path;
      const owner: unknown = Reflect.get(c, key);
      const value: unknown = field === undefined ? owner : typeof owner === 'object' && owner !== null && Object.hasOwn(owner, field) ? Reflect.get(owner, field) : undefined;
      const number = value ?? scalar.fallback;
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error('Invalid creature pose scalar observation');
      return number;
    });
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
      const scalars: Record<string, number> = Object.fromEntries(row.scalars.map((scalar, i) => [scalar.name, scalarValues[i] ?? Number.NaN]));
      if (row.footContact !== undefined) {
        for (const foot of row.footContact.feet) for (const joint of foot.joints) {
          const solved = transition?.solved?.[joint]; if (solved === undefined) throw new Error('Missing authoritative contact solution');
          owners.set(`solved.${joint}`, structuredClone(solved));
        }
      }
      owners.set('frame', frame); owners.set('look', look); owners.set('scalars', scalars);
      if (row.practiceTransition !== undefined && transition !== undefined) {
        owners.set('transition', { ordinal: transition.ordinal, kind: transition.kind, elapsed: transition.elapsed });
        owners.set('motion', { ...transition.displacement });
        for (const name of row.practiceTransition.joints) owners.set(`entry.${name.replaceAll('_', '.')}`, structuredClone(transition.entry[name]));
      }
      const strikeValues = { ...strike };
      if (row.strikeIds !== undefined) owners.set('strike', strikeValues);
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
      rig = { frame, look, scalars, copies, strike: strikeValues, observation: { time: c.t, delta: c.dt, values: {} },
        transitionOwners: row.practiceTransition === undefined ? undefined : owners,
        lane: programs.length === 0 ? null : installChannelPrograms(programs, row.group, owners) };
      rigs.set(c.bones, rig);
    }
    if (row.footContact !== undefined) {
      for (const foot of row.footContact.feet) for (const joint of foot.joints) {
        const solved = transition?.solved?.[joint], target = rig.transitionOwners?.get(`solved.${joint}`);
        if (solved === undefined || typeof target !== 'object' || target === null) throw new Error('Missing contact observation');
        Object.assign(target, structuredClone(solved));
      }
    }
    Object.assign(rig.strike, strike);
    if (rig.transitionOwners !== undefined && transition !== undefined && row.practiceTransition !== undefined) {
      for (const [name, value] of [['transition', { ordinal: transition.ordinal, kind: transition.kind, elapsed: transition.elapsed }],
        ['motion', { ...transition.displacement }]] as const) {
        const target = rig.transitionOwners.get(name); if (typeof target !== 'object' || target === null) throw new Error('Missing transition observations');
        Object.assign(target, value);
      }
      for (const name of row.practiceTransition.joints) {
        const target = rig.transitionOwners.get(`entry.${name.replaceAll('_', '.')}`), source = transition.entry[name];
        if (typeof target !== 'object' || target === null || source === undefined) throw new Error('Missing transition entry');
        Object.assign(target, structuredClone(source));
      }
    }
    Object.assign(rig.frame, c);
    row.scalars.forEach((scalar, i) => { rig.scalars[scalar.name] = scalarValues[i] ?? Number.NaN; });
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
  // v1 identifies the complete parsed numeric semantics, independently of envelope layout versions.
  registerNumericPoseDefinition(animate, `numeric-creature-pose:v1:sha256:${sha256(new TextEncoder().encode(numericDefinitionBytes(row)))}`);
  if (row.practiceTransition !== undefined) registerPracticePoseTransition(animate, { ...row.practiceTransition, ...(row.footContact === undefined ? {} : { contact: row.footContact }) });
  // Fixed corpse collision admits rigid transforms only; legacy squash and scale animation remain unchanged.
  return row.squash === undefined && row.programs.every(program => program.numeric?.outputs.every(output => output.path[0] !== 'scale') === true)
    ? registerRigidCorpseAnimation(animate) : animate;
}
