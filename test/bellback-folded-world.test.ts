// oxlint-disable-next-line import/no-nodejs-modules -- Measure the preserved native mesh in a renderer-free transform sweep.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Matrix4, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { bellbackFoldedClips } from '../src/shards/driftwood-isle/generators/bellbackFoldedClips';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(), v.number(), v.number()]) })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }),
JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json', 'utf8')));

test('candidate2 actual numeric pose clears exact baseline world replay without root changes', () => {
  const bones: Record<string, Bone> = {}, inverses: Record<string, Matrix4> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing bind parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const root = bones['body']; if (root === undefined) throw new Error('Missing body');
  root.updateMatrixWorld(true);
  for (const [name, joint] of Object.entries(bones)) inverses[name] = joint.matrixWorld.clone().invert();
  const position = new Vector3(), mem = {};
  const context: AnimalRigContext = { bones, dims: { bodyY: 1.2000000476837158, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const animate = numericCreaturePose(bellbackFoldedClips());
  const trace=v.parse(v.array(v.object({world:v.array(v.number()),bones:v.record(v.string(),v.array(v.number())),alive:v.boolean(),deathT:v.number(),stage:v.number(),clock:v.number(),gameTime:v.number(),speed:v.number(),gait:v.number(),flinch:v.number()})),JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate2/baseline-observer/render-trace.json','utf8')));
  const point=new Vector3(),matrix=new Matrix4(),world=new Matrix4();
  let minimum=Infinity;const frames=[];
  for(const row of trace) {
    for(const [name,values] of Object.entries(row.bones)) {const bone=bones[name];if(bone===undefined)throw new Error('Missing bone');bone.position.fromArray(values);bone.quaternion.fromArray(values,3);}
    Object.assign(context,{t:row.gameTime,speed:row.speed,phase:row.gait,flinch:row.flinch,deathT:row.deathT,alive:row.alive});
    context.mem['tg-state']=row.stage;context.mem['tg-clock']=row.clock;
    animate(context);root.updateMatrixWorld(true);world.fromArray(row.world);
    const parts:Record<string,number>={};
    for(const part of native.parts) {
      const joint=bones[part.name],inverse=inverses[part.name];if(joint===undefined||inverse===undefined)throw new Error('Missing weighted bone');
      matrix.copy(world).multiply(joint.matrixWorld).multiply(inverse);let low=Infinity;
      for(let i=0;i<part.positions.length;i+=3) {point.fromArray(part.positions,i).applyMatrix4(matrix);low=Math.min(low,point.y-900);}
      parts[part.name]=low;minimum=Math.min(minimum,low);
    }
    frames.push({alive:row.alive,deathT:row.deathT,parts});
  }
  expect(trace.length).toBe(418);expect(minimum).toBeGreaterThanOrEqual(-.005);
  let settled: (typeof frames)[number] | undefined;
  for(const row of frames) if(!row.alive&&row.deathT===1)settled=row;
  if(settled===undefined)throw new Error('No settled frame');
  const feet=['leg0','leg1','leg2','leg3'].map(name=>settled.parts[name]??Infinity);
  expect(feet.every(height=>height>=-.005&&height<.035)).toBe(true);expect(feet.filter(height=>height<=.02).length).toBeGreaterThanOrEqual(3);
  mkdirSync('tmp/bellback-folded-measurement',{recursive:true});
  writeFileSync('tmp/bellback-folded-measurement/world-replay.json',JSON.stringify({schema:'wildshard.bellback.folded-replay.v1',acceptance:false,minimum,settledFeet:feet,frames},null,2));

});
