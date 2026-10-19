// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { brinePitcherNativeClips, BRINE_PITCHER_JOINTS } from '../src/shards/driftwood-isle/generators/brinePitcherNativeClips';
import { BRINE_PITCHER_DECISIONS, BRINE_PITCHER_STRIKES } from '../src/shards/driftwood-isle/generators/brinePitcherCombat';
import { createBrinePitcherNativePreviewOutput, createBrinePitcherNativePreviewSource, BRINE_PITCHER_NATIVE_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/brinePitcherNativePreview';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/approved-brine-pitcher/v3/native-source.json', 'utf8')));
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


test('seven native joints bind and retain rooted support through all phases',()=>{
 expect(BRINE_PITCHER_JOINTS).toEqual(native.bones.map(row=>row.name));
 const {context,bones}=rig(),animate=numericCreaturePose(brinePitcherNativeClips());
 const before=Object.values(bones).map(b=>b.position.toArray());
 for(const step of [0,1,2,3,4,6]) for(let i=0;i<61;i++) {
  context.mem['pitcher-step']=step;context.mem['pitcher-clock']=i/20;context.t=i/20;context.deathT=step===6?i/60:-1;context.flinch=step===4?.7:0;animate(context);
  expect(Object.values(bones).map(b=>b.position.toArray())).toEqual(before);
  expect(Object.values(bones).every(b=>b.rotation.toArray().slice(0,3).every(value=>typeof value==='number'&&Number.isFinite(value)))).toBe(true);
 }
});
test('idle, telegraph, snap, recovery, hit and death are distinct and stable',()=>{
 const {context,bones}=rig(),animate=numericCreaturePose(brinePitcherNativeClips());
 const joint=(name:string)=>{const b=bones[name];if(b===undefined)throw new Error(name);return b;};
 context.t=.8;animate(context);expect(Math.abs(joint('head').rotation.x)).toBeGreaterThan(.01);
 context.t=0;context.mem['pitcher-step']=1;context.mem['pitcher-clock']=1;animate(context);expect(joint('headLid').rotation.x).toBeCloseTo(-.4);
 context.mem['pitcher-clock']=1.31;animate(context);expect(joint('headLid').rotation.x).toBeCloseTo(.50);
 context.mem['pitcher-clock']=2.3;animate(context);expect(joint('headLid').rotation.x).toBeCloseTo(0);
 context.mem['pitcher-step']=4;context.flinch=1;animate(context);expect(joint('head').rotation.x).toBeCloseTo(-.12);
 context.deathT=1;animate(context);const dead=Object.values(bones).map(b=>b.rotation.toArray());
 context.t=100;context.mem['pitcher-step']=2;context.mem['pitcher-clock']=.95;context.flinch=0;animate(context);expect(Object.values(bones).map(b=>b.rotation.toArray())).toEqual(dead);
});
test('practice source has one guest, supported strikes, isolated rewards and no quests',()=>{
 const source=createBrinePitcherNativePreviewSource();
 expect(source.runtime?.spawns?.actors?.map(r=>r.kind)).toEqual(['brine-pitcher-matriarch']);
 expect(BRINE_PITCHER_NATIVE_PREVIEW_DECISION_MEMORY).toBe(131072);
 expect(source.quests).toEqual({flags:[],quests:[],triggers:[],dialogue:[]});expect(source.encounters).toEqual([]);expect(source.ledger).toEqual([]);
 expect(BRINE_PITCHER_DECISIONS[0].commands).not.toContain('move');
 expect(BRINE_PITCHER_STRIKES.map(s=>s.shape.kind)).toEqual(['arc','arc','arc']);
 expect(createBrinePitcherNativePreviewOutput({diagnosticOnly:true}).namedFiles?.map(r=>r.name)).toContain('poses/brine-pitcher-matriarch.json');
});
