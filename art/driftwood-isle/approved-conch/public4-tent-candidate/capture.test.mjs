import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, DIRECTORY } from './admission.mjs';
import { cadence, checkLiveEvidence, emptyStores, compareCurrentControl, cycleChecks } from './checks.mjs';
const read=p=>readFileSync(resolve(ROOT,p),'utf8');
const rig={cascades:1,shadowLights:1,sceneShadowLights:1,mode:'practical',maxFar:80,margin:60,fade:true,breaks:[1],mapSize:[1024,1024],radius:2,bias:-.00012,normalBias:.05};
const shader='/* synthetic refusal fixture, not actual linked shader proof */'+' '.repeat(100)+' floor(2704.0/144.0)';
function fixture(){return {geometry:[{}],trace:[0,1].map(()=>({bones:Object.fromEntries(Array.from({length:15},(_,i)=>[i,{}])),meshes:[{}],poseInput:{},strikeSpec:{id:'test',damage:1}})),live:{variant:'tent',errors:[],frames:2,traceStartCount:0,meshes:1,rig,firstUse:{variant:'tent',importedFilterIdentity:true,before:{backendBuilds:0,programCount:0,renderFrame:0,renderCalls:0,gameFrame:0,gameTime:0,graphReceivers:0,hasFilter:false,rig}},clocks:[0,1].map(i=>({wall:i*1000,frame:i,time:i,fixedSteps:1,simulation:{captureFps:null,scale:1,frames:i,elapsed:i}})),shaders:[{mesh:0,linked:true,cast:true,receive:true,fragment:shader}]}};}
test('camera observation retains existing tested protocol with only honest variant label delta',()=>{
 const expected=read('scripts/qa-conch-readable-observation.mjs').replaceAll('installConchReadableObservation','installPublic4CameraObservation').replace('CONCH MOTION4 · LIVE COMBAT · OBSERVER','CONCH4 ${window.__public4VariantLabel} · NORMAL CLOCK · FOLLOW CAMERA');
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
