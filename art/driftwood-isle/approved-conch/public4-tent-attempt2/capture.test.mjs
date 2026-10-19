import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, DIRECTORY } from './admission.mjs';
import { cadence, checkLiveEvidence, emptyStores, compareCurrentControl, cycleChecks, verifyBindings, stationaryRest, interruptionEvidence, reloadChecks } from './checks.mjs';
const read=p=>readFileSync(resolve(ROOT,p),'utf8');
const rig={cascades:1,shadowLights:1,sceneShadowLights:1,mode:'practical',maxFar:80,margin:60,fade:true,breaks:[1],mapSize:[1024,1024],radius:2,bias:-.00012,normalBias:.05};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const binding=()=>({world:[...identity],bindInverse:[...identity],bindMode:'attached'});
const shader='/* synthetic refusal fixture, not actual linked shader proof */'+' '.repeat(100)+' floor(2704.0/144.0)';
function fixture(){return {events:[],geometry:[binding()],trace:[0,1].map(()=>({bones:Object.fromEntries(Array.from({length:15},(_,i)=>[i,{}])),meshes:[binding()],poseInput:{},strikeSpec:{id:'test',damage:1}})),live:{variant:'tent',errors:[],frames:2,traceStartCount:0,meshes:1,rig,firstUse:{variant:'tent',importedFilterIdentity:true,before:{backendBuilds:0,programCount:0,renderFrame:0,renderCalls:0,gameFrame:0,gameTime:0,graphReceivers:0,hasFilter:false,rig}},clocks:[0,1].map(i=>({wall:i*1000,frame:i,time:i,fixedSteps:1,simulation:{captureFps:null,scale:1,frames:i,elapsed:i}})),shaders:[{mesh:0,linked:true,cast:true,receive:true,fragment:shader}]}};}
test('camera observation retains existing tested protocol with only honest label and passive binding/bounds evidence deltas',()=>{
 const expected=read('scripts/qa-conch-readable-observation.mjs').replaceAll('installConchReadableObservation','installPublic4CameraObservation').replace('CONCH MOTION4 · LIVE COMBAT · OBSERVER','CONCH4 ${window.__public4VariantLabel} · NORMAL CLOCK · FOLLOW CAMERA').replace('bind: mesh.bindMatrix.toArray(), bindInverse:', 'bind: mesh.bindMatrix.toArray(), bindMode: mesh.bindMode, world: mesh.matrixWorld.toArray(), bindInverse:').replace('meshes: meshes.map(mesh => ({ world:', 'arenaCenter: { ...d.arena.center },\n      meshes: meshes.map(mesh => ({ bindMode: mesh.bindMode, world:');
 assert.equal(read(`${DIRECTORY}/camera-observation.mjs`),expected);
});
test('cadence uses actual wall time and distinct delivered frames rather than encoded FPS',()=>{
 const result=cadence([{wall:0,frame:2,simulation:{elapsed:0},fixedSteps:1},{wall:2000,frame:3,simulation:{elapsed:.1},fixedSteps:2}]);assert.equal(result.deliveredFramesPerWallSecond,.5);assert.equal(result.simulationSeconds,.1);assert.equal(result.fixedSteps,3);
});
test('clock, omitted frames, native shader and first-use failures refuse',()=>{
 const valid=fixture();assert.equal(checkLiveEvidence(valid,'tent').samples,2);
 for(const mutate of [x=>{x.live.clocks[1].simulation.captureFps=30;},x=>{x.live.clocks[1].simulation.scale=0;},x=>{x.live.clocks[1].frame=0;},x=>{x.live.frames=3;},x=>{x.live.shaders=[];},x=>{x.live.shaders[0].receive=false;},x=>{x.live.firstUse.before.programCount=1;},x=>{x.trace[0].poseInput=null;}]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>checkLiveEvidence(bad,'tent'));}
});
test('all persistent stores must actually be empty',()=>{
 const row={local:{},session:{},indexedDB:[],serviceWorkers:0,state:{shard:{},generation:0,docs:{a:{keys:{}}}}};assert.equal(emptyStores([row]),true);assert.equal(emptyStores([]),false);
 for(const delta of [{local:{a:'x'}},{indexedDB:['db']},{serviceWorkers:1},{state:{shard:{},generation:1,docs:{}}}])assert.equal(emptyStores([{...row,...delta}]),false);
});
test('original control comparison refuses geometry, strike or rig differences',()=>{
 const a=fixture(),b=fixture();assert.equal(compareCurrentControl(a,b).actualGeometryEqual,true);
 b.geometry=[{changed:true}];assert.throws(()=>compareCurrentControl(a,b));b.geometry=a.geometry;b.trace[0].strikeSpec.damage=2;b.trace[1].strikeSpec.damage=2;assert.throws(()=>compareCurrentControl(a,b));
});
test('missing real phases, damage, rewards or defeat never become a green cycle',()=>{
 const checks=cycleChecks({trace:[],events:[]},{stores:[],errors:[]});assert.equal(checks.attackActive,false);assert.equal(checks.actualPlayerDamage,false);assert.equal(checks.reward,false);assert.equal(checks.playerDefeat,false);assert.equal(checks.stores,false);assert.equal(checks.pause,false);
});
test('runner has no capture-clock, enemy-health or replay injection and no automatic rebuild',()=>{
 const source=read(`${DIRECTORY}/capture.mjs`)+read(`${DIRECTORY}/observe.mjs`);
 for(const banned of ['setCapture(','.frameGate =','.elapsedTime =','a.hp =','a.mem[\'conch-st\'] =','buildHost(','pinReviewed('])assert.equal(source.includes(banned),false);
 assert.ok(source.includes('assertBrowserLane()'));assert.ok(source.includes('verifyHost()'));assert.ok(source.includes('video-framemd5.txt'));assert.ok(source.includes('600000'));
});

test('live binding inverse follows its own world, never cross-run equality',()=>{
 const a=fixture(),b=fixture();for(const m of [b.geometry[0],...b.trace.flatMap(r=>r.meshes)]){m.world[12]=12;m.bindInverse[12]=-12;}
 assert.equal(compareCurrentControl(a,b).actualGeometryEqual,true);assert.equal(verifyBindings(b).checked,3);
 for(const mutate of [m=>m.bindInverse[12]=0,m=>m.bindMode='detached',m=>m.world[0]=0,m=>m.world[4]=NaN,m=>delete m.world]){const bad=structuredClone(b);mutate(bad.trace[0].meshes[0]);assert.throws(()=>verifyBindings(bad));}
 const bad=structuredClone(b);bad.events=[{meshes:[{...binding(),bindInverse:[]}]}];assert.throws(()=>verifyBindings(bad));
});
function restRows(){return [0,1,2].map(i=>({alive:true,hp:60,playerHp:100,stage:2,guard:0,speed:0,flinch:0,strike:{phase:'idle'},poseInput:{attack:-1,speed:0},arenaCenter:{x:0,z:0},actorPosition:[0,900,0],playerPosition:[0,900,3],bout:1,gameTime:i*.25,frame:i}));}
test('stationary post-strike rest is actual neutral motion inside arena, never claimed ordinary idle',()=>{
 const rows=restRows();assert.equal(stationaryRest(rows).verified,true);assert.match(stationaryRest(rows).scope,/not ordinary/);
 for(const mutate of [r=>r.speed=.85,r=>r.stage=1,r=>r.poseInput.attack=.4,r=>r.playerPosition[0]=50,r=>r.actorPosition[0]=r.frame*.1,r=>r.flinch=.2]){const bad=structuredClone(rows);bad.forEach(mutate);assert.equal(stationaryRest(bad).verified,false);}
});
test('trial label without actual boundary damage cannot claim interruption acceptance',()=>{
 const event={phase:'interruption-active',kind:'enemy-damage-before-presentation',dealt:12,poseInput:{attack:-1},strike:{phase:'recover',elapsed:.2},stage:2};
 assert.equal(interruptionEvidence([event]).find(r=>r.intended==='active').actualBoundaryHit,false);
 event.strike.phase='active';assert.equal(interruptionEvidence([event]).find(r=>r.intended==='active').actualBoundaryHit,true);
});
test('reload requires new document and actual post-reload combat, not pre-reload labels',()=>{
 const checks=reloadChecks({events:[]},{documentBefore:10,documentAfter:10,stores:[]});assert.equal(checks.reloadNewDocument,false);assert.equal(checks.reloadRealCombat,false);assert.equal(checks.reloadEmptyStores,false);
});
