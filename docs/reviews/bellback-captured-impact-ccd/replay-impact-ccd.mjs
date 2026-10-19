// Controlled native diagnostic only. Never mutates product, shared engine or global solver settings.
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Group, Vector3 } from 'three';
import { admitBellbackCaptured } from '../../../scripts/bellback-captured-admission.mjs';

// Minimal browser storage/location ports used by pure engine imports; no browser or persistence.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = new URL('http://localhost/');
const { loadRapier } = await import('../../../src/engine/physics/rapier.ts');
const { Physics } = await import('../../../src/engine/physics/Physics.ts');
const { Ragdolls, setRagdollClock } = await import('../../../src/engine/physics/ragdoll.ts');
const { RigidCorpsePose } = await import('../../../src/engine/entities/rigidCorpsePose.ts');
const { numericCreaturePose } = await import('../../../src/game/plugin/channelPrograms.ts');
const { bellbackTuckedClips } = await import('../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts');
const { metadata } = admitBellbackCaptured(process.cwd());
const native = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json'));
const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Provide capture directory and new output directory');
mkdirSync(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = v => JSON.parse(JSON.stringify(v));
const same = (a,b) => isDeepStrictEqual(plain(a),plain(b));
const exact = (a,b,label) => { assert.deepStrictEqual(plain(a),plain(b),label); };
const pins=JSON.parse(readFileSync(new URL('./source-pins.json',import.meta.url)));
for(const p of pins.files) assert.equal(hash(readFileSync(p.path)),p.sha256,`Source pin ${p.path}`);
const bodyState=b=>({position:b.translation(),rotation:b.rotation(),linvel:b.linvel(),angvel:b.angvel(),mass:b.mass(),localCom:b.localCom(),principalInertia:b.principalInertia(),principalInertiaLocalFrame:b.principalInertiaLocalFrame(),linearDamping:b.linearDamping(),angularDamping:b.angularDamping(),gravityScale:b.gravityScale(),additionalSolverIterations:b.additionalSolverIterations(),additionalPgsIterations:b.additionalPgsIterations(),ccd:b.isCcdEnabled(),sleeping:b.isSleeping()});
const shapeState=c=>({type:c.shapeType(),position:c.translation(),rotation:c.rotation(),localPosition:c.translationWrtParent(),localRotation:c.rotationWrtParent(),halfExtents:c.halfExtents(),friction:c.friction(),restitution:c.restitution(),collisionGroups:c.collisionGroups(),solverGroups:c.solverGroups(),sensor:c.isSensor()});
const noHandle = ({handle,...s})=>s;
const scalar=c=>Object.fromEntries(Object.entries(c).filter(([_k,v])=>['number','string','boolean'].includes(typeof v)));
const WINDOW=57;

const localPoints = native.parts.map(p => { const bind = native.bones.find(b => b.name === p.name).pos; return { bone:p.name, points:Array.from({length:p.positions.length/3},(_,i)=>new Vector3(...p.positions.slice(i*3,i*3+3)).sub(new Vector3(...bind))) }; });
function solve(capture, ccd) {
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
  const pose=new RigidCorpsePose(context,numericCreaturePose(bellbackTuckedClips()),inputs,'captured');
  const system=new Ragdolls(physics,2),ragdoll=system.spawn({build:'rigid',corpsePose:pose,root,bones,dims:initial.dims,scale:initial.root.scale,lite:true,velocity:initial.velocity,damage:initial.damage,hitPoint:new Vector3(...initial.hitPoint),dir:new Vector3(...initial.dir)});
  if(!ragdoll)throw new Error('Missing diagnostic corpse');
  const body=ragdoll.parts[0].body;
  const initialDifference=Math.max(...['x','y','z'].flatMap(k=>[Math.abs(body.translation()[k]-initial.body.position[k]),Math.abs(body.linvel()[k]-initial.body.linvel[k]),Math.abs(body.angvel()[k]-initial.body.angvel[k])]));
  if(initialDifference!==0)throw new Error(`Initial physical state mismatch ${initialDifference}`);
  if(!same(ragdoll.corpseColliders.map(p=>({bone:p.bone.name,vertices:Array.from(p.collider.vertices()),indices:Array.from(p.collider.indices())})),capture.nativeShapes))throw new Error('Native hull mismatch');
  if(body.isCcdEnabled()!==initial.body.ccd||body.additionalPgsIterations()!==initial.body.additionalPgsIterations)throw new Error('Unchanged initial settings mismatch');
  exact(bodyState(body),initial.body,'all initial body fields');
  exact(ragdoll.corpseColliders.map(p=>({bone:p.bone.name,...shapeState(p.collider)})),initial.shapes.map(noHandle),'all initial physical shape fields');
  exact(Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,[...b.position,...b.quaternion]])),initial.bones,'initial bones');
  body.enableCcd(ccd);
  const rows=[],renderRows=[];let maxBodyDelta=0,maxBoneDelta=0,maxSupportGap=0,clock=0;
  for(let i=0;i<WINDOW;i++) {
    const source=capture.steps[Math.min(i,capture.steps.length-1)];
    Object.assign(inputs,structuredClone(source.inputs));clock+=source.dt;
    assert.equal(ragdoll.state,'live','window must stay live');
    const before=bodyState(body);
    if(!ccd)exact(before,source.before,`before all body fields step ${i}`);
    system.fixedPre(source.dt);
    const boneState=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,[...b.position,...b.quaternion]]));
    const localShapes=ragdoll.corpseColliders.map(p=>({bone:p.bone.name,position:p.collider.translationWrtParent(),rotation:p.collider.rotationWrtParent()}));
    exact(boneState,source.bones,`held bones step ${i}`);
    exact(localShapes,source.localShapes,`local shapes step ${i}`);
    exact(scalar(pose.context),source.context,`pose context step ${i}`);
    exact(pose.context.mem,source.contextMem,`pose memory step ${i}`);
    for(const [name,b] of Object.entries(bones)) {
      if(i<capture.steps.length) {const actual=[...b.position,...b.quaternion];maxBoneDelta=Math.max(maxBoneDelta,...actual.map((v,j)=>Math.abs(v-source.bones[name][j])));}
    }
    physics.step();
    const after=bodyState(body),worldShapes=ragdoll.corpseColliders.map(p=>({bone:p.bone.name,...shapeState(p.collider)}));
    if(!ccd){exact(after,source.after,`after all body fields step ${i}`);exact(worldShapes,source.worldShapes.map(noHandle),`all world shape fields step ${i}`);}
    for(const key of ['mass','localCom','principalInertia','principalInertiaLocalFrame','linearDamping','angularDamping','gravityScale','additionalSolverIterations','additionalPgsIterations'])exact(after[key],source.after[key],`invariant ${key} step ${i}`);
    for(const [key,value] of Object.entries(capture.settings))assert.equal(world.integrationParameters[key],value,`global ${key} step ${i}`);
    const p=body.translation(),q=body.rotation(),lv=body.linvel(),av=body.angvel();
    if(i<capture.steps.length)maxBodyDelta=Math.max(maxBodyDelta,...['x','y','z'].flatMap(k=>[Math.abs(p[k]-source.after.position[k]),Math.abs(lv[k]-source.after.linvel[k]),Math.abs(av[k]-source.after.angvel[k]),Math.abs(q[k]-source.after.rotation[k])]),Math.abs(q.w-source.after.rotation.w));
    let meshMinimum=Infinity,hullMinimum=Infinity;const point=new Vector3();
    for(let j=0;j<localPoints.length;j++) {
      const collider=ragdoll.corpseColliders[j].collider,translation=collider.translation(),rotation=collider.rotation();
      for(const vertex of localPoints[j].points)meshMinimum=Math.min(meshMinimum,point.copy(vertex).multiplyScalar(initial.root.scale).applyQuaternion(rotation).add(translation).y-900);
      const verts=collider.vertices();for(let k=0;k<verts.length;k+=3)hullMinimum=Math.min(hullMinimum,point.fromArray(verts,k).applyQuaternion(rotation).add(translation).y-900);
    }
    maxSupportGap=Math.max(maxSupportGap,Math.abs(meshMinimum-hullMinimum));
    const contacts=[];
    for(const part of ragdoll.corpseColliders)world.contactPairsWith(part.collider,other=>world.contactPair(part.collider,other,(m,flipped)=>contacts.push({bone:part.bone.name,otherShape:shapeState(other),flipped,normal:m.normal(),points:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i),local1:m.localContactPoint1(i),local2:m.localContactPoint2(i)})),solver:Array.from({length:m.numSolverContacts()},(_,i)=>({distance:m.solverContactDist(i),point:m.solverContactPoint(i)}))})));
    const capturedContacts=source.contacts.map(({other,...c})=>({...c,otherShape:noHandle(capture.environment.find(e=>e.handle===other))}));
    if(!ccd)exact(contacts,capturedContacts,`all manifold fields step ${i}`);
    rows.push({before,after,bones:boneState,localShapes,worldShapes,step:i,time:clock,deathT:pose.deathT,minimum:meshMinimum,hullMinimum,position:p,rotation:q,linvel:lv,angvel:av,ccd:body.isCcdEnabled(),mass:body.mass(),localCom:body.localCom(),inertia:body.principalInertia(),contacts});
    system.fixedPost(source.dt);
    if(!ccd)exact(ragdoll.state,source.resultState,`resultState step ${i}`);
    for(const alpha of [0,.25,.5,.75,1]) {
      setRagdollClock(()=>alpha);ragdoll.pose(0);root.updateMatrixWorld(true);
      let minimum=Infinity;
      for(const part of localPoints)for(const v of part.points)minimum=Math.min(minimum,point.copy(v).applyMatrix4(bones[part.bone].matrixWorld).y-900);
      renderRows.push({step:i,alpha,state:ragdoll.state,minimum});
    }
  }
  const result={ccd,scenario:capture.scenario,steps:rows.length,capturedSteps:capture.steps.length,state:ragdoll.state,initialDifference,maxBodyDelta,maxBoneDelta,maxSupportGap,minimum:Math.min(...rows.map(r=>r.minimum)),framesBelow5mm:rows.filter(r=>r.minimum<-.005).length,renderMinimum:Math.min(...renderRows.map(r=>r.minimum)),renderBelow5mm:renderRows.filter(r=>r.minimum<-.005).length,rows,renderRows};
  setRagdollClock(null);ragdoll.dispose();physics.dispose();return result;
}
// Exactly one captured case and one counterfactual; never run the divergent step 57.
const path=`${input}/native-case-0.json`,bytes=readFileSync(path),capture=JSON.parse(bytes);
assert.equal(hash(bytes),pins.captureSha256,'capture pin');
assert.ok(capture.steps.length>=WINDOW);
const baseline=solve(capture,false);
writeFileSync(`${output}/baseline.json`,JSON.stringify(baseline,null,2)+'\n');
assert.equal(baseline.steps,WINDOW);
assert.equal(baseline.maxBodyDelta,0);
assert.equal(baseline.maxBoneDelta,0);
writeFileSync(`${output}/baseline-gate.json`,JSON.stringify({passed:true,scope:'Initial state and steps 0 through 56 only',exactFields:'Every captured body field before and after, held local bones, pose context and memory, local/world collider physical fields, complete contact manifolds, result state. Collider allocation handles mapped to physical shapes; browser timestamps/frame counters are provenance, not dynamics.',wholeLifecycleBaselineStillRefused:true},null,2)+'\n');
const counterfactual=solve(capture,true);
writeFileSync(`${output}/ccd-true.json`,JSON.stringify(counterfactual,null,2)+'\n');
const brief=r=>({...r,rows:undefined,renderRows:undefined});
const summary={studyOnly:true,acceptance:false,wholeLifecycleAcceptance:false,scope:'Candidate5 case0 initial impact: initial state and zero-based steps 0–56 (0–0.95 seconds). Exactly one body-local enableCcd(true) comparison. No final settle/freeze/lifecycle/terrain/gameplay inference.',baseline:brief(baseline),ccdTrue:brief(counterfactual),fixedMinimumImprovement:counterfactual.minimum-baseline.minimum,renderMinimumImprovement:counterfactual.renderMinimum-baseline.renderMinimum,strict5mmAtAllSampledEndpoints:counterfactual.framesBelow5mm===0&&counterfactual.renderBelow5mm===0,continuousTimeProof:false};
writeFileSync(`${output}/summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
