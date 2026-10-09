// oxlint-disable-next-line import/no-nodejs-modules -- Bit-exact local transforms and restored continuation comparisons.
import assert from 'node:assert/strict';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the frozen actual shipping pose expression capture.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the frozen actual shipping expression capture.
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { Vector3, Euler } from 'three';
import type { AnimalRigContext, AnimalRigJoint } from '../../../src/engine/entities/animalRig';
import { animateCaptain } from '../../../src/shards/driftwood-isle/species/captainPose';
import { shippingCaptain } from '../../fixtures/animal-pose/customShipping';
import { AnimalSim, type AnimalSimSpec } from '../../../src/engine/entities/AnimalSim';
import { heightAt } from '../../../src/engine/world/Heightfield';
import { AnimalFactory } from '../../../src/engine/entities/AnimalFactory';
import { DriftwoodPosedVolumes, type DriftwoodPoseRecipe } from '../../../src/shards/driftwood-isle/runtime/posedVolumes';
import { animateCrab } from '../../../src/shards/driftwood-isle/species/crabPose';
import { animateMonkey } from '../../../src/shards/driftwood-isle/species/monkeyPose';
import { animateSailor } from '../../../src/shards/driftwood-isle/species/sailorPose';
import { installDriftwoodSpecies } from '../../../src/shards/driftwood-isle/species/install';
import { PoseViewFixture, ShippingRigPoseOracle } from '../../fixtures/animal-pose/rigShipping';
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
  const liveRig=factory.instantiate(model,.31),live=new PoseViewFixture(liveRig,model,.31,1.3,'proof:1');
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
    for(const actor of [old,live,native,...(clone===null?[]:[clone])]){
      actor.position.set(Math.sin(time)*4,.3,Math.cos(time)*8);actor.yaw=Math.sin(time*.2);actor.speed=phase<200?0:phase<400?.4:phase<600?3:6;actor.strafe=Math.sin(time)*.1;
      actor.desiredSpeed=actor.speed;actor.desiredStrafe=actor.strafe;actor.desiredYaw=actor.yaw;actor.lookTarget.set(5,2,8);actor.lookWeight=Math.max(0,Math.sin(time*.3));actor.state=phase<200?'graze':'wander';actor.prime(phase);
      Object.assign(actor.mem,{init:1,rise:.6,rising:1,sinking:0,floor:.4,drop:Number(row.kind==='monkey'&&phase>=100&&phase<200),climb:Number(row.kind==='monkey'&&phase>=200&&phase<300),perchH:3,bx:1,bz:2,px:2,pz:4});actor.levelGround=tick%33===0;
    }
    if(tick%6===0){old.sampleTerrain();live.sampleTerrain();pose.sampleTerrain();restored?.sampleTerrain();}
    compare(pose);if(restored!==null)compare(restored);
    native.step(dt);clone?.step(dt);const near=tick%70<63;old.update(dt,time,near);live.update(dt,time,near);pose.advance(dt,time,near);restored?.advance(dt,time,near);
    compare(pose);if(restored!==null)compare(restored);
    for(const name of names){const bone=rig.bones[name],joint=pose.bones[name],liveBone=liveRig.bones[name];if(bone===undefined||joint===undefined||liveBone===undefined)throw new Error('Missing posed joint');assert.deepStrictEqual(joint.position.toArray(),bone.position.toArray(),`${name}:position:${tick}`);assert.deepStrictEqual(joint.rotation.toArray(),bone.rotation.toArray(),`${name}:rotation:${tick}`);assert.deepStrictEqual(joint.scale.toArray(),bone.scale.toArray(),`${name}:scale:${tick}`);assert.deepStrictEqual(liveBone.position.toArray(),bone.position.toArray());assert.deepStrictEqual(liveBone.rotation.toArray(),bone.rotation.toArray());assert.deepStrictEqual(liveBone.scale.toArray(),bone.scale.toArray());}
    assert.deepStrictEqual(live.mem,old.mem);assert.deepStrictEqual(live.position.toArray(),old.position.toArray());assert.equal(live.yOffset,old.yOffset);assert.deepStrictEqual(native.mem,old.mem);assert.deepStrictEqual(native.position.toArray(),old.position.toArray());assert.equal(native.yOffset,old.yOffset);
    if(tick===5000){const state=pose.snapshot();clone=make();clone.restore(native.snapshot());restored=new DriftwoodPosedVolumes(clone,recipe,row.animate);restored.restore(state);assert.equal(restored.snapshot(),state);compare(restored);}
    if(restored!==null)assert.equal(restored.snapshot(),pose.snapshot());
    old.mesh.updateMatrixWorld(true);live.mesh.updateMatrixWorld(true);pose.publish();restored?.publish();compare(pose);if(restored!==null)compare(restored);
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

it('Captain: the extracted callback preserves every real rest joint through 10k phase/rise/death/attack poses', () => {
  const w = fakeWorld(), factory = new AnimalFactory(w.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } });
  const model = factory.model('captain', 'captain'), rig = factory.instantiate(model, .31);
  const actual: Record<string, AnimalRigJoint> = {}, expected: Record<string, AnimalRigJoint> = {};
  for (const [name, bone] of Object.entries(rig.bones)) {
    actual[name] = { position: bone.position.clone(), rotation: new Euler().copy(bone.rotation), scale: bone.scale.clone() };
    expected[name] = { position: bone.position.clone(), rotation: new Euler().copy(bone.rotation), scale: bone.scale.clone() };
  }
  const dims = model.dims;
  const actor = { mem: {}, position: new Vector3(), yOffset: 0 };
  const c: AnimalRigContext = { bones: actual, dims, dt: 1 / 60, t: 0, seed: .31, scale: 1.35, speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(4,2,8), lookWeight: 0, position: actor.position, yaw: 0, mem: actor.mem, animal: actor };
  for (let tick = 0; tick < 10_000; tick++) {
    const phase = tick % 1000;
    Object.assign(actor.mem, { init: 1, rise: phase / 1000, phase: tick % 3 + 1 });
    c.dt = tick % 2 === 0 ? 1 / 30 : 1 / 60; c.t += c.dt; c.phase = Math.sin(c.t); c.speed = phase < 300 ? 0 : 1.7; c.attack = phase < 120 ? phase / 120 : -1;
    c.alive = phase < 900; c.deathT = c.alive ? -1 : (phase - 900) / 100; c.flinch = tick % 60 / 60; c.lookWeight = Math.abs(Math.sin(c.t)); c.yaw = Math.sin(c.t * .2);
    animateCaptain(c); shippingCaptain({ ...c, bones: expected });
    for (const name of Object.keys(actual)) {
      const a = actual[name], b = expected[name]; if (a === undefined || b === undefined) throw new Error('Missing actual Captain joint');
      assert.deepStrictEqual(a.position.toArray(), b.position.toArray()); assert.deepStrictEqual(a.rotation.toArray(), b.rotation.toArray()); assert.deepStrictEqual(a.scale.toArray(), b.scale.toArray());
    }
  }
});

it('a newly spawned placed rig keeps its bind publication until the first render boundary, then publishes the real placement', () => {
  const w = fakeWorld(), factory = new AnimalFactory(w.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } });
  const model = factory.model('boar', 'boar'), rig = factory.instantiate(model, .31), view = new SourceView(rig, model, .31, 1.3, 'placed:1');
  view.place(12, 8, .3, 4);
  const actor = new AnimalSim(view.recipeSpec(), .31, 1.3, 'placed:1', { heightAt, random: () => { throw new Error('Spawn pose drew RNG'); } }); actor.place(12, 8, .3, 4);
  const names = Object.keys(rig.bones), recipe: DriftwoodPoseRecipe = { custom: false, joints: names.map(name => {
    const b = rig.bones[name]; if (b === undefined) throw new Error('Missing actual placed joint');
    return { name, parent: b.parent === null ? -1 : names.findIndex(k => rig.bones[k] === b.parent), position: [b.position.x, b.position.y, b.position.z], order: b.rotation.order, scale: [b.scale.x, b.scale.y, b.scale.z] };
  }) };
  const pose = new DriftwoodPosedVolumes(actor, recipe), old = new Vector3(), current = new Vector3();
  view.headWorld(old); pose.headWorld(current); expect(current.distanceTo(old)).toBeLessThan(1e-12);
  rig.mesh.updateMatrixWorld(true); pose.publish(); view.headWorld(old); pose.headWorld(current); expect(current.distanceTo(old)).toBeLessThan(1e-12);
});
