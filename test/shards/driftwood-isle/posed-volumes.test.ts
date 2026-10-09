// oxlint-disable-next-line import/no-nodejs-modules -- Bit-exact local transforms and restored continuation comparisons.
import assert from 'node:assert/strict';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the frozen actual shipping pose expression capture.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the frozen actual shipping expression capture.
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim, type AnimalSimSpec } from '../../../src/engine/entities/AnimalSim';
import { heightAt } from '../../../src/engine/world/Heightfield';
import { AnimalFactory } from '../../../src/engine/entities/AnimalFactory';
import { DriftwoodPosedVolumes, type DriftwoodPoseRecipe } from '../../../src/shards/driftwood-isle/runtime/posedVolumes';
import { shippingCrab as animateCrab, shippingMonkey as animateMonkey, shippingSailor as animateSailor } from '../../fixtures/animal-pose/customShipping';
import { installDriftwoodSpecies } from '../../../src/shards/driftwood-isle/species/install';
import { ShippingRigPoseOracle } from '../../fixtures/animal-pose/rigShipping';
import { fakeWorld } from '../../fake/world';

class Actor extends AnimalSim {
  prime(phase: number): void {
    if (phase === 0) { this.flinch = 1; this.brace = 1; this.deathT = -1; }
    if (phase === 900) this.deathT = 0;
    this.flinchRoll = .12; this.flinchPitch = -.08; this.deathSide = -1;
    this.attackT = phase < 30 ? phase / 60 : -1; this.attackDur = .6;
  }
}
class SourceView extends ShippingRigPoseOracle { recipeSpec(): AnimalSimSpec { return this.simSpec; } }
installDriftwoodSpecies();
const cases = [
  {kind:'boar',variant:'boar',animate:undefined}, {kind:'bear',variant:'brown',animate:undefined},
  {kind:'crab',variant:'big',animate:animateCrab}, {kind:'monkey',variant:'monkey',animate:animateMonkey}, {kind:'sailor',variant:'sailor',animate:animateSailor},
];
for (const row of cases) it(`${row.kind}: native volumes preserve the real rig's prior publication for 10k frames and an exact restored suffix`,()=>{
  const w=fakeWorld(),factory=new AnimalFactory(w.sky,{style:'toon',render:{lowPoly:true,waitForModels:false,furRim:false,tintRange:0,oneMaterial:true}}),model=factory.model(row.kind,row.variant),rig=factory.instantiate(model,.31);
  const old=new SourceView(rig,model,.31,1.3,'proof:1'),spec:AnimalSimSpec={...old.recipeSpec()},names=Object.keys(rig.bones);
  const recipe:DriftwoodPoseRecipe={custom:model.species.rig==='custom',...(model.species.gait===undefined?{}:{gait:model.species.gait}),...(model.species.pose===undefined?{}:{pose:model.species.pose}),
    joints:names.map(name=>{const b=rig.bones[name];if(b===undefined)throw new Error('Missing real source joint');return{name,parent:b.parent===null?-1:names.findIndex(k=>rig.bones[k]===b.parent),position:[b.position.x,b.position.y,b.position.z],order:b.rotation.order,scale:[b.scale.x,b.scale.y,b.scale.z]};})};
  const make=():Actor=>new Actor(spec,.31,1.3,'proof:1',{heightAt,random:()=>{throw new Error('Pose consumed RNG');}});
  const native=make(),pose=new DriftwoodPosedVolumes(native,recipe,row.animate);let clone:Actor|null=null,restored:DriftwoodPosedVolumes|null=null,time=0;
  const expected=new Vector3(),actual=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),d=new Vector3();
  const compare=(owner:DriftwoodPosedVolumes):void=>{old.headWorld(expected);owner.headWorld(actual);expect(actual.distanceTo(expected)).toBeLessThan(1e-12);old.bodyCapsule(a,b);owner.bodyCapsule(c,d);expect(a.distanceTo(c)).toBeLessThan(1e-12);expect(b.distanceTo(d)).toBeLessThan(1e-12);};
  for(let tick=0;tick<10_000;tick++){
    const dt=[1/60,1/30,1/20,0][tick%4];if(dt===undefined)throw new Error('Missing shipping frame');time+=dt;
    const phase=tick%1000;
    for(const actor of [old,native,...(clone===null?[]:[clone])]){
      actor.position.set(Math.sin(time)*4,.3,Math.cos(time)*8);actor.yaw=Math.sin(time*.2);actor.speed=phase<200?0:phase<400?.4:phase<600?3:6;actor.strafe=Math.sin(time)*.1;
      actor.desiredSpeed=actor.speed;actor.desiredStrafe=actor.strafe;actor.desiredYaw=actor.yaw;actor.lookTarget.set(5,2,8);actor.lookWeight=Math.max(0,Math.sin(time*.3));actor.state=phase<200?'graze':'wander';actor.prime(phase);
      Object.assign(actor.mem,{init:1,rise:.6,rising:1,sinking:0,floor:.4});actor.levelGround=tick%33===0;
    }
    if(tick%6===0){old.sampleTerrain();pose.sampleTerrain();restored?.sampleTerrain();}
    compare(pose);if(restored!==null)compare(restored);
    native.step(dt);clone?.step(dt);const near=tick%70<63;old.update(dt,time,near);pose.advance(dt,time,near);restored?.advance(dt,time,near);
    compare(pose);if(restored!==null)compare(restored);
    for(const name of names){const bone=rig.bones[name],joint=pose.bones[name];if(bone===undefined||joint===undefined)throw new Error('Missing posed joint');assert.deepStrictEqual(joint.position.toArray(),bone.position.toArray(),`${name}:position:${tick}`);assert.deepStrictEqual(joint.rotation.toArray(),bone.rotation.toArray(),`${name}:rotation:${tick}`);assert.deepStrictEqual(joint.scale.toArray(),bone.scale.toArray(),`${name}:scale:${tick}`);}
    assert.deepStrictEqual(native.mem,old.mem);assert.deepStrictEqual(native.position.toArray(),old.position.toArray());assert.equal(native.yOffset,old.yOffset);
    if(tick===5000){const state=pose.snapshot();clone=make();clone.restore(native.snapshot());restored=new DriftwoodPosedVolumes(clone,recipe,row.animate);restored.restore(state);assert.equal(restored.snapshot(),state);compare(restored);}
    if(restored!==null)assert.equal(restored.snapshot(),pose.snapshot());
    old.mesh.updateMatrixWorld(true);pose.publish();restored?.publish();compare(pose);if(restored!==null)compare(restored);
  }
  const before=pose.snapshot();expect(()=>pose.restore(before.replace('"version":1','"version":2'))).toThrow();expect(pose.snapshot()).toBe(before);
  const malformed=v.parse(v.looseObject({local:v.array(v.number())}),JSON.parse(before));malformed.local[0]=0x7ff00000;malformed.local[1]=0;expect(()=>pose.restore(JSON.stringify(malformed))).toThrow();expect(pose.snapshot()).toBe(before);
});

it('fences the actual shipping custom pose expression capture',()=>{
  const raw: unknown = JSON.parse(readFileSync(new URL('../../fixtures/animal-pose/customShipping.json',import.meta.url),'utf8'));
  const row=v.strictObject({source:v.string(),revision:v.string(),sha256:v.string(),body:v.string(),bodySha256:v.string()});
  const source=v.parse(v.strictObject({crab:row,monkey:row,sailor:row,captain:row,oracleSha256:v.string()}),raw);
  expect(createHash('sha256').update(readFileSync(new URL('../../fixtures/animal-pose/customShipping.ts',import.meta.url))).digest('hex')).toBe(source.oracleSha256);
  for(const section of [source.crab,source.monkey,source.sailor,source.captain]){expect(section.revision).toMatch(/^[a-f0-9]{40}$/u);expect(section.sha256).toMatch(/^[a-f0-9]{64}$/u);expect(createHash('sha256').update(section.body).digest('hex')).toBe(section.bodySha256);}
});
