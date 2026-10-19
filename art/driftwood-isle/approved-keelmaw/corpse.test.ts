// oxlint-disable-next-line import/no-nodejs-modules -- Preserve actual native physics study results; no browser or production writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Group, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { Physics } from '../../../src/engine/physics/Physics';
import { Ragdolls, setRagdollClock } from '../../../src/engine/physics/ragdoll';
import { groups } from '../../../src/engine/physics/groups';
import { rigidCorpseSchema } from '../../../src/format/rigidCorpse';
import { RigidCorpsePose } from '../../../src/engine/entities/rigidCorpsePose';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import { keelmawNativeClips } from './keelmawNativeClips';

const folder = 'art/driftwood-isle/approved-keelmaw';
const source = v.parse(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])})),parts:v.array(v.object({name:v.string(),positions:v.array(v.number())}))}),JSON.parse(readFileSync(`${folder}/v1/native-source.json`,'utf8')));
const metadata = v.parse(v.object({bodies:v.array(v.object({dims:v.object({bodyY:v.number(),bodyHalfLen:v.number(),bodyRadius:v.number(),headRadius:v.number(),halfWidth:v.number(),legLen:v.number(),feet:v.array(v.tuple([v.number(),v.number()])),rigidCorpse:rigidCorpseSchema})}))}),JSON.parse(readFileSync(`${folder}/v1/metadata.json`,'utf8')));
test('measure exact seven-shape native corpse without accepting contact or changing solver parameters',async()=>{
 const R=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
 const dims=metadata.bodies[0]?.dims;if(dims===undefined)throw new Error('Missing dimensions');
 const trials=[];
 for(const initial of [{step:0,clock:0,dx:1,dz:0},{step:1,clock:1.25,dx:0,dz:1},{step:1,clock:.65,dx:-1,dz:0},{step:1,clock:1.5,dx:0,dz:-1}]){
  const root=new Group(),bones:Record<string,Bone>={};
  for(const row of source.bones){const b=new Bone();b.position.fromArray(row.pos);if(row.parent===null)root.add(b);else{const parent=bones[row.parent],rest=source.bones.find(p=>p.name===row.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');b.position.sub(new Vector3(...rest.pos));parent.add(b);}bones[row.name]=b;}
  const mem:Record<string,number>={'keelmaw-step':initial.step,'keelmaw-clock':initial.clock},position=new Vector3();
  const context:AnimalRigContext & {bones:Record<string,Bone>}={bones,dims,dt:1/60,t:initial.clock,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'attack',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
  const animate=numericCreaturePose(keelmawNativeClips());animate(context);root.updateMatrixWorld(true);
  context.alive=false;context.deathT=0;mem['keelmaw-step']=6;mem['keelmaw-clock']=0;
  const pose=new RigidCorpsePose(context,animate,context),physics=new Physics(R),system=new Ragdolls(physics);
  const rows=[];let fixedMin=Infinity,renderMin=Infinity;
  const point=new Vector3();
  function minimum(){root.updateMatrixWorld(true);let low=Infinity;for(const part of source.parts){const bone=bones[part.name],rest=source.bones.find(b=>b.name===part.name);if(bone===undefined||rest===undefined)throw new Error('Missing rigid part');for(let j=0;j<part.positions.length;j+=3){point.fromArray(part.positions,j).sub(new Vector3(...rest.pos)).applyMatrix4(bone.matrixWorld);low=Math.min(low,point.y);}}return low;}
  try{
   physics.world.createCollider(R.ColliderDesc.cuboid(50,.1,50).setTranslation(0,-.1,0).setCollisionGroups(groups('WORLD')).setSolverGroups(groups('WORLD')));
   const corpse=system.spawn({root,bones,scale:1,build:'rigid',lite:false,dims,corpsePose:pose,velocity:{x:0,y:0,z:0},hitPoint:{x:0,y:1,z:0},dir:{x:initial.dx,y:0,z:initial.dz},damage:20});
   if(corpse===null)throw new Error('Native corpse refused');expect(corpse.bodies).toBe(1);
   for(let tick=0;tick<480;tick++){
    system.fixedPre(1/60);physics.step();system.fixedPost(1/60);
    setRagdollClock(()=>1);corpse.pose(1/60);const fixed=minimum();fixedMin=Math.min(fixedMin,fixed);
    const endpoint=root.matrixWorld.toArray();setRagdollClock(()=>.5);corpse.pose(0);const rendered=minimum();renderMin=Math.min(renderMin,rendered);
    rows.push({tick,seconds:(tick+1)/60,deathT:pose.deathT,state:corpse.state,fixedMinY:fixed,renderMinY:rendered,world:endpoint});
   }
   trials.push({initial,fixedMinY:fixedMin,renderMinY:renderMin,contactThreshold:.005,passesSampledFlatContact:fixedMin>=-.005&&renderMin>=-.005,rows});
   corpse.dispose();
  }finally{setRagdollClock(null);physics.dispose();}
 }
 writeFileSync(`${folder}/v1/physics.json`,JSON.stringify({runtimeAcceptance:false,visualAcceptance:false,method:'Actual existing Rapier/Physics/Ragdolls/RigidCorpsePose at60Hz, unchanged parameters, four lethal phases/directions,8s each. Full rigid-weighted vertices at fixed endpoint and interpolation alpha.5. Flat plane only; no browser/gameplay/video or phone proof.',trials},null,2)+'\n');
 expect(trials).toHaveLength(4);
 expect(trials.every(t=>t.passesSampledFlatContact)).toBe(true);
});
