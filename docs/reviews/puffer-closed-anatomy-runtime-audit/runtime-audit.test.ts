import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial, Matrix4 } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { packedCreatureBodies } from '../../../src/game/plugin/geometry';
import { numericCreaturePose as directPose } from '../../../src/game/plugin/channelPrograms';
import { numericCreaturePose } from '../../../src/pufferGaitContinuityPreview';
import { pufferNativeGait4Clips } from '../../../src/shards/driftwood-isle/generators/pufferNativeGait4Clips';
import { pufferNativeClips } from '../../../src/shards/driftwood-isle/generators/pufferNativeClips';

const dir = 'docs/reviews/puffer-closed-anatomy-runtime-audit';
const currentHost = '../wildshard-review-site-current/dist/puffer-engine';
const publicPosePath = `${currentHost}/practice-product/blobs/json/cf98695e901d32720a0434084c553b4f91ac2b01e58c0a0b224105ee10dfed17.json`;
const publicPose: unknown = JSON.parse(readFileSync(publicPosePath, 'utf8'));
const expectedSources: Record<string, string> = { selected: '98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006', public70: 'b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762' };
const fixtureSchema = v.looseObject({ path: v.string(), sha256: v.string(), metadata: v.unknown(), payloadBase64: v.string() });
const nativeSchema = v.looseObject({ parts: v.array(v.looseObject({ name: v.string(), positions: v.array(v.number()), skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })) });
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const protectedPaths = ['art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json', 'art/driftwood-isle/approved-puffer/unaccepted-v70-motion-rig1-native.json', 'src/shards/driftwood-isle/generators/pufferNativeClips.ts', 'src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts', 'src/pufferGaitContinuityPreview.ts', 'scripts/puffer-gait-admission.mjs', 'scripts/puffer-preview-input.mjs', 'src/shards/driftwood-isle/behaviour/brinePuffer.as', 'src/shards/driftwood-isle/generators/driftwoodRegularCombat.ts', 'src/shards/driftwood-isle/data/practiceNeutralGrayLighting.json'];

test('measure unchanged selected and public sources through real codec, numeric evaluator and Three skinning', async () => {
 const before = Object.fromEntries(protectedPaths.map(p => [p, hash(p)]));
 expect(hash(publicPosePath)).toBe('cf98695e901d32720a0434084c553b4f91ac2b01e58c0a0b224105ee10dfed17');
 expect(publicPose).toEqual(pufferNativeGait4Clips());
 const results = [];
 for (const key of ['selected', 'public70']) {
  const fixture = v.parse(fixtureSchema, JSON.parse(execFileSync('python3', [`${dir}/prepare.py`, key], { maxBuffer: 8000000 }).toString()));
  expect(fixture.sha256).toBe(expectedSources[key]);
  const raw = v.parse(nativeSchema, JSON.parse(readFileSync(fixture.path, 'utf8')));
  const payload = new Uint8Array(Buffer.from(fixture.payloadBase64, 'base64'));
  const decoded = packedCreatureBodies(fixture.metadata, undefined, () => Promise.resolve(payload)); await decoded.preload();
  const body = decoded.copy('brine-puffer', 'brine-puffer');
  expect(body.hardParts.length).toBe(7); expect(body.bones.length).toBe(8);
  const bones: Record<string, Bone> = {};
  const ordered: Bone[] = [];
  for (const definition of body.bones) {
   const bone = new Bone(); bone.name = definition.name; bone.position.fromArray(definition.pos);
   if (definition.parent !== null) { const parent = bones[definition.parent], def = body.bones.find(b => b.name === definition.parent); if (parent === undefined || def === undefined) throw new Error('Missing parent'); bone.position.sub(new Vector3(...def.pos)); parent.add(bone); }
   bones[definition.name] = bone; ordered.push(bone);
  }
  const root = bones['body'], belly = bones['belly']; if (root === undefined || belly === undefined) throw new Error('Missing root');
  root.updateMatrixWorld(true); const skeleton = new Skeleton(ordered); skeleton.calculateInverses();
  const inverses = skeleton.boneInverses.map(m => m.toArray());
  const material = new MeshBasicMaterial();
  const meshes = body.hardParts.map((geometry, index) => {
   const part = raw.parts[index]; if (part === undefined) throw new Error('Part mismatch');
   expect(Array.from(geometry.getAttribute('position').array)).toEqual(Array.from(Float32Array.from(part.positions)));
   expect(Array.from(geometry.getAttribute('skinWeight').array)).toEqual(Array.from(Float32Array.from(part.skinWeights)));
   expect(Array.from(geometry.getAttribute('skinIndex').array)).toEqual(part.skinIndices);
   const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton, new Matrix4()); return mesh;
  });
  const mem = {}, position = new Vector3();
  const c: AnimalRigContext = { bones, dims: body.dims, dt: 1/60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const reset = () => { for (const [i, bone] of ordered.entries()) { const def = body.bones[i]; if (def === undefined) throw new Error('Missing bind'); bone.position.fromArray(def.pos); if (def.parent !== null) { const parent = body.bones.find(b => b.name === def.parent); if (parent === undefined) throw new Error('Missing bind parent'); bone.position.sub(new Vector3(...parent.pos)); } bone.rotation.set(0,0,0); bone.scale.set(1,1,1); } Object.assign(c,{t:0, phase:0, speed:0, flinch:0, deathT:-1, alive:true, state:'stalk'}); c.mem['puffer-st']=0; c.mem['regular-clock']=0; };
  const scans = [];
  for (const scenario of ['rest','inflate-105','inflate-110','stop-resume','attack','hit','death'] as const) {
   let floor=Infinity, finFloor=Infinity, capError=0, minAreaRatio=Infinity, frames=0;
   let worstCap: unknown=null, worstFloor: unknown=null;
   const lower=[Infinity,Infinity,Infinity], upper=[-Infinity,-Infinity,-Infinity];
   const perPart = raw.parts.map(p => ({ name:p.name, minimumY:Infinity, maximumCapError:0 }));
   const isStatic = scenario==='rest'||scenario==='inflate-105'||scenario==='inflate-110';
   for(const dt of isStatic ? [1/60] : [1/60,1/30,.1,.2]) {
    reset();c.dt=dt;
    const animate = isStatic ? directPose(pufferNativeClips(scenario)) : numericCreaturePose(publicPose);
    for(let i=0;i<=(isStatic?0:Math.ceil(2.5/dt));i++) {
     c.t=i*dt; c.phase=(c.phase+.7*.62/.24*dt)%1;
     if(!isStatic){ c.speed=c.t<.6 || scenario==='stop-resume' && c.t>=1.2 ? .7:0; c.mem['puffer-st']=scenario==='stop-resume'||c.t<.6?0:1; c.mem['regular-clock']=Math.max(0,c.t-.6); c.state=c.mem['puffer-st']===1?'attack':'stalk'; c.flinch=scenario==='hit'&&c.t>=.7?Math.exp(-5.5*(c.t-.7)):0; c.deathT=scenario==='death'&&c.t>=.9?Math.min(1,(c.t-.9)/.8):-1; c.alive=c.deathT<0; if(!c.alive) c.mem['puffer-st']=5; }
     animate(c);root.updateMatrixWorld(true);skeleton.update();
     for (const [partIndex,mesh] of meshes.entries()) {
      const part=raw.parts[partIndex], stats=perPart[partIndex];if(part===undefined||stats===undefined)throw new Error('Missing part');
      const attr=mesh.geometry.getAttribute('position'), points:Vector3[]=[];const fin=part.name.startsWith('Volumetric connected ');
      for(let j=0;j<attr.count;j++) {
       const point=new Vector3().fromBufferAttribute(attr,j);const posed=mesh.applyBoneTransform(j,point.clone());points.push(posed);
       if(posed.y<floor){floor=posed.y;worstFloor={scenario,dt,time:c.t,part:part.name,vertex:j,point:posed.toArray(),deathT:c.deathT};}
       stats.minimumY=Math.min(stats.minimumY,posed.y);if(fin)finFloor=Math.min(finFloor,posed.y);
       for(const axis of [0,1,2]){lower[axis]=Math.min(lower[axis]??Infinity,posed.getComponent(axis));upper[axis]=Math.max(upper[axis]??-Infinity,posed.getComponent(axis));}
       if(fin && point.y>.4){const bellyDef=body.bones.find(b=>b.name==='belly');if(bellyDef===undefined)throw new Error('Missing belly bind');const attached=point.clone().sub(new Vector3(...bellyDef.pos)).applyMatrix4(belly.matrixWorld);const error=posed.distanceTo(attached);stats.maximumCapError=Math.max(stats.maximumCapError,error);if(error>capError){capError=error;worstCap={scenario,dt,time:c.t,part:part.name,vertex:j,rest:point.toArray(),shown:posed.toArray(),bellyAttached:attached.toArray()};}}
      }
      if(fin)for(let j=0;j<points.length;j+=3){const a=points[j],b=points[j+1],d=points[j+2];if(a===undefined||b===undefined||d===undefined)throw new Error('Bad triangle');const aa=new Vector3().fromBufferAttribute(attr,j),bb=new Vector3().fromBufferAttribute(attr,j+1),dd=new Vector3().fromBufferAttribute(attr,j+2);const area=bb.sub(aa).cross(dd.sub(aa)).length();if(area<=1e-10)throw new Error('Degenerate triangle');minAreaRatio=Math.min(minAreaRatio,b.clone().sub(a).cross(d.clone().sub(a)).length()/area);}
     }
     frames++;
    }
   }
   scans.push({scenario,frames,minimumLocalY:floor,minimumFinY:finFloor,maximumCapToBellyError:capError,minimumFinAreaRatio:minAreaRatio,envelope:{min:lower,max:upper},worstFloor,worstCap,parts:perPart});
  }
  const {payloadBase64,metadata,...summary}=fixture;
  results.push({key,...summary,decodedDimensions:body.dims,decodedBones:body.bones,inverseBindMatrices:inverses,packedSha256:createHash('sha256').update(payload).digest('hex'),scans});
  for(const mesh of meshes)mesh.geometry.dispose();material.dispose();skeleton.dispose();
 }
 expect(Object.fromEntries(protectedPaths.map(p=>[p,hash(p)]))).toEqual(before);
 expect(results[0]?.decodedBones).toEqual(results[1]?.decodedBones);
 expect(results[0]?.inverseBindMatrices).toEqual(results[1]?.inverseBindMatrices);
 writeFileSync(`${dir}/runtime-envelope-results.json`,JSON.stringify({publicPoseSha256:hash(publicPosePath), scope:'Real native codec and packedCreatureBodies decoder; admitted numeric evaluator, unchanged gait5 adapter and Three SkinnedMesh.applyBoneTransform. Local sampled envelopes, not world contact, rendering, combat or physical death acceptance.',protectedPins:before,results},null,2)+'\n');
 console.info(JSON.stringify(results.map(r=>({key:r.key,scans:r.scans.map(s=>({scenario:s.scenario,frames:s.frames,floor:s.minimumLocalY,capError:s.maximumCapToBellyError}))}))));
});
