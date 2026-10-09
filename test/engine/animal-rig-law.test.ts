// oxlint-disable-next-line import/no-nodejs-modules -- Exact joint comparisons against captured shipping expressions.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Source-hash fence for the frozen pose oracle.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Source-hash fence for the frozen pose oracle.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { it,expect } from 'vitest';
import { Euler,Vector3 } from 'three';
import { QuadrupedRigPose,applyAnimalRoot,type AnimalRigJoint } from '../../src/engine/entities/animalRig';
import { AnimalPoseLaw } from '../../src/engine/entities/animalPose';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { ShippingQuadrupedRigPose } from '../fixtures/animal-pose/jointShipping';
import { fakeWorld } from '../fake/world';

for(const kind of ['boar','bear'])it(`${kind}: shipping joints and 5k restored suffix match exactly across 10k pose frames`,()=>{
  const world=fakeWorld(),factory=new AnimalFactory(world.sky,{style:'toon',render:{lowPoly:true,waitForModels:false,furRim:false,tintRange:0,oneMaterial:true}});
  const model=factory.model(kind,kind==='boar'?'boar':'brown'),old=factory.instantiate(model,.3),actual=factory.instantiate(model,.3),restored=factory.instantiate(model,.3);
  const expected=new ShippingQuadrupedRigPose(old.bones),law=new QuadrupedRigPose(actual.bones),resumed=new QuadrupedRigPose(restored.bones);
  const scalar=new AnimalPoseLaw({dims:model.dims,custom:false}),clock={bodyY:model.dims.bodyY,alive:true,deathT:-1,deathSide:1,speed:0,legAbd:new Float32Array([.35,.25,.35,.25])};
  let time=0;
  for(let tick=0;tick<10_000;tick++){
    const dt=[1/60,1/30,1/20,0][tick%4];if(dt===undefined)throw new Error('Missing scheduled pose frame');time+=dt;
    const phase=tick%1000,i=scalar.input;
    i.speed=phase<200?0:phase<400?.4:phase<600?3:6;i.desiredSpeed=i.speed;i.state=phase<200?'graze':'wander';i.alive=phase<900;
    i.deathT=i.alive?-1:(phase-900)/100;i.deathSide=tick%2000<1000?-1:1;i.flinch=Math.max(0,Math.sin(time));i.brace=.3;
    scalar.advance(dt,time,true);clock.alive=i.alive;clock.deathT=i.deathT;clock.deathSide=i.deathSide;clock.speed=i.speed;
    expected.apply(scalar.pose,dt,clock);law.apply(scalar.pose,dt,clock);
    old.mesh.updateMatrixWorld(true);actual.mesh.updateMatrixWorld(true);
    for(const [name,bone] of Object.entries(old.bones)){
      const joint=actual.bones[name];if(joint===undefined)throw new Error('Missing real recipe joint');
      assert.deepStrictEqual(joint.position.toArray(),bone.position.toArray());assert.deepStrictEqual(joint.quaternion.toArray(),bone.quaternion.toArray());
      assert.deepStrictEqual(joint.scale.toArray(),bone.scale.toArray());assert.deepStrictEqual(joint.matrixWorld.elements,bone.matrixWorld.elements);
    }
    if(tick===4999){
      resumed.restore(law.snapshot());
      for(const [name,bone] of Object.entries(actual.bones)){const joint=restored.bones[name];if(joint===undefined)throw new Error('Missing restored joint');joint.position.copy(bone.position);joint.rotation.copy(bone.rotation);joint.scale.copy(bone.scale);}
    }else if(tick>=5000){
      resumed.apply(scalar.pose,dt,clock);restored.mesh.updateMatrixWorld(true);
      for(const [name,bone] of Object.entries(actual.bones)){const joint=restored.bones[name];if(joint===undefined)throw new Error('Missing restored joint');assert.deepStrictEqual(joint.matrixWorld.elements,bone.matrixWorld.elements);}
      assert.equal(resumed.snapshot(),law.snapshot());
    }
  }
});
it('accepts only numeric transform joints, restores without writing joints, and refuses bad continuation atomically',()=>{
  const names=['body','neck1','neck2','head','earL','earR','tail','belly','FL_shoulder','FL_carpus','FL_fetlock','FR_shoulder','FR_carpus','FR_fetlock','BL_hip','BL_stifle','BL_hock','BR_hip','BR_stifle','BR_hock'];
  const bones:Record<string,AnimalRigJoint>={};for(const name of names)bones[name]={position:new Vector3(),rotation:new Euler(),scale:new Vector3(1,1,1)};
  const law=new QuadrupedRigPose(bones),before=JSON.stringify(bones);law.restore(4);expect(JSON.stringify(bones)).toBe(before);expect(law.snapshot()).toBe(4);
  for(const value of [Number.NaN,Infinity,-1])expect(()=>law.restore(value)).toThrow('Invalid quadruped pose continuation');expect(law.snapshot()).toBe(4);
  expect(()=>new QuadrupedRigPose({})).toThrow('Missing quadruped pose joint');
});
it('matches the shipping root expression for custom flinch, terrain tilt, and post-motion position',()=>{
  const root={position:new Vector3(),rotation:new Euler()},position=new Vector3(),expected=new Euler();
  for(let frame=0;frame<10_000;frame++){
    const t=frame/60,custom=frame%2===0,alive=frame%7<6,flinch=Math.sin(t)*.3,flinchPitch=.15,flinchRoll=-.2,tiltPitch=Math.cos(t)*.2,tiltRoll=Math.sin(t)*.1,yaw=t*.05;
    position.set(Math.sin(t),2+Math.sin(t*.3),Math.cos(t));applyAnimalRoot(root,position,yaw,tiltPitch,tiltRoll,custom,alive,flinch,flinchPitch,flinchRoll);
    const f=custom&&alive?flinch*1.8:0;expected.set(tiltPitch+flinchPitch*f,yaw,tiltRoll+flinchRoll*f,'YXZ');
    assert.deepStrictEqual(root.position.toArray(),position.toArray());assert.deepStrictEqual(root.rotation.toArray(),expected.toArray());
  }
});
it('fences the actual shipping joint expressions and their test-only capture',()=>{
  const source=v.parse(v.strictObject({source:v.string(),revision:v.string(),sha256:v.string(),section:v.string(),sectionSha256:v.string(),oracleSha256:v.string()}),JSON.parse(readFileSync(new URL('../fixtures/animal-pose/jointShipping.json',import.meta.url),'utf8')));
  expect(source.source).toBe('src/engine/entities/AnimalView.ts');expect(source.revision).toMatch(/^[a-f0-9]{40}$/u);expect(source.sha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(createHash('sha256').update(source.section).digest('hex')).toBe(source.sectionSha256);
  expect(createHash('sha256').update(readFileSync(new URL('../fixtures/animal-pose/jointShipping.ts',import.meta.url))).digest('hex')).toBe(source.oracleSha256);
});
