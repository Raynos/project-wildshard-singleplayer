import { it, expect } from 'vitest';
import { Vector3 } from 'three';
import { AnimalPoseLaw } from '../../src/engine/entities/animalPose';
import { AnimalSim, type AnimalSimSpec } from '../../src/engine/entities/AnimalSim';

const spec:AnimalSimSpec={kind:'fixture',variant:'fixture',label:'Fixture',rarity:'common',hp:60,aggressive:false,
  dims:{bodyY:1,bodyHalfLen:1,bodyRadius:.5,headRadius:.2,legLen:.6,halfWidth:.3,feet:[]},
  mods:{speed:1,chargeDist:1,chargeDamage:25,damageTaken:1,relentless:false}};
const make=():AnimalSim=>new AnimalSim(spec,.3,1,'fixture:1',{heightAt:()=>0,random:()=>.5});
it('preserves unbound dimension defaults and no fore volume',()=>{
  const actor=make(),head=new Vector3(),a=new Vector3(),b=new Vector3();actor.place(2,3,0,4);
  expect(actor.headWorld(head)).toBe(head);expect(head.toArray()).toEqual([2,5,4]);
  actor.bodyCapsule(a,b);expect(a.toArray()).toEqual([2,5,2]);expect(b.toArray()).toEqual([2,5,4]);
  const before=actor.snapshot();expect(actor.foreCapsule(a,b)).toBe(false);expect(actor.snapshot()).toEqual(before);
});
it('binds without querying, preserves one actor owner, and reads only explicit published history',()=>{
  const actor=make(),head=new Vector3(),a=new Vector3(),b=new Vector3();let published=1,queries=0;
  const before=actor.snapshot();actor.bindVolumes({entityId:actor.entityId,headWorld:out=>{queries++;out.set(published,2,3);},
    bodyCapsule:(rear,front)=>{queries++;rear.set(published,0,0);front.set(published,2,0);},foreCapsule:(rear,front)=>{queries++;rear.set(published,2,0);front.set(published,3,0);return true;}});
  expect(queries).toBe(0);expect(actor.snapshot()).toEqual(before);actor.step(1/60);
  expect(actor.headWorld(head)).toBe(head);expect(head.toArray()).toEqual([1,2,3]);actor.bodyCapsule(a,b);expect(a.x).toBe(1);
  expect(actor.foreCapsule(a,b)).toBe(true);expect(b.toArray()).toEqual([1,3,0]);expect(queries).toBe(3);
  // New local/body state cannot publish by being queried; its owner explicitly publishes after contacts.
  actor.place(100,100,2,7);expect(actor.headWorld(head).x).toBe(1);published=2;expect(actor.headWorld(head).x).toBe(2);
  expect(()=>actor.bindVolumes({entityId:actor.entityId,headWorld:()=>undefined,bodyCapsule:()=>undefined})).toThrow('Incompatible creature volume binding');
});
it('rejects a different actor before callbacks or actor mutation, leaving binding available',()=>{
  const actor=make();let queries=0;const before=actor.snapshot();
  expect(()=>actor.bindVolumes({entityId:'other:1',headWorld:()=>{queries++;},bodyCapsule:()=>{queries++;}})).toThrow('Incompatible creature volume binding');
  expect(queries).toBe(0);expect(actor.snapshot()).toEqual(before);
  actor.bindVolumes({entityId:actor.entityId,headWorld:out=>{out.set(4,5,6);},bodyCapsule:()=>undefined});
  expect(actor.headWorld(new Vector3()).toArray()).toEqual([4,5,6]);
});
it('restore never queries or advances the separately owned publication continuation',()=>{
  const actor=make();let queries=0,published=1;
  actor.bindVolumes({entityId:actor.entityId,headWorld:out=>{queries++;out.set(published,0,0);},bodyCapsule:()=>{queries++;}});
  actor.place(1,2,0,3);const saved=actor.snapshot();actor.place(5,6,0,7);published=2;actor.restore(saved);
  expect(queries).toBe(0);expect(actor.snapshot()).toEqual(saved);expect(actor.headWorld(new Vector3()).x).toBe(2);
  // The trusted host adapter restores its own history; restoring this actor neither resets nor consumes it.
  published=1;expect(actor.headWorld(new Vector3()).x).toBe(1);
});

it('samples owned clocks without a second attack tick or a restore RNG draw and resumes 5k pose frames exactly',()=>{
  let draws=0;const ports={heightAt:(x:number,z:number)=>Math.sin(x*.3)*.2+Math.cos(z*.5)*.1,random:()=>{draws++;return .5;}};
  const control=new AnimalSim(spec,.3,1,'fixture:1',ports),restored=new AnimalSim(spec,.3,1,'fixture:1',ports);
  const pose=new AnimalPoseLaw({dims:spec.dims,custom:false}),resumed=new AnimalPoseLaw({dims:spec.dims,custom:false});
  control.startAttack(1);control.step(1/60);control.advancePose(pose,1/60,1/60,true);
  expect(control.snapshot().motion.attackT).toBe(1/60);
  let time=1/60;
  for(let tick=0;tick<10_000;tick++){
    const dt=[1/60,1/30,1/20,0][tick%4];if(dt===undefined)throw new Error('Missing scheduler frame');time+=dt;
    const actors=tick<5000?[control]:[control,restored];
    for(const actor of actors){actor.setMotion(Math.sin(time*.3),tick%1000<400?.4:3);if(tick%1000===0)actor.startAttack(.6);actor.step(dt);}
    if(tick%6===0){control.samplePoseTerrain(pose);if(tick>=5000)restored.samplePoseTerrain(resumed);}
    const near=tick%70<63;control.advancePose(pose,dt,time,near);
    if(tick===4999){const before=draws;restored.restore(control.snapshot());resumed.restore(pose.snapshot());expect(draws).toBe(before);}
    else if(tick>=5000){restored.advancePose(resumed,dt,time,near);expect(restored.snapshot()).toEqual(control.snapshot());expect(resumed.snapshot()).toBe(pose.snapshot());}
  }
  expect(draws).toBe(0);
});
