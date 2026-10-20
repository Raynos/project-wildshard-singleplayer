import { expect, test } from 'vitest';
import { Bone, Matrix4, Vector3 } from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import * as v from 'valibot';
import { installChannelPrograms, numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { rigidCorpseSchema } from '../../../../src/format/rigidCorpse';
import { prepareNumericRigidCorpse } from '../../../../src/engine/physics/rigidCorpse';
import { loadRapier } from '../../../../src/engine/physics/rapier';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
import poses from './poses.json' with { type: 'json' };
import recipeJson from './recipe.json' with { type: 'json' };
import ownership from './ownership.json' with { type: 'json' };
import metadata from '../selected-native-color/metadata.json' with { type: 'json' };
const recipe = v.parse(rigidCorpseSchema, recipeJson);
const body = metadata.bodies[0];
if (body === undefined) throw new Error('Missing selected body');
const defs = body.bones;
const locked = ['shell','eyestalkLeft','eyestalkRight','legLeftKnee','legLeftAnkle','legRightKnee','legRightAnkle'];
function fixture() {
  const joints = defs.map(def => { const b = new Bone(); b.name = def.name;
    const p = defs.find(row => row.name === def.parent);
    b.position.set((def.pos[0] ?? 0)-(p?.pos[0] ?? 0),(def.pos[1] ?? 0)-(p?.pos[1] ?? 0),(def.pos[2] ?? 0)-(p?.pos[2] ?? 0)); return b; });
  const byName = new Map(joints.map(j => [j.name,j]));
  for (const [i,def] of defs.entries()) { const joint=joints[i], parent=byName.get(def.parent ?? ''); if (joint && parent) parent.add(joint); }
  const entry = new Map(joints.map(j => [j.name,{position:j.position.clone(),rotation:{x:0,y:0,z:0},scale:j.scale.clone()}]));
  const frame={t:0,deathT:-1}, strike={phase:0,elapsed:0,index:0}, transition={kind:0,elapsed:0,ordinal:0}, motion={total:0};
  const owners=new Map<string,unknown>(joints.map(j=>['joint.'+j.name,j]));
  for(const [name,e] of entry) owners.set('entry.'+name,e);
  owners.set('frame',frame); owners.set('strike',strike); owners.set('transition',transition); owners.set('motion',motion);
  const lane=installChannelPrograms(poses.programs,poses.group,owners);
  const evaluate=()=>{lane.evaluate({time:frame.t,delta:1/60,values:{}});joints[0]?.updateMatrixWorld(true);return joints.flatMap(j=>[...j.position.toArray(),j.rotation.x,j.rotation.y,j.rotation.z,...j.scale.toArray()]);};
  const capture=(kind:number)=>{for(const j of joints){const e=entry.get(j.name);if(!e)throw new Error('Missing entry');e.position.copy(j.position);Object.assign(e.rotation,{x:j.rotation.x,y:j.rotation.y,z:j.rotation.z});e.scale.copy(j.scale);}transition.kind=kind;transition.elapsed=0;transition.ordinal++;if(kind===2)frame.deathT=0;};
  return {joints,byName,frame,strike,transition,motion,evaluate,capture};
}
const compare=(a:number[],b:number[],tol=1e-12)=>expect(Math.max(...a.map((n,i)=>Math.abs(n-(b[i] ?? Infinity))))).toBeLessThan(tol);

test('strict native numeric and recipe admission, all 135 unique channels, original immutable selected channels', async()=>{
 expect(()=>numericCreaturePose(poses)).not.toThrow(); expect(recipe.parts).toHaveLength(8);
 expect(recipe.parts.reduce((n,p)=>n+p.points.length,0)).toBe(361);
 expect(poses.programs).toHaveLength(135);
 expect(new Set(poses.programs.flatMap(p=>p.numeric.outputs.map(o=>o.target+'.'+o.path.join('.')))).size).toBe(135);
 expect(poses.programs.every(p=>p.nodes.length<=128)).toBe(true);
 const payload=new Uint8Array(readFileSync('art/driftwood-isle/approved-conch/selected-native-color/payload.bin'));
 const original=JSON.stringify(metadata), bytes=Array.from(payload);
 const candidate=structuredClone(metadata);Object.assign(candidate.bodies[0]?.dims ?? {},{rigidCorpse:recipe});
 const library=packedCreatureBodies(candidate,undefined,()=>Promise.resolve(payload));await library.preload();
 const model=library.copy('conch-duelist','conch-duelist');expect(model.bones).toHaveLength(15);
 expect(model.hardParts.reduce((n,p)=>n+p.getAttribute('position').count,0)).toBe(6570);
 expect(JSON.stringify(metadata)).toBe(original);expect(Array.from(payload)).toEqual(bytes);
 const f=fixture(), R=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));f.evaluate();
 const joints=f.joints.map((j,i)=>({name:j.name,parent:defs.findIndex(d=>d.name===defs[i]?.parent),position:j.position,rotation:j.quaternion,scale:j.scale}));
 const admitted=prepareNumericRigidCorpse(R,recipe,joints,1);expect(admitted).toHaveLength(8);
 for(const p of model.hardParts)p.dispose();
});

test('both authoritative strikes have continuous idle/windup/active/recover boundaries without stage clocks',()=>{
 const f=fixture();f.frame.t=1.27;f.motion.total=.24;
 for(const [index,windup] of [[1,.6],[2,.45]]){
  if(index===undefined||windup===undefined)throw new Error('Missing strike');
  const sample=(phase:number,elapsed:number)=>{Object.assign(f.strike,{phase,elapsed,index});return f.evaluate();};
  compare(sample(0,0),sample(1,0));compare(sample(1,windup),sample(2,0));compare(sample(2,.1),sample(3,0));compare(sample(3,.9),sample(4,0));compare(sample(4,0),sample(0,0));
  for(const [phase,duration] of [[1,windup],[2,.1],[3,.9]])for(let i=0;i<=60;i++)expect(sample(phase ?? 0,(duration ?? 0)*i/60).every(Number.isFinite)).toBe(true);
 }
});

test('actual prior-pose hit/death entries and repeated interruptions are position continuous; death freezes',()=>{
 const f=fixture();
 for(const phase of [0,1,2,3,4])for(const elapsed of [0,.04,.17,.44,.6,.9]){
  Object.assign(f.strike,{phase,elapsed,index:2});f.frame.t=elapsed+2;f.transition.kind=0;f.frame.deathT=-1;
  const prior=f.evaluate();f.capture(1);compare(prior,f.evaluate());
  f.transition.elapsed=.04;const hit=f.evaluate();f.capture(1);compare(hit,f.evaluate());
  f.transition.elapsed=.07;const rehit=f.evaluate();f.capture(2);compare(rehit,f.evaluate());
  for(let i=0;i<=48;i++){f.frame.deathT=i/48;f.transition.elapsed=i/60;expect(f.evaluate().every(Number.isFinite)).toBe(true);}
  const frozen=f.evaluate();f.frame.t=1e5;f.motion.total+=1;Object.assign(f.strike,{phase:2,elapsed:.05});compare(frozen,f.evaluate());
 }
});

test('locked anatomical branches and all positions/scales remain exact across every phase',()=>{
 const f=fixture();const initial=f.evaluate();
 for(let i=0;i<120;i++){
  f.frame.t=i/13;f.motion.total=i/31;Object.assign(f.strike,{phase:i%5,index:1+i%2,elapsed:(i%60)/60});
  if(i===50)f.capture(1);if(i===70)f.capture(2);f.transition.elapsed=Math.max(0,(i-70)/60);if(i>=70)f.frame.deathT=(i-70)/48;
  const values=f.evaluate();
  for(const [n,j] of f.joints.entries()){
   expect(values.slice(n*9,n*9+3)).toEqual(initial.slice(n*9,n*9+3));expect(j.scale.toArray()).toEqual([1,1,1]);
   if(locked.includes(j.name))expect([j.rotation.x,j.rotation.y,j.rotation.z]).toEqual([0,0,0]);
  }
 }
});

test('all retained packed influences follow their anatomical owner, including 94 blended corners',async()=>{
 const payload=new Uint8Array(readFileSync('art/driftwood-isle/approved-conch/selected-native-color/payload.bin'));
 const library=packedCreatureBodies(metadata,undefined,()=>Promise.resolve(payload));await library.preload();const model=library.copy('conch-duelist','conch-duelist');
 const f=fixture();let maximum=0,blended=0;
 const bind=defs.map(d=>new Matrix4().makeTranslation(-(d.pos[0] ?? 0),-(d.pos[1] ?? 0),-(d.pos[2] ?? 0)));
 const rows=model.hardParts.map((geometry,i)=>{const name=defs[i]?.name,owner=ownership.find(g=>g.parts.includes(name ?? ''))?.owner;if(!owner)throw new Error('Unowned part');return {geometry,owner};});
 for(let frame=0;frame<25;frame++){
  f.frame.t=frame/7;f.motion.total=frame/11;Object.assign(f.strike,{phase:frame%5,index:1+frame%2,elapsed:frame/31});if(frame===12)f.capture(2);if(frame>=12)f.frame.deathT=(frame-12)/12;f.evaluate();
  const skin=f.joints.map((j,i)=>j.matrixWorld.clone().multiply(bind[i] ?? new Matrix4()));
  for(const {geometry,owner} of rows){const p=geometry.getAttribute('position'),idx=geometry.getAttribute('skinIndex'),w=geometry.getAttribute('skinWeight');const ownerIndex=defs.findIndex(d=>d.name===owner),ownerSkin=skin[ownerIndex];if(!ownerSkin)throw new Error('Missing owner');
   for(let vertex=0;vertex<p.count;vertex++){const point=new Vector3().fromBufferAttribute(p,vertex),actual=new Vector3();let influences=0;
    for(let k=0;k<4;k++){const weight=w.getComponent(vertex,k),matrix=skin[idx.getComponent(vertex,k)];if(weight>0){influences++;if(!matrix)throw new Error('Missing skin');actual.addScaledVector(point.clone().applyMatrix4(matrix),weight);}}
    if(frame===0&&influences>1)blended++;
    maximum=Math.max(maximum,actual.distanceTo(point.clone().applyMatrix4(ownerSkin)));
   }
  }
 }
 expect(blended).toBe(94);expect(maximum).toBeLessThan(1e-6);
 writeFileSync('art/driftwood-isle/approved-conch/selected-complete-motion/weight-support.json', JSON.stringify({conditionalAllWeightOwnerResidualMeters:maximum,blendedCorners:blended,sampledPoses:25,physicsContactTested:false},null,2)+'\n');
 for(const p of model.hardParts)p.dispose();
});

 test('distance gait closes without speed/stage reset; hit recovery rejoins moving live target continuously',()=>{
 const f=fixture();f.frame.t=3.25;const start=f.evaluate();f.motion.total=.65;compare(start,f.evaluate());
 f.motion.total=.23;f.strike.phase=3;f.strike.elapsed=.37;f.strike.index=1;f.evaluate();f.capture(1);
 f.transition.elapsed=.32;const recovered=f.evaluate();f.transition.kind=0;compare(recovered,f.evaluate());
 const previous=f.evaluate();f.frame.t=Number.NaN;expect(()=>f.evaluate()).toThrow();
 expect(f.joints.flatMap(j=>[...j.position.toArray(),j.rotation.x,j.rotation.y,j.rotation.z,...j.scale.toArray()])).toEqual(previous);
});
