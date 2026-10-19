// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { bellbackNativeClips } from '../src/shards/driftwood-isle/generators/bellbackNativeClips';
import { bellbackFoldedClips, BELLBACK_FOLDED_JOINTS } from '../src/shards/driftwood-isle/generators/bellbackFoldedClips';
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_STRIKES } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { createBellbackFoldedPreviewOutput, createBellbackFoldedPreviewSource, BELLBACK_FOLDED_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/bellbackFoldedPreview';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json', 'utf8')));
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

test('exact eight joints and all declared pose DAGs bind', () => {
  expect(BELLBACK_FOLDED_JOINTS).toEqual(native.bones.map(row => row.name));
  const {context,bones}=rig(); const animate=numericCreaturePose(bellbackFoldedClips());
  for (const stage of [0,1,2,3,4,6]) for(let i=0;i<=40;i++) {
    context.mem['tg-state']=stage;context.mem['tg-clock']=i/20;context.phase=i/40;context.speed=.8;
    context.deathT=stage===6?i/40:-1;context.t=i/20;context.flinch=stage===4?.8:0;animate(context);
    for(const joint of Object.values(bones)) expect([...joint.position,...joint.rotation.toArray().slice(0,3)].every(x=>typeof x==='number'&&Number.isFinite(x))).toBe(true);
  }
});
test('isolated source contains one unchanged guest, three strikes, five aliases and no persistent progression',()=>{
 const source=createBellbackFoldedPreviewSource();expect(source.runtime?.spawns?.actors?.map(row=>row.kind)).toEqual(['bellback']);
 expect(source.state.shared.map(row=>row.name)).toEqual(['tg-state','tg-clock','tg-awake','tg-phase','tg-exposed']);
 expect(BELLBACK_FOLDED_PREVIEW_DECISION_MEMORY).toBe(131072);
 const output=createBellbackFoldedPreviewOutput({diagnosticOnly:true});
 expect(output.namedFiles?.map(row=>row.name)).toEqual(['poses/bellback.json','practice/bodies.json','practice/looks.json','practice/pickups.json']);
 expect(source.quests).toEqual({flags:[],quests:[],triggers:[],dialogue:[]});expect(source.encounters).toEqual([]);expect(source.ledger).toEqual([]);
});
test('idle, gait, pulse, echo, stomp and interrupt have visible distinct motion',()=>{
 const {context,bones}=rig(), animate=numericCreaturePose(bellbackFoldedClips());
 const joint=(name:string)=>{const value=bones[name];if(value===undefined)throw new Error('Missing joint');return value;};
 context.mem['tg-state']=0;context.t=.7;animate(context);expect(Math.abs(joint('head').rotation.x)).toBeGreaterThan(.02);
 context.t=0;context.speed=1;context.phase=.25;animate(context);expect(joint('leg0').rotation.x).toBeCloseTo(.12);expect(joint('leg1').rotation.x).toBeCloseTo(-.12);
 context.speed=0;context.mem['tg-state']=1;context.mem['tg-clock']=1.1;animate(context);expect(joint('clapper').rotation.x).toBeCloseTo(-.7);
 context.mem['tg-clock']=1.32;animate(context);expect(joint('clapper').rotation.x).toBeCloseTo(.5);
 context.mem['tg-state']=2;context.mem['tg-clock']=.8;animate(context);expect(joint('clapper').rotation.x).toBeCloseTo(.6);
 context.mem['tg-clock']=1;animate(context);expect(joint('clapper').rotation.x).toBeCloseTo(-.5);
 context.mem['tg-state']=3;context.mem['tg-clock']=.7;animate(context);expect(joint('leg0').position.y-joint('leg2').position.y).toBeCloseTo(.22);
 context.mem['tg-state']=4;context.flinch=1;animate(context);expect(joint('clapper').rotation.x).toBeCloseTo(0);expect(joint('head').rotation.x).toBeCloseTo(-.12);
});
test('settled death remains unchanged under later attack clocks, speed and flinch',()=>{
 const {context,bones}=rig(),animate=numericCreaturePose(bellbackFoldedClips());
 context.deathT=1;context.alive=false;context.mem['tg-state']=6;animate(context);
 const snapshot=()=>Object.values(bones).map(row=>({position:row.position.toArray(),rotation:row.rotation.toArray()}));const dead=snapshot();
 context.t=100;context.speed=1;context.phase=.25;context.flinch=1;context.mem['tg-state']=1;context.mem['tg-clock']=1.1;animate(context);expect(snapshot()).toEqual(dead);
});

test('preserved Bellback clocks are authoritative time-driven ring/arc strikes, never moving lanes',()=>{
 const strikes=TIDAL_GIANTS_STRIKES.filter(row=>row.id.startsWith('strike.bellback.'));expect(strikes.map(row=>[row.windup,row.active,row.recover])).toEqual([[1.2,.12,.2],[.85,.15,.6],[.85,.15,.7]]);expect(strikes.every(row=>!('motion' in row))).toBe(true);
 const guest=TIDAL_GIANTS_DECISIONS.find(row=>row.id==='driftwood.bellback.decision');expect(guest?.source).toBe('behaviour/bellback.as');expect(guest?.reads).toContain('strikeState');
});

test('anatomy-only candidate preserves every living joint output exactly',()=>{
 const before=rig(),after=rig(),oldPose=numericCreaturePose(bellbackNativeClips()),newPose=numericCreaturePose(bellbackFoldedClips());
 for(const state of [0,1,2,3,4]) for(let i=0;i<=40;i++) {
  for(const {context} of [before,after]) {context.mem['tg-state']=state;context.mem['tg-clock']=i/20;context.t=i/10;context.speed=.8;context.phase=i/40;context.flinch=state===4?.7:0;}
  oldPose(before.context);newPose(after.context);
  for(const name of Object.keys(before.bones)) {
   const a=before.bones[name],b=after.bones[name];if(a===undefined||b===undefined)throw new Error('Missing joint');
   expect(b.position.toArray()).toEqual(a.position.toArray());expect(b.quaternion.toArray()).toEqual(a.quaternion.toArray());
  }
 }
});
