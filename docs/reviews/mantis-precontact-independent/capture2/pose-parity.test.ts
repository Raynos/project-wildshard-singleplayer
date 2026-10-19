// oxlint-disable-next-line import/no-nodejs-modules -- Exact native fixture and source-test measurement output.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4, Box3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { mantisEarlyKneeClips } from '../../../../src/shards/driftwood-isle/generators/mantisEarlyKneeClips';
import { mantisPrecontactClips } from '../../../../src/shards/driftwood-isle/generators/mantisPrecontactClips';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()), skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.name = def.name; joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones,
    dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'attack', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}
function bone(bones: Record<string, Bone>, name: string): Bone {
  const result = bones[name]; if (result === undefined) throw new Error(`Missing ${name}`); return result;
}

function snapshot(bones: Record<string, Bone>) {
  return Object.fromEntries(Object.entries(bones).map(([name, b]) => [name, [...b.position, ...b.quaternion]]));
}

const animate = numericCreaturePose(mantisPrecontactClips()), fallback = numericCreaturePose(mantisEarlyKneeClips());
function pose(stage: number, phase: number, clock: number, attack: number, old = false, extra: Partial<AnimalRigContext> = {}) {
  const f = rig(); Object.assign(f.context, extra, { attack });
  Object.assign(f.context.mem, { 'mantis-st': stage, 'mantis-pose-phase': phase, 'mantis-pose-clock': clock });
  (old ? fallback : animate)(f.context); return f;
}

const schema = v.array(v.object({frame:v.number(),bout:v.number(),bones:v.record(v.string(),v.array(v.number())),poseInputs:v.nullable(v.object({bout:v.number(),t:v.number(),attack:v.number(),speed:v.number(),gait:v.number(),deathT:v.number(),flinch:v.number(),alive:v.boolean(),mem:v.record(v.string(),v.number())}))}));
test('every captured pose-owned input reproduces the exact evaluated candidate7 joints',()=>{
 const tracePath='tmp/mantis-precontact-capture-run2/render-trace.json';
 const trace=v.parse(schema,JSON.parse(readFileSync(tracePath,'utf8')));
 let cases=0,missing=0,maxError=0; const failures=[];
 for(const row of trace) {
  const input=row.poseInputs; if(!input){missing++;continue;}
  const fixture=pose(input.mem['mantis-st']??0,input.mem['mantis-pose-phase']??0,input.mem['mantis-pose-clock']??0,input.attack,false,{t:input.t,speed:input.speed,phase:input.gait,deathT:input.deathT,flinch:input.flinch,alive:input.alive});
  let error=0; for(const [name,values] of Object.entries(snapshot(fixture.bones))) for(let i=0;i<values.length;i++) error=Math.max(error,Math.abs((values[i]??Infinity)-(row.bones[name]?.[i]??-Infinity)));
  maxError=Math.max(maxError,error);if(error>1e-12)failures.push({frame:row.frame,bout:row.bout,error});
  expect(input.bout).toBe(row.bout); cases++;
 }
 writeFileSync('docs/reviews/mantis-precontact-independent/capture2/pose-parity.json',JSON.stringify({tracePath,cases,missing,maxError,failures},null,2)+'\n');
 expect(cases).toBeGreaterThan(0);expect(missing).toBe(0);expect(maxError).toBeLessThan(1e-12);
},120000);
