import { it, expect } from 'vitest';
import { AnimalPoseLaw } from '../../src/engine/entities/animalPose';
import { AnimalSim, type AnimalSimSpec } from '../../src/engine/entities/AnimalSim';

const spec:AnimalSimSpec={kind:'fixture',variant:'fixture',label:'Fixture',rarity:'common',hp:60,aggressive:false,
  dims:{bodyY:1,bodyHalfLen:1,bodyRadius:.5,headRadius:.2,legLen:.6,halfWidth:.3,feet:[]},
  mods:{speed:1,chargeDist:1,chargeDamage:25,damageTaken:1,relentless:false}};
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
