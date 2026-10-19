// Controlled native contact fixture, not gameplay or candidate5 capture.
// Run from repository root: node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/captured-corpse-terrain/run.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, Group, Vector3, Quaternion, Euler, Matrix4 } from 'three';
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = new URL('http://localhost/');
const { loadRapier } = await import('../../../src/engine/physics/rapier.ts');
const { Physics } = await import('../../../src/engine/physics/Physics.ts');
const { Ragdolls, setRagdollClock } = await import('../../../src/engine/physics/ragdoll.ts');
const { RigidCorpsePose } = await import('../../../src/engine/entities/rigidCorpsePose.ts');
const { numericCreaturePose } = await import('../../../src/game/plugin/channelPrograms.ts');
const { bellbackTuckedClips } = await import('../../../src/shards/driftwood-isle/generators/bellbackTuckedClips.ts');
const out = 'docs/reviews/captured-corpse-terrain';
const nativePath = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json';
const capturePath = i => `art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/solver-study1/replay-case-${i}.json`;
const native = JSON.parse(readFileSync(nativePath));
const captures = [0,1].map(i => JSON.parse(readFileSync(capturePath(i))));
const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const proposalPath='docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json';
const proposal=JSON.parse(readFileSync(proposalPath)).rigidCorpse;
if(hash(nativePath)!=='32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44')throw Error('Canonical Frame2 geometry changed');
for(const capture of captures)if(JSON.stringify(capture.initial.dims.rigidCorpse)!==JSON.stringify(proposal))throw Error('Canonical recipe changed');
const pins = Object.fromEntries([nativePath,proposalPath,...[0,1].map(capturePath),'src/engine/physics/ragdoll.ts','src/engine/physics/rigidCorpse.ts','src/engine/entities/rigidCorpsePose.ts','src/engine/physics/Physics.ts','src/engine/physics/rapier.ts','src/engine/physics/rapierBindings.ts','src/game/plugin/channelPrograms.ts','src/shards/driftwood-isle/generators/bellbackTuckedClips.ts','scripts/bake-loader.mjs','public/assets/physics/rapier.wasm'].map(p => [p,hash(p)]));
const locals = native.parts.map(p => { const rest = native.bones.find(b => b.name === p.name).pos; return { name:p.name, points:p.positions.map((v,i) => v-rest[i%3]) }; });
if (locals.reduce((n,p)=>n+p.points.length/3,0)!==13374) throw Error('Expected full native mesh');
const orientations = [[0,0,0],[0,Math.PI/2,0],[.43,1.13,-.61],[-.78,-.91,1.27]];
const dt=1/60, clearance=.002;
function check(condition,message) { if(!condition)throw Error(message); }
function write(name,value) {const text=JSON.stringify(value);check(Buffer.byteLength(text)<=5_000_000,`Oversize ${name}`);writeFileSync(`${out}/${name}`,text+'\n');}
function solve(poseIndex,orientationIndex,slope,scale) {
  const initial=captures[poseIndex].initial, physics=new Physics(R), world=physics.world, settings=captures[poseIndex].settings;
  for(const [k,v] of Object.entries(settings))check(world.integrationParameters[k]===v,`Default ${k}`);
  const root=new Group();root.position.fromArray(initial.root.position);root.quaternion.fromArray(initial.root.rotation).premultiply(new Quaternion().setFromEuler(new Euler(...orientations[orientationIndex])));root.scale.setScalar(scale);
  const bones={};
  for(const b of native.bones){ const joint=new Bone();joint.name=b.name;const v=initial.bones[b.name];joint.position.fromArray(v);joint.quaternion.fromArray(v,3);(b.parent===null?root:bones[b.parent]).add(joint);bones[b.name]=joint; }
  root.updateMatrixWorld(true);
  const boneSnapshot=()=>JSON.stringify(Object.values(bones).map(b=>[...b.position,...b.quaternion,...b.scale]));
  const lethalBones=boneSnapshot();
  const slopeQ=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),slope*Math.PI/180),normal=new Vector3(0,1,0).applyQuaternion(slopeQ);
  // A single initial terrain placement, never a root/velocity correction: set top-plane
  // signed offset to the actual posed mesh minimum minus 2 mm. Keep captured root XYZ.
  let offset=0, topCenter, maxFootprint=0;
  function measure(matrices) {
    let minimum=Infinity, maximumFootprint=0;
    for(const part of locals){const m=matrices[part.name].elements, a=normal.x*m[0]+normal.y*m[1]+normal.z*m[2],b=normal.x*m[4]+normal.y*m[5]+normal.z*m[6],c=normal.x*m[8]+normal.y*m[9]+normal.z*m[10],d=normal.x*m[12]+normal.y*m[13]+normal.z*m[14]-offset;
      for(let i=0;i<part.points.length;i+=3){const x=part.points[i],y=part.points[i+1],z=part.points[i+2];minimum=Math.min(minimum,a*x+b*y+c*z+d);
        if(topCenter){const wx=m[0]*x+m[4]*y+m[8]*z+m[12]-topCenter.x,wy=m[1]*x+m[5]*y+m[9]*z+m[13]-topCenter.y,wz=m[2]*x+m[6]*y+m[10]*z+m[14]-topCenter.z;const alongX=Math.cos(slope*Math.PI/180)*wx+Math.sin(slope*Math.PI/180)*wy;maximumFootprint=Math.max(maximumFootprint,Math.abs(alongX),Math.abs(wz));}
      }
    }
    maxFootprint=Math.max(maxFootprint,maximumFootprint);return minimum;
  }
  const matrices=()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.matrixWorld]));
  offset=measure(matrices())-clearance;
  topCenter=root.position.clone().addScaledVector(normal,offset-normal.dot(root.position));
  const center=topCenter.clone().addScaledVector(normal,-2), ground=world.createCollider(R.ColliderDesc.cuboid(100,2,100).setTranslation(center.x,center.y,center.z).setRotation(slopeQ).setFriction(.5).setRestitution(0).setCollisionGroups(captures[poseIndex].environment[0].collisionGroups));
  // Use the actual f32 native terrain transform for every distance calculation.
  const actualQ=ground.rotation();normal.set(0,1,0).applyQuaternion(actualQ).normalize();topCenter=new Vector3().copy(ground.translation()).addScaledVector(normal,2);offset=normal.dot(topCenter);
  const initialMinimum=measure(matrices());
  const dims=structuredClone(initial.dims);dims.rigidCorpse.posePolicy='captured';
  check(dims.rigidCorpse.parts.reduce((n,p)=>n+p.points.length,0)===435,'Expected strict 435-point recipe');
  const position=root.position.clone(),mem={...initial.contextMem};
  const context={...initial.context,scale,bones,dims,mem,position,lookTarget:new Vector3(),animal:{mem,position,yOffset:0}};
  const system=new Ragdolls(physics,2);
  const makeSpec=()=>({build:'rigid',corpsePose:new RigidCorpsePose(context,numericCreaturePose(bellbackTuckedClips()),structuredClone(initial.inputs),'captured'),root,bones,dims,scale,lite:true,velocity:initial.velocity,damage:initial.damage,hitPoint:new Vector3(...initial.hitPoint),dir:new Vector3(...initial.dir)});
  const ragdoll=system.spawn(makeSpec());check(ragdoll!==null,'spawn');
  const body=ragdoll.parts[0].body, initialBody={position:body.translation(),rotation:body.rotation(),linvel:body.linvel(),angvel:body.angvel()};
  check(['x','y','z'].every(k=>Math.abs(initialBody.linvel[k]-initial.body.linvel[k])<1e-6&&Math.abs(initialBody.angvel[k]-initial.body.angvel[k])<1e-6),'Original native throw');
  const relative=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,new Matrix4().copy(root.matrixWorld).invert().multiply(b.matrixWorld)]));
  const localShapes=()=>JSON.stringify(ragdoll.corpseColliders.map(p=>[p.collider.translationWrtParent(),p.collider.rotationWrtParent(),Array.from(p.collider.vertices())]));
  const shapeSnapshot=localShapes();
  const rows=[];let minFixed=Infinity,minRender=Infinity,failFixed=0,failRender=0,properties,freezeReason,finalMinimum;
  for(let step=1;step<=360&&ragdoll.state==='live';step++){
    system.fixedPre(dt);check(localShapes()===shapeSnapshot,'local geometry changed');physics.step();
    const p=body.translation(),q=body.rotation(),lv=body.linvel(),av=body.angvel(),sleeping=body.isSleeping();
    const props={mass:body.mass(),localCom:body.localCom(),inertia:body.principalInertia(),additionalSolverIterations:body.additionalSolverIterations(),linearDamping:body.linearDamping(),angularDamping:body.angularDamping(),gravityScale:body.gravityScale()};
    if(properties)check(JSON.stringify(props)===JSON.stringify(properties),'mass/inertia/settings changed');else { properties=props; const x=dims.halfWidth*scale,y=dims.bodyY*.5*scale,z=Math.max(dims.bodyHalfLen,dims.bodyRadius)*scale; check(Math.abs(props.mass-5)<1e-6&&Math.abs(props.localCom.y-dims.bodyY*.6*scale)<1e-6&&Object.values(props.inertia).sort((a,b)=>a-b).every((v,i)=>Math.abs(v-[5/3*(y*y+z*z),5/3*(x*x+z*z),5/3*(x*x+y*y)].sort((a,b)=>a-b)[i])<1e-5)&&props.additionalSolverIterations===0,'original mass/inertia'); }
    const rootMatrix=new Matrix4().compose(new Vector3().copy(p),new Quaternion().copy(q),new Vector3(scale,scale,scale));
    const fixed=measure(Object.fromEntries(Object.entries(relative).map(([n,m])=>[n,new Matrix4().multiplyMatrices(rootMatrix,m)])));
    minFixed=Math.min(minFixed,fixed);if(fixed<-.005)failFixed++;
    const contacts=[];for(const part of ragdoll.corpseColliders)world.contactPair(part.collider,ground,m=>{for(let i=0;i<m.numContacts();i++)contacts.push({bone:part.bone.name,distance:m.contactDist(i),impulse:m.contactImpulse(i)});});
    system.fixedPost(dt);
    const observations=[];
    // A common phase origin: 30 Hz sees each second fixed endpoint; 60 Hz each
    // endpoint; 120 Hz each endpoint and its halfway interpolation. Also sample
    // alpha=0 explicitly to retain both fixed interpolation ends.
    const samples=[['endpoint0',0],['60Hz',1],['120Hz',.5],['120Hz',1]];if(step%2===0)samples.push(['30Hz',1]);
    for(const [rate,alpha] of samples){setRagdollClock(()=>alpha);ragdoll.pose(1/(rate==='30Hz'?30:rate==='60Hz'?60:120));const minimum=measure(matrices());check(boneSnapshot()===lethalBones,'captured bone changed');minRender=Math.min(minRender,minimum);if(minimum<-.005)failRender++;observations.push({rate,alpha,minimum});}
    if(ragdoll.state==='frozen'){freezeReason=ragdoll.age>=5?'MAX_T':sleeping?'sleep':'quiet';finalMinimum=measure(matrices());}
    rows.push({step,time:step*dt,fixed,position:p,rotation:q,linvel:lv,angvel:av,contacts,observations,state:ragdoll.state});
  }
  const final=rows.at(-1), finalSpeed=Math.hypot(final.linvel.x,final.linvel.y,final.linvel.z),frozen=ragdoll.state==='frozen';
  check(world.bodies.len()===0&&world.colliders.len()===1&&system.live===0,'freeze cleanup');
  ragdoll.dispose();const retry=system.spawn(makeSpec());check(retry!==null,'retry spawn');retry.dispose();check(world.bodies.len()===0&&world.colliders.len()===1&&system.live===0,'retry cleanup');
  const absentDims={...dims};delete absentDims.rigidCorpse;
  const absent=system.spawn({...makeSpec(),dims:absentDims,corpsePose:undefined});check(absent!==null&&!absent.fixedPose&&absent.corpseColliders.length===0&&world.colliders.len()===2,'default absence');absent.dispose();
  const result={poseIndex,orientationIndex,eulerXYZ:orientations[orientationIndex],slopeDegrees:slope,scale,initialMinimum,initialRoot:initial.root,initialBody,terrain:{halfExtents:[100,2,100],position:ground.translation(),rotation:ground.rotation(),normal:normal.toArray(),offset},settings,properties,rows:rows.length,minFixed,minRender,failFixed,failRender,finalMinimum,finalSpeed,freezeReason,frozen,restAtFreeze:finalSpeed<.12&&Math.hypot(final.angvel.x,final.angvel.y,final.angvel.z)*.05<.12,movingAtMaxT:freezeReason==='MAX_T'&&finalSpeed>=.12,maxFootprint,cleanup:true,retry:true,defaultAbsence:true,contactPass:failFixed===0&&failRender===0,pass:failFixed===0&&failRender===0&&frozen&&Math.abs(finalMinimum)<=.005&&finalSpeed<.12&&Math.hypot(final.angvel.x,final.angvel.y,final.angvel.z)*.05<.12&&maxFootprint<100};
  physics.dispose();setRagdollClock(null);write(`pose${poseIndex}-orientation${orientationIndex}-slope${slope}-scale${scale}.json`,{...result,observations:rows});console.log(JSON.stringify(result));return result;
}
const results=[];
for(const p of [0,1])for(const o of [0,1,2,3])for(const slope of [0,15,26])results.push(solve(p,o,slope,1));
for(const p of [0,1])for(const scale of [.5,2])results.push(solve(p,2,26,scale));
write('summary.json',{sourcePin:'803359c25722126591ea08c9e4e63872af5b5db5',pins,scope:'Controlled native WORLD box-top contact fixture from two candidate4 recorded initial lethal poses. Not candidate5 gameplay, terrain host acceptance, phone performance, or authored terrain. Terrain initially placed beneath the captured mesh at 2 mm clearance; no root lift or subsequent correction. Native original throw, default global solver and mass/inertia code.',vertexCount:13374,hullPoints:435,bones:8,results,pass:results.every(r=>r.pass)});
