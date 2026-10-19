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
const { Ragdolls, setRagdollClock } = await import('../../../src/engine/physics/ragdoll.ts');
const { RigidCorpsePose } = await import('../../../src/engine/entities/rigidCorpsePose.ts');
const { numericCreaturePose } = await import('../../../src/game/plugin/channelPrograms.ts');
const { bellbackTuckedClips } = await import('../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts');
const { bellbackFoldAlignedStudyClips } = await import('./bellbackFoldAlignedStudyClips.ts');
const { metadata } = admitBellbackFollowing(process.cwd());
const native = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json'));
const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Provide capture directory and new output directory');
mkdirSync(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const same = isDeepStrictEqual;
const localPoints = native.parts.map(p => { const bind = native.bones.find(b => b.name === p.name).pos; return { bone:p.name, points:Array.from({length:p.positions.length/3},(_,i)=>new Vector3(...p.positions.slice(i*3,i*3+3)).sub(new Vector3(...bind))) }; });
function solve(capture, altered) {
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
  const pose=new RigidCorpsePose(context,numericCreaturePose(altered ? bellbackFoldAlignedStudyClips() : bellbackTuckedClips()),inputs);
  const system=new Ragdolls(physics,2),ragdoll=system.spawn({build:'rigid',corpsePose:pose,root,bones,dims:initial.dims,scale:initial.root.scale,lite:true,velocity:initial.velocity,damage:initial.damage,hitPoint:new Vector3(...initial.hitPoint),dir:new Vector3(...initial.dir)});
  if(!ragdoll)throw new Error('Missing diagnostic corpse');
  const body=ragdoll.parts[0].body;
  const initialDifference=Math.max(...['x','y','z'].flatMap(k=>[Math.abs(body.translation()[k]-initial.body.position[k]),Math.abs(body.linvel()[k]-initial.body.linvel[k]),Math.abs(body.angvel()[k]-initial.body.angvel[k])]));
  if(initialDifference>1e-6)throw new Error(`Initial physical state mismatch ${initialDifference}`);
  // No solver-setting changes in this study.
  if(body.additionalSolverIterations()!==0)throw new Error("Unexpected additional iterations");
  const rows=[], renderRows=[];let maxBodyDelta=0,maxBoneDelta=0,maxSupportGap=0,clock=0;
  for(let i=0;i<300&&ragdoll.state==='live';i++) {
    const source=capture.steps[Math.min(i,capture.steps.length-1)];
    Object.assign(inputs,structuredClone(source.inputs));clock+=source.dt;
    system.fixedPre(source.dt);
    for(const [name,b] of Object.entries(bones)) {
      if(i<capture.steps.length) {const actual=[...b.position,...b.quaternion];maxBoneDelta=Math.max(maxBoneDelta,...actual.map((v,j)=>Math.abs(v-source.bones[name][j])));}
    }
    physics.step();
    const p=body.translation(),q=body.rotation(),lv=body.linvel(),av=body.angvel();
    if(i<capture.steps.length) maxBodyDelta=Math.max(maxBodyDelta,...['x','y','z','w'].map(k=>Math.abs(q[k]-source.after.rotation[k])));
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
    // Exercise the actual engine pose interpolation at each cadence, with both zero and half-frame phase.
    for(const hz of [30,60,120])for(const phase of [0,.5]) {
      const start=clock-source.dt, first=Math.ceil(start*hz-phase-1e-9);
      for(let tick=first; ;tick++) {
        const t=(tick+phase)/hz;if(t>=clock-1e-9)break;if(t<start-1e-9)continue;
        const alpha=Math.max(0,Math.min(1,(t-start)/source.dt));
        setRagdollClock(()=>alpha);ragdoll.pose(0);root.updateMatrixWorld(true);
        let minimum=Infinity,hull=Infinity;
        for(let j=0;j<localPoints.length;j++) {
          const matrix=bones[localPoints[j].bone].matrixWorld;
          for(const vertex of localPoints[j].points)minimum=Math.min(minimum,point.copy(vertex).applyMatrix4(matrix).y-900);
          for(const vertex of initial.dims.rigidCorpse.parts[j].points)hull=Math.min(hull,point.fromArray(vertex).applyMatrix4(matrix).y-900);
        }
        renderRows.push({hz,phase,time:t,step:i,alpha,minimum,hullMinimum:hull,state:ragdoll.state});
      }
    }
    setRagdollClock(()=>1);ragdoll.pose(0);
  }
  const result={altered,scenario:capture.scenario,steps:rows.length,capturedSteps:capture.steps.length,state:ragdoll.state,initialDifference,maxBodyDelta,maxBoneDelta,maxSupportGap,minimum:Math.min(...rows.map(r=>r.minimum)),framesBelow5mm:rows.filter(r=>r.minimum<-.005).length,finalMinimum:rows.at(-1)?.minimum,renderSummary:[30,60,120].flatMap(hz=>[0,.5].map(phase=>{const selected=renderRows.filter(r=>r.hz===hz&&r.phase===phase);return {hz,phase,samples:selected.length,minimum:Math.min(...selected.map(r=>r.minimum)),below5mm:selected.filter(r=>r.minimum<-.005).length,maxSupportGap:Math.max(...selected.map(r=>Math.abs(r.minimum-r.hullMinimum)))};})),rows,renderRows};
  ragdoll.dispose();physics.dispose();return result;
}
const results=[];
for(let i=0;i<2;i++) {
  const path=`${input}/replay-case-${i}.json`,bytes=readFileSync(path),capture=JSON.parse(bytes);
  const baseline=solve(capture,false);writeFileSync(`${output}/case${i}-baseline.json`,JSON.stringify(baseline));
  const reproducible=baseline.maxBodyDelta<1e-8&&baseline.maxBoneDelta<1e-8&&baseline.steps===capture.steps.length;
  if(!reproducible)throw new Error('Baseline failed exact reproduction');
  const candidate=solve(capture,true);writeFileSync(`${output}/case${i}-fold-aligned.json`,JSON.stringify(candidate));
  results.push({case:i,inputSha256:hash(bytes),settings:capture.settings,reproducible,baseline:{...baseline,rows:undefined,renderRows:undefined},candidate:{...candidate,rows:undefined,renderRows:undefined},worsened:candidate.minimum<baseline.minimum,passes5mm:candidate.minimum>=-.005&&candidate.renderSummary.every(r=>r.minimum>=-.005)});
}
writeFileSync(`${output}/summary.json`,JSON.stringify({studyOnly:true,acceptance:false,scope:'One isolated body-position-Y timing counterfactual. Original initial/final pose, other channels, original geometry and physical settings retained. Captured terminal inputs repeat if needed after original freeze. Actual native interpolation sampled at 30/60/120 Hz with two phases; no browser or gameplay acceptance.',results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
