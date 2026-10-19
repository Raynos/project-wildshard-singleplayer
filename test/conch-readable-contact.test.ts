// oxlint-disable-next-line import/no-nodejs-modules -- Exact candidate and captured world matrices are immutable test fixtures.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

import { Bone, Matrix4, Vector3, Group, Box3, Ray } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { conchReadableClips } from '../src/shards/driftwood-isle/generators/conchReadableClips';
import { conchPlantedClips } from '../src/shards/driftwood-isle/generators/conchPlantedClips';
import { StrikeRunner, type StrikeActor, type StrikeSpec } from '../src/engine/ai/strikes';
import { FIXED_STEP } from '../src/engine/core/fixedStep';
import { DRIFTWOOD_REGULAR_STRIKES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

const directory='art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
const metadata: unknown=JSON.parse(readFileSync(`${directory}/metadata.json`,'utf8'));
const defs=v.parse(v.object({bodies:v.array(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])}))}))}),metadata).bodies[0];
if(defs===undefined) throw new Error('Missing Conch');
const boneDefinitions=defs.bones;

test('motion4 strict consumer, dense geometry, exact lower-body and death parity',async()=>{
 const bodies=packedCreatureBodies(metadata,undefined,()=>Promise.resolve(new Uint8Array(readFileSync(`${directory}/payload.bin`))));await bodies.preload();
 const packed=bodies.copy('conch-duelist','conch-duelist'), bones:Record<string,Bone>={}, actor=new Group();
 for(const def of boneDefinitions){const joint=new Bone();joint.position.fromArray(def.pos);bones[def.name]=joint;
  if(def.parent===null) actor.add(joint);else{const parent=bones[def.parent],rest=boneDefinitions.find(row=>row.name===def.parent);if(parent===undefined||rest===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3(...rest.pos));parent.add(joint);}}
 actor.updateMatrixWorld(true);const inverse=boneDefinitions.map(def=>{const joint=bones[def.name];if(joint===undefined)throw new Error('Missing joint');return joint.matrixWorld.clone().invert();});
 const matrices=inverse.map(()=>new Matrix4()),position=new Vector3(),mem={};
 const c:AnimalRigContext={bones,dims:{bodyY:1.04,bodyHalfLen:0,bodyRadius:0,headRadius:0,legLen:0,feet:[],halfWidth:0},dt:1/60,t:0,seed:.7,scale:1,speed:0,strafe:0,phase:0,state:'stalk',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{mem,position,yOffset:0}};
 const animate=numericCreaturePose(conchReadableClips());
 const root=bones['body'];if(root===undefined)throw new Error('Missing body');
 const p=new Vector3(),q=new Vector3(),sum=new Vector3();let vertices=0,blended=0;
 const parts=packed.hardParts.map(g=>({p:g.getAttribute('position'),i:g.getAttribute('skinIndex'),w:g.getAttribute('skinWeight')}));
 for(const part of parts){vertices+=part.p.count;for(let n=0;n<part.p.count;n++)if([part.w.getX(n),part.w.getY(n),part.w.getZ(n),part.w.getW(n)].filter(x=>x>0).length>1)blended++;}
 const measure=()=>{actor.updateMatrixWorld(true);boneDefinitions.forEach((d,i)=>{const joint=bones[d.name],m=matrices[i],inv=inverse[i];if(joint===undefined||m===undefined||inv===undefined)throw new Error('Missing transform');m.multiplyMatrices(joint.matrixWorld,inv);});
  let minimum=Infinity;for(const part of parts)for(let n=0;n<part.p.count;n++){p.fromBufferAttribute(part.p,n);sum.set(0,0,0);
   for(let k=0;k<4;k++){const weight=part.w.getComponent(n,k);if(weight===0)continue;const m=matrices[part.i.getComponent(n,k)];if(m===undefined)throw new Error('Invalid weight');q.copy(p).applyMatrix4(m);sum.addScaledVector(q,weight);}if(sum.y-actor.position.y<minimum){minimum=sum.y-actor.position.y;}}return minimum;};
 const resetBones=()=>{for(const def of boneDefinitions){const joint=bones[def.name];if(joint===undefined)throw new Error('Missing joint');joint.position.fromArray(def.pos);joint.rotation.set(0,0,0);if(def.parent!==null){const parent=boneDefinitions.find(x=>x.name===def.parent);if(parent===undefined)throw new Error('Missing parent');joint.position.sub(new Vector3(...parent.pos));}}};

 const baseline=numericCreaturePose(conchPlantedClips());
 const snapshot=()=>Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,[...bone.position,...bone.quaternion]]));
 const set=(stage:number,clock:number,flinch=0,deathT=-1)=>{
  resetBones(); c.t=.4; c.speed=.8; c.phase=.21; c.flinch=flinch;c.deathT=deathT;c.alive=deathT<0;
  c.mem['conch-st']=stage;c.mem['regular-clock']=clock;c.mem['conch-guard']=stage===1&&clock<.6?1:0;
 };
 let min=Infinity,max=-Infinity,samples=0,parity=0,laneSamples=0;const keyPoses:unknown[]=[];
 const weightedPoint=(part:typeof parts[number],index:number)=>{
  p.fromBufferAttribute(part.p,index);sum.set(0,0,0);
  for(let k=0;k<4;k++){const weight=part.w.getComponent(index,k);if(weight===0)continue;const m=matrices[part.i.getComponent(index,k)];if(m===undefined)throw new Error('Missing matrix');sum.addScaledVector(q.copy(p).applyMatrix4(m),weight);}return sum.clone();
 };
 const weapon=parts[8];if(weapon===undefined)throw new Error('Missing weapon');
 // The +Z extreme is the rapier tip in the canonical packed rig, not its source GLB orientation.
 let tip=0;for(let i=1;i<weapon.p.count;i++)if(weapon.p.getZ(i)>weapon.p.getZ(tip))tip=i;
 const tips:Record<string,number[][]>={};
 const torso=parts[0];if(torso===undefined)throw new Error('Missing torso');
 const torsoBox=new Box3(), ray=new Ray(), crossing=new Vector3();let clearanceChecks=0;
 const bladeClear=()=>{
  torsoBox.makeEmpty();for(let i=0;i<torso.p.count;i++)torsoBox.expandByPoint(weightedPoint(torso,i));
  for(let i=300;i<468;i+=3){const tri=[weightedPoint(weapon,i),weightedPoint(weapon,i+1),weightedPoint(weapon,i+2)];
   for(let edge=0;edge<3;edge++){const a=tri[edge],end=tri[(edge+1)%3];if(a===undefined||end===undefined)throw new Error('Missing edge');
    expect(torsoBox.containsPoint(a),'blade vertex inside conservative torso box').toBe(false);
    const length=a.distanceTo(end);if(length<1e-12)continue;ray.set(a,end.clone().sub(a).normalize());
    const hit=ray.intersectBox(torsoBox,crossing);expect(hit===null||a.distanceTo(hit)>length,'blade edge crosses conservative torso box').toBe(true);
   }
  }clearanceChecks++;
 };
 for(const stage of [0,1,2,3,4])for(const flinch of [0,.5,1])for(let i=0;i<=320;i++){
  const clock=i/200;set(stage,clock,flinch);animate(c);const current=snapshot();const floor=measure();samples++;min=Math.min(min,floor);max=Math.max(max,floor);
  expect(floor).toBeGreaterThanOrEqual(0);expect(floor).toBeLessThan(.02);if(i%4===0)bladeClear();
  if(stage===1||stage===3){const windup=stage===1?.6:.45;if(clock>=windup-.1&&clock<=windup+.3){const point=weightedPoint(weapon,tip);expect(Math.abs(point.x)).toBeLessThanOrEqual(.325);expect(point.z).toBeGreaterThan(1.8);laneSamples++;}}
  if(flinch===0&&(stage===1||stage===3)) {const point=weightedPoint(weapon,tip);(tips[String(stage)]??=[]).push([clock,...point]);}
  if(i%40===0&&flinch===0)keyPoses.push({stage,clock,bones:current});
  resetBones();baseline(c);const old=snapshot();
  for(const name of ['body','legLeft','legLeftKnee','legLeftAnkle','legRight','legRightKnee','legRightAnkle'])expect(current[name]).toEqual(old[name]);parity++;
 }
 // Exact shared death curve and all existing joint rotations, including stale attack clocks/recoil.
 for(const stage of [0,1,3,4,5])for(let i=0;i<=96;i++){
  set(stage,i/96*1.6,(i%5)/4,i/96);animate(c);const current=snapshot();const floor=measure();expect(floor).toBeGreaterThanOrEqual(0);expect(floor).toBeLessThan(.02);
  resetBones();baseline(c);expect(current).toEqual(snapshot());parity++;
 }
 // Nominal attack boundaries meet rest without a pose jump; no late offensive second sweep.
 const deltas:unknown[]=[];
 for(const [stage,windup]of [[1,.6],[3,.45]] as const){
  set(2,0);animate(c);const rest=snapshot();
  set(stage,windup+1);animate(c);expect(rest).toEqual(snapshot());
  set(4,0);animate(c);const held=snapshot();set(3,0);animate(c);expect(held).toEqual(snapshot());
  const row=tips[String(stage)];if(row===undefined)throw new Error('Missing samples');
  const peak=row.reduce((best,point)=> (point[3]??-Infinity)>(best[3]??-Infinity)?point:best,row[0]??[]);
  deltas.push({stage,peakTip:peak});
  const hitPose=row.find(point=>Math.abs((point[0]??-1)-windup)<1e-6);
  deltas.push({stage,hitPose});expect(Math.abs(hitPose?.[1]??Infinity)).toBeLessThanOrEqual(.325);
  // Arrival can arc forward before full alignment; alignment holds before active begins.
  expect(peak[0]).toBeLessThanOrEqual(windup+.3);
 }

 // Guard onset intentionally differs from unguarded rest; compare the original
 // observed guard axes instead of incorrectly demanding the shield stay lowered.
 for(const stage of [0,1])for(const time of [0,.4,1.3]){
  set(stage,0);c.t=time;animate(c);const current=snapshot();
  const shellX=bones['shell']?.rotation.x,headX=bones['head']?.rotation.x;
  resetBones();baseline(c);const old=snapshot();
  expect(current['shieldArm']).toEqual(old['shieldArm']);expect(current['shieldForearm']).toEqual(old['shieldForearm']);
  expect(bones['shell']?.rotation.x).toEqual(shellX);expect(bones['head']?.rotation.x).toEqual(headX);
 }
 // Real runner regression, not a lookup at an authored apex. The engine fixed step
 // is included alongside fine, mobile and sparse cadences. +/-one update behavior
 // skew and both actor/runner update orders are deliberately bounded hypotheses;
 // only fresh host capture can establish the host's actual ordering.
 const runnerCases:unknown[]=[];
 for(const stage of [1,3])for(const dt of [.005,FIXED_STEP,1/30,.05,.1])
 for(const skewSteps of [-1,0,1])for(const actorFirst of [false,true])for(const offset of [0,.37,.91])for(const recoil of [0,.1,.5,1]){
  const authored=DRIFTWOOD_REGULAR_STRIKES.find(row=>row.id===`strike.conch-duelist.${stage===1?'thrust':'counter'}`);
  if(authored===undefined)throw new Error('Missing unchanged strike');
  const spec:StrikeSpec={...authored,weight:()=>1};
  let attackT=-1,attackDur=1,elapsed=0,hits=0,firstHit=-1,phaseAtHit=0;
  const a:StrikeActor={position:{x:0,y:0,z:0},alive:true,scale:1,yaw:0,
   startAttack(seconds){attackT=0;attackDur=seconds;},cancelAttack(){attackT=-1;},setMotion(){/* This structural actor stays on the locked lane. */}};
  const runner=new StrikeRunner();runner.start(spec,a,{x:0,y:0,z:1.9});
  const ctx={actor:a,target:{x:0,y:0,z:1.9},canReach:()=>true,hit(){hits++;firstHit=elapsed;phaseAtHit=attackT<0?-1:Math.min(1,attackT/attackDur);}};
  let tipAtHit:number[]=[];
  for(let step=0;step<1000;step++){
   const stepDt=step===0?dt*(1-offset):dt;elapsed+=stepDt;
   if(actorFirst&&attackT>=0)attackT+=stepDt;
   runner.update(stepDt,ctx);
   if(!actorFirst&&attackT>=0)attackT+=stepDt;
   if(hits){
    const behaviorClock=elapsed+skewSteps*dt;set(stage,behaviorClock,recoil);c.attack=phaseAtHit;animate(c);measure();
    const point=weightedPoint(weapon,tip);tipAtHit=[behaviorClock,...point];
    expect(Math.abs(point.x),JSON.stringify({stage,dt,skewSteps,actorFirst,offset,point})).toBeLessThanOrEqual(.325);
    expect(point.z).toBeGreaterThan(1.8);expect(point.z).toBeLessThan(2.4);bladeClear();break;
   }
  }
  expect(hits).toBe(1);expect(phaseAtHit).toBe(-1);
  runnerCases.push({stage,dt,skewSteps,actorFirst,offset,recoil,firstHit,phaseAtHit,tipAtHit});
  // Stagger cancellation before contact must not yield a later ghost hit.
  const cancelled=new StrikeRunner();cancelled.start(spec,a,ctx.target);cancelled.update(spec.windup*.5,ctx);
  cancelled.cancel();a.cancelAttack();const before=hits;cancelled.update(2,ctx);expect(hits).toBe(before);expect(cancelled.state).toBe('idle');
 }
 c.attack=-1;
 // Same-flinch interrupted snapshots are quantified, never called fully continuous.
 const interruptions:unknown[]=[];
 for(const flinch of [0,.5,1])for(const [from,to,clock] of [[1,4,.4],[3,2,.485],[3,2,.8]] as const){
  set(from,clock,flinch);animate(c);const fromRot=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,[bone.rotation.x,bone.rotation.y,bone.rotation.z]]));
  set(to,0,flinch);animate(c);const differences=Object.entries(bones).flatMap(([name,bone])=>[bone.rotation.x,bone.rotation.y,bone.rotation.z].map((value,axis)=>({name,axis,delta:Math.abs(value-(fromRot[name]?.[axis]??0))})));
  const shield=differences.find(row=>row.name==='shieldArm'&&row.axis===0);
  const forearm=differences.find(row=>row.name==='rapierForearm'&&row.axis===1);
  if(from===1)expect(shield?.delta).toBeLessThan(1e-12);
  if(from===3)expect(forearm?.delta).toBeLessThanOrEqual(flinch===0?.4:.52);
  interruptions.push({from,to,clock,flinch,maximum:Math.max(...differences.map(row=>row.delta)),differences});
 }
 // Independent gait/time samples retain support and exact lower-body channels.
 let variedSamples=0;
 for(const time of [0,.7,2.9])for(const phase of [0,.125,.25,.5,.75,.875])for(const speed of [0,.4,1]){
  set(0,.3);c.t=time;c.phase=phase;c.speed=speed;animate(c);const current=snapshot();const floor=measure();
  expect(floor).toBeGreaterThanOrEqual(0);expect(floor).toBeLessThan(.02);bladeClear();
  resetBones();baseline(c);const old=snapshot();for(const name of ['body','legLeft','legLeftKnee','legLeftAnkle','legRight','legRightKnee','legRightAnkle'])expect(current[name]).toEqual(old[name]);
  variedSamples++;
 }

 mkdirSync('tmp/conch-readable-offline',{recursive:true});writeFileSync('tmp/conch-readable-offline/report.json',JSON.stringify({schema:'conch.motion4.source-check.v1',samples,parity,clearanceChecks,min,max,vertices,blended,laneSamples,deltas,keyPoses,tips,runnerCases,interruptions,variedSamples},null,2));
 for(const g of packed.hardParts)g.dispose();
},120000);
