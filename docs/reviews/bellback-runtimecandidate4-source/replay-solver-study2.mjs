// Controlled native diagnostic only. Never mutates product, shared engine or global solver settings.
import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Group, Vector3 } from 'three';
import { admitBellbackFollowing } from '../../../scripts/bellback-following-admission.mjs';

// Minimal browser storage/location ports used by pure engine imports; no browser or persistence.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = new URL('http://localhost/');
const { loadRapier } = await import('../../../src/engine/physics/rapier.ts');
const { Physics } = await import('../../../src/engine/physics/Physics.ts');
const { Ragdolls } = await import('../../../src/engine/physics/ragdoll.ts');
const { RigidCorpsePose } = await import('../../../src/engine/entities/rigidCorpsePose.ts');
const { numericCreaturePose } = await import('../../../src/game/plugin/channelPrograms.ts');
const { bellbackTuckedClips } = await import('../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts');
const { metadata } = admitBellbackFollowing(process.cwd());
const native = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json'));
const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Provide capture directory and new output directory');
mkdirSync(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const vector = v => new Vector3(v.x, v.y, v.z);
const same = isDeepStrictEqual;
const localPoints = native.parts.map(p => { const bind = native.bones.find(b => b.name === p.name).pos; return { bone:p.name, points:Array.from({length:p.positions.length/3},(_,i)=>new Vector3(...p.positions.slice(i*3,i*3+3)).sub(new Vector3(...bind))) }; });
function solve(capture, iterations) {
  const initial=capture.initial, physics=new Physics(R), world=physics.world;
  for(const [key,value] of Object.entries(capture.settings)) if(world.integrationParameters[key]!==value) throw new Error(`World default mismatch: ${key}`);
  for(const e of capture.environment) {
    if(e.type!==R.ShapeType.Cuboid||!e.halfExtents)throw new Error('Unsupported captured static environment shape');
    const h=e.halfExtents,p=e.position;
    world.createCollider(R.ColliderDesc.cuboid(h.x,h.y,h.z).setTranslation(p.x,p.y,p.z).setRotation(e.rotation).setFriction(e.friction).setRestitution(e.restitution).setCollisionGroups(e.collisionGroups).setSolverGroups(e.solverGroups).setSensor(e.sensor));
  }
  const root=new Group();root.position.fromArray(initial.root.position);root.quaternion.fromArray(initial.root.rotation);root.scale.setScalar(initial.root.scale);
  const bones={};
  for(const b of native.bones) {const joint=new Bone();joint.name=b.name;const v=initial.bones[b.name];joint.position.fromArray(v);joint.quaternion.fromArray(v,3);(b.parent===null?root:bones[b.parent]).add(joint);bones[b.name]=joint;}
  root.updateMatrixWorld(true);
  if(!same(initial.dims,metadata.bodies[0].dims))throw new Error('Captured recipe differs');
  const inputs=structuredClone(initial.inputs),position=new Vector3(...initial.root.position),mem={...initial.contextMem};
  const context={...initial.context,bones,dims:initial.dims,mem,position,lookTarget:new Vector3(),animal:{mem,position,yOffset:0}};
  const pose=new RigidCorpsePose(context,numericCreaturePose(bellbackTuckedClips()),inputs);
  const system=new Ragdolls(physics,2),ragdoll=system.spawn({build:'rigid',corpsePose:pose,root,bones,dims:initial.dims,scale:initial.root.scale,lite:true,velocity:initial.velocity,damage:initial.damage,hitPoint:new Vector3(...initial.hitPoint),dir:new Vector3(...initial.dir)});
  if(!ragdoll)throw new Error('Missing diagnostic corpse');
  const body=ragdoll.parts[0].body;
  const initialDifference=Math.max(...['x','y','z'].flatMap(k=>[Math.abs(body.translation()[k]-initial.body.position[k]),Math.abs(body.linvel()[k]-initial.body.linvel[k]),Math.abs(body.angvel()[k]-initial.body.angvel[k])]));
  if(initialDifference>1e-6)throw new Error(`Initial physical state mismatch ${initialDifference}`);
  body.setAdditionalSolverIterations(iterations);
  const rows=[];let maxBodyDelta=0,maxBoneDelta=0,maxSupportGap=0,clock=0;
  for(let i=0;i<300&&ragdoll.state==='live';i++) {
    const source=capture.steps[Math.min(i,capture.steps.length-1)];
    Object.assign(inputs,structuredClone(source.inputs));clock+=source.dt;
    system.fixedPre(source.dt);
    for(const [name,b] of Object.entries(bones)) {
      if(i<capture.steps.length) {const actual=[...b.position,...b.quaternion];maxBoneDelta=Math.max(maxBoneDelta,...actual.map((v,j)=>Math.abs(v-source.bones[name][j])));}
    }
    physics.step();
    const p=body.translation(),q=body.rotation(),lv=body.linvel(),av=body.angvel();
    if(i<capture.steps.length)maxBodyDelta=Math.max(maxBodyDelta,...['x','y','z'].flatMap(k=>[Math.abs(p[k]-source.after.position[k]),Math.abs(lv[k]-source.after.linvel[k]),Math.abs(av[k]-source.after.angvel[k])]));
    let meshMinimum=Infinity,hullMinimum=Infinity;const point=new Vector3();
    for(let j=0;j<localPoints.length;j++) {
      const collider=ragdoll.corpseColliders[j].collider,translation=collider.translation(),rotation=collider.rotation();
      for(const vertex of localPoints[j].points)meshMinimum=Math.min(meshMinimum,point.copy(vertex).multiplyScalar(initial.root.scale).applyQuaternion(rotation).add(translation).y-900);
      for(const vertex of initial.dims.rigidCorpse.parts[j].points)hullMinimum=Math.min(hullMinimum,point.fromArray(vertex).multiplyScalar(initial.root.scale).applyQuaternion(rotation).add(translation).y-900);
    }
    maxSupportGap=Math.max(maxSupportGap,Math.abs(meshMinimum-hullMinimum));
    const contacts=[];
    for(const part of ragdoll.corpseColliders)world.contactPairsWith(part.collider,other=>world.contactPair(part.collider,other,(m)=>{
      for(let c=0;c<m.numContacts();c++)contacts.push({bone:part.bone.name,distance:m.contactDist(c),impulse:m.contactImpulse(c)});
    }));
    rows.push({step:i,time:clock,deathT:pose.deathT,minimum:meshMinimum,hullMinimum,position:p,rotation:q,linvel:lv,angvel:av,mass:body.mass(),localCom:body.localCom(),inertia:body.principalInertia(),contacts});
    system.fixedPost(source.dt);
  }
  const result={iterations,scenario:capture.scenario,steps:rows.length,capturedSteps:capture.steps.length,state:ragdoll.state,initialDifference,maxBodyDelta,maxBoneDelta,maxSupportGap,minimum:Math.min(...rows.map(r=>r.minimum)),framesBelow5mm:rows.filter(r=>r.minimum<-.005).length,finalMinimum:rows.at(-1)?.minimum,rows};
  ragdoll.dispose();physics.dispose();return result;
}
const results=[];
for(let i=0;i<2;i++) {
  const path=`${input}/replay-case-${i}.json`,bytes=readFileSync(path),capture=JSON.parse(bytes);
  const baseline=solve(capture,0);writeFileSync(`${output}/case${i}-iterations0.json`,JSON.stringify(baseline));
  const reproducible=baseline.maxBodyDelta<.0002&&baseline.maxBoneDelta<1e-8&&baseline.steps===capture.steps.length;
  results.push({case:i,inputSha256:hash(bytes),settings:capture.settings,reproducible,baseline:{...baseline,rows:undefined}});
  if(!reproducible)continue;
  for(const iterations of [2,4]) {const result=solve(capture,iterations);writeFileSync(`${output}/case${i}-iterations${iterations}.json`,JSON.stringify(result));results.push({case:i,result:{...result,rows:undefined}});}
}
writeFileSync(`${output}/summary.json`,JSON.stringify({studyOnly:true,acceptance:false,scope:'Controlled exact-native physical replay with original numeric clips and captured owned inputs. Only per-body additionalSolverIterations differs; global/default/mass/inertia/geometry untouched. Baseline reproduction required before comparative runs.',results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
