import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Bone, Group, Matrix4, Vector3 } from 'three';
import { LimbRigSchema, parseLimbBlend, readBakedClips } from '../src/format/limbRig';
import { readLimbCollisionBake } from '../src/format/limbCollision';
import { LimbAnimator, type LimbPoseInput } from '../src/game/animation/limbBlend';
import { limbRest, applyLimbPose, newLimbPose } from '../src/game/animation/limbRig';
import { LimbQueryPose } from '../src/game/animation/limbQueryPose';
import { installKingPoseKeeper } from './fixtures/pine/kingPoseBefore';
import { installNativeLimbPoses } from '../src/game/animation/limbPopulation';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { nativeCreaturePose } from '../src/game/plugin/animation';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { readKingRig } from './fixtures/pine/kingRigOracle';
import { advanceKingPose, kingRest, applyKingPose, newPose, clipPose } from './fixtures/pine/kingRigBefore';
import { pineKingCollision } from '../src/shards/pine-hollow/generators/kingCollision';
import { KING_RIG } from '../src/shards/pine-hollow/data/kingRig';
import blend from '../src/shards/pine-hollow/data/kingBlend.json' with { type: 'json' };
import clips from '../src/shards/pine-hollow/data/kingClips.generated.json' with { type: 'json' };
import collision from '../src/shards/pine-hollow/data/kingCollision.generated.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- Native fixture reads the committed physics runtime.
import { readFileSync } from 'node:fs';

const input = (): LimbPoseInput => ({ dt: 1/60, t: 0, scale: 2.6, speed: 0, deathT: -1,
  flinch: 0, brace: 0, attack: -1, lookWeight: 1, yaw: .4,
  lookTarget: { x: 14, y: 3, z: 7 }, position: { x: 4, y: 1, z: -2 }, mem: {} });

for (const tier of ['phone', 'desktop'] as const) {
  test(`King ${tier}: exact old/new scalar, bone and matrix parity over every clip and blended frame`, () => {
    const old = readKingRig('.', tier), next = readKingRig('.', tier), animator = new LimbAnimator(parseLimbBlend(blend), clips, 'head');
    const oldRest = kingRest(old.bones), rest = limbRest(KING_RIG, next.bones), before = newPose(), after = newLimbPose();
    const a = input(), b = input();
    for (let tick = 0; tick < 720; tick++) {
      const clock = tick / 60, speed = tick < 100 ? 0 : tick < 250 ? 2.2 : tick < 400 ? 13 : 1;
      const attack = tick >= 400 && tick < 650 ? ((tick - 400) % 70) / 50 : -1;
      for (const c of [a, b]) {
        c.t = clock; c.speed = speed; c.attack = attack; c.mem['act'] = [1,2,3,4][Math.floor(tick/70)%4] ?? 0;
        c.flinch = tick % 53 < 8 ? .7 : 0; c.brace = tick % 47 < 6 ? .3 : 0; c.deathT = tick >= 680 ? (tick-680)/60 : -1;
      }
      advanceKingPose(a, oldRest, before); animator.advance(b, rest, after);
      expect(after).toEqual(before); expect(b.mem).toEqual(a.mem);
      applyKingPose(oldRest, before); applyLimbPose(KING_RIG, rest, after);
      old.group.updateMatrixWorld(true); next.group.updateMatrixWorld(true);
      for (const name of Object.keys(old.bones)) expect(next.bones[name]?.matrixWorld.elements).toEqual(old.bones[name]?.matrixWorld.elements);
    }
    for (const name of Object.keys(clips.clips)) for (const phase of [0,.17,.5,.83,1]) {
      if (!['idle','walk','charge','strike','hit','sweep','roar','brace','die'].includes(name)) throw new Error('Unexpected King clip');
      const key = v.parse(v.picklist(['idle','walk','charge','strike','hit','sweep','roar','brace','die']), name);
      expect(animator.sample(after, name, phase, 2.7)).toEqual(clipPose(before, key, phase, 2.7));
    }
  });
}

test('King collision bake and all attack transform hashes retain the old GLB oracle', () => {
  expect(readLimbCollisionBake(pineKingCollision())).toEqual(readLimbCollisionBake(collision));
});

// Invented second shard: different skeleton names, proportions, clip ids, action ids and memory fields.
const marshRig = v.parse(LimbRigSchema, {
  spine: { root:'trunk',hips:'pelvis',tail:'rudder',chest:'shoulders',neck:'throat',head:'muzzle' },
  hipsCounter:[.2,.3],heightFrom:['fl0','fr0'],minHeight:.2,walkStride:.8,chargeStride:1.5,
  limbs:[['fl0','fl1','fl2','fl3'],['fr0','fr1','fr2','fr3'],['bl0','bl1','bl2','bl3'],['br0','br1','br2','br3']],
});
const marshBlend = parseLimbBlend({ clips:{idle:'breathe',walk:'amble',run:'bound',death:'fold',hit:'recoil'},
  memory:{walk:'amble-w',run:'bound-w',phase:'cycle',action:'move',held:'hold'},
  defaultAttack:'stamp', attacks:[{ action:29,clip:'stamp',weight:.8,suppressLook:false }],
  walk:[.1,.7], run:[2,4], response:[4,3], hold:[.2,.9],
  brace:.6, look:{yaw:1.1,up:.6,down:.8,fallbackHeight:1.7,runFade:.4,neckYaw:.55,headYaw:.25,headPitch:.75},
});
const marshClips = { version:1, clips:Object.fromEntries(['breathe','amble','bound','fold','recoil','stamp'].map((name,i) =>
  [name,{channels:['rootY','headPitch',1],x:[0,1,2,0],values:[0,0,0,.02*i,.03*i,.04*i]}])) };
const marshCollision = { version:1,hz:60,
  joints:[{parent:-1,position:[0,2,0]},{parent:0,position:[0,0,.7]},
    {parent:1,position:[0,.2,.2]},{parent:2,position:[0,.3,.2]}],
  rest:{at:{muzzle:{x:0,y:2.5,z:1.1}},rootPos:{x:0,y:2,z:0},H:1.2,walkStride:.8,chargeStride:1.5},
  volumes:{head:[0,0,.2],body:{at:[0,.1,0],pitch:.15,halfLength:.6},fore:{at:[0,0,.4],halfLength:.4},ribs:[0,.1,.2]},clips:[],
};
function marshSkeleton() {
  const bones: Record<string,Bone> = {}, group = new Group();
  const add = (name:string,parent:string|null,at:readonly [number,number,number]): void => {
    const b=new Bone(); b.name=name; b.position.set(...at); bones[name]=b;
    if(parent===null)group.add(b);else {const p=bones[parent];if(p===undefined)throw new Error('Missing test parent');p.add(b);}
  };
  add('trunk',null,[0,2,0]);add('pelvis','trunk',[0,0,-.8]);add('rudder','pelvis',[0,0,-.3]);
  add('shoulders','trunk',[0,0,.7]);add('throat','shoulders',[0,.2,.2]);add('muzzle','throat',[0,.3,.2]);
  for(const [i,chain] of marshRig.limbs.entries()) {
    const [a,b,c,d]=chain,side=i%2===0?1:-1;
    add(a,i<2?'shoulders':'pelvis',[side*.4,0,0]);add(b,a,[0,-.8,.2]);add(c,b,[0,-.8,-.2]);add(d,c,[0,-.4,.1]);
  }
  return {bones,group};
}
test('invented marsh quadruped rows drive bounded clips, custom bone names and planted-foot IK', () => {
  const {bones,group}=marshSkeleton(),rest=limbRest(marshRig,bones),animator=new LimbAnimator(marshBlend,marshClips,'muzzle');
  const c=input(),pose=newLimbPose(); c.scale=1;c.speed=3;c.mem['move']=29;c.attack=.6;
  animator.advance(c,rest,pose);expect(c.mem['cycle']).toBeGreaterThan(0);expect(c.mem['ph']).toBeUndefined();
  applyLimbPose(marshRig,rest,pose);group.updateMatrixWorld(true);
  for(const b of Object.values(bones))expect(b.matrixWorld.elements.every(Number.isFinite)).toBe(true);
  const zero=newLimbPose(); applyLimbPose(marshRig,rest,zero);group.updateMatrixWorld(true);
  for(const chain of marshRig.limbs) {
    const foot=bones[chain[3]],at=rest.at[chain[3]];if(foot===undefined||at===undefined)throw new Error('Missing test foot');
    expect(foot.getWorldPosition(new Vector3()).distanceTo(at)).toBeLessThan(1e-12);
  }
  expect(()=>readBakedClips({version:1,clips:{bad:{channels:[0],x:[0,1,2,0],values:[1]}}})).toThrow();
  expect(()=>parseLimbBlend({...marshBlend,hold:[1,0]})).toThrow();
  expect(()=>new LimbAnimator(marshBlend,{version:1,clips:{}},'muzzle')).toThrow();
});

test('query publication and restore keep body, chest and head read clocks separate', () => {
  const data=readLimbCollisionBake(collision), query=new LimbQueryPose(data.joints,data.volumes), pose=newLimbPose(),frame=new Matrix4();
  query.stage(pose);query.publish(frame,'head');const before=query.snapshot();
  pose.rootY=.8;pose.headPitch=.3;query.stage(pose);
  expect(query.snapshot().published).toEqual(before.published);
  query.publish(frame,'ribs');expect(query.snapshot().published.head).toEqual(before.published.head);
  expect(query.snapshot().published.ribs).not.toEqual(before.published.ribs);
  const staged=query.snapshot(),resumed=new LimbQueryPose(data.joints,data.volumes);resumed.restore(staged);
  expect(resumed.snapshot()).toEqual(staged);expect(()=>resumed.restore({...staged,version:9})).toThrow();
  expect(resumed.snapshot()).toEqual(staged);query.publish(frame,'head');resumed.publish(frame,'head');
  expect(resumed.snapshot()).toEqual(query.snapshot());
});

test('invented native rows attach, save and restore through the built-in animal pose without a TS hook', async () => {
  const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host=createSimHost(SIM_LEVEL,{rapier});
  try {
    const poseRows={step:'marsh.poses',limit:2,near:80,head:'muzzle',
      collision:marshCollision,blend:marshBlend,clips:marshClips};
    const poses=installNativeLimbPoses(host,poseRows);
    const adopt = (owner: typeof host, service: typeof poses) => {
      const body=owner.entities.get('boar:1');if(body===undefined)throw new Error('Missing native fixture actor');
      const actor=Object.assign(body,{hidden:false,sampleTerrain:()=>{ /* replaced by platform owner */ }});
      service.attach(actor);return actor;
    };
    const actor=adopt(host,poses),pose=nativeCreaturePose(actor);pose.advance(1/60,1,true);pose.publish();
    const state=snapshotSimHost(host),fork=restoreSimHost(SIM_LEVEL,{rapier},state,owner=>{adopt(owner,installNativeLimbPoses(owner,poseRows));});
    try { expect(snapshotSimHost(fork)).toEqual(state); } finally { fork.dispose(); }
    const before=pose.snapshot();expect(()=>poses.attach(actor)).toThrow('duplicated');expect(pose.snapshot()).toBe(before);
    poses.retire(actor.entityId);expect(host.adapters.get('marsh.poses')?.snapshot()).toEqual({version:2,bodies:[]});
  }finally{host.dispose();}
});


test('native pose continuation and ranged publications exactly match the retired King owner', async () => {
  const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const before=createSimHost(SIM_LEVEL,{rapier}),after=createSimHost(SIM_LEVEL,{rapier});
  try {
    const old=installKingPoseKeeper(before),next=installNativeLimbPoses(after,{step:'pine.king.pose',limit:512,near:140,head:'head',collision,blend,clips});
    const bodies=[before,after].map(owner=>{const body=owner.entities.get('boar:1');if(body===undefined)throw new Error('Missing fixture actor');return Object.assign(body,{hidden:false,sampleTerrain:()=>{ /* platform replaces */ }});});
    const a=bodies[0],b=bodies[1];if(a===undefined||b===undefined)throw new Error('Missing parity pair');
    old.attach(a);next.attach(b);
    for(let tick=0;tick<360;tick++) {
      for(const body of bodies){body.speed=tick<120?2.2:13;body.mem['act']=tick<180?1:3;if(tick%120===0)body.startAttack(1.4);}
      before.step();after.step();
      expect(after.adapters.get('pine.king.pose')?.snapshot()).toEqual(before.adapters.get('pine.king.pose')?.snapshot());
      expect(nativeCreaturePose(b).snapshot()).toBe(nativeCreaturePose(a).snapshot());
      for(const body of bodies)nativeCreaturePose(body).publish('chest');
      expect(nativeCreaturePose(b).snapshot()).toBe(nativeCreaturePose(a).snapshot());
    }
  }finally{before.dispose();after.dispose();}
});
