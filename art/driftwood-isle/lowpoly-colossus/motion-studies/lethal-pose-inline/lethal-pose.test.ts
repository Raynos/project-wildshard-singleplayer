import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { DecisionHost, type DecisionScript } from '../../../../../src/engine/script/decision';
import { createScriptScenario, type ScriptScenario } from '../../../../../src/sdk/scriptScenario';
import { compileDecisionScripts } from '../../../../../src/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '../../../../../src/sdk/decisionScriptBindings';
import { SCRIPT_V1_EVENTS } from '../../../../../src/format/scriptAbiV1';
import { numericCreaturePose, } from '../../../../../src/game/plugin/channelPrograms';
import { RigidCorpsePose, supportsRigidCorpseAnimation } from '../../../../../src/engine/entities/rigidCorpsePose';
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_FIELDS, TIDAL_GIANTS_MOVES, TIDAL_GIANTS_STRIKES } from '../../../../../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { createColossusNativePreviewSource, createColossusNativePreviewOutput } from '../../../../../src/shards/driftwood-isle/generators/colossusNativePreview';
import { colossusNativeClips as liveClips } from '../../../../../src/shards/driftwood-isle/generators/colossusNativeClips';
import { colossusNativeClips as rejectedClips } from '../death-fold1/colossusDeathFoldClips';
import { colossusNativeClips } from './colossusLethalPoseClips';
import { createColossusLethalPoseCandidateSource, createColossusLethalPoseCandidateOutput, decisions, retainedFields } from './candidateFactory';
import { rig } from './rig';
const originalDestination = 'art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/';
const destination = 'art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/';
const fields = [...TIDAL_GIANTS_FIELDS, ...retainedFields];
const registries = { actors: new Map([['driftwood.colossus', 2]]), moves: new Map(TIDAL_GIANTS_MOVES.map((r,i)=>[r.id,i+1])), strikes: new Map(TIDAL_GIANTS_STRIKES.map((r,i)=>[r.id,i+1])), fields: new Map(fields.map(r=>[r.name,r.id])) };
let candidate: Awaited<ReturnType<typeof compileDecisionScripts>>, baseline: typeof candidate;
beforeAll(async () => {
  candidate = await compileDecisionScripts(decisions, registries, new Map([['behaviour/tide-root-colossus.as', readFileSync(`${destination}behaviour/tide-root-colossus.as`,'utf8')]]), { asLineCeiling: 300 });
  baseline = await compileDecisionScripts(TIDAL_GIANTS_DECISIONS.filter(r=>r.id==='driftwood.colossus.decision'), registries, new Map([['behaviour/tide-root-colossus.as', readFileSync('src/shards/driftwood-isle/behaviour/tide-root-colossus.as','utf8')]]), { asLineCeiling: 300 });
},120000);
function scenario(isCandidate=true) {
  const compiled=isCandidate?candidate:baseline, row=compiled.rows[0]; if(row===undefined) throw new Error('No row');
  const blob=compiled.blobs.find(b=>b.file.path===row.module); if(blob===undefined) throw new Error('No Wasm');
  const generated=generateDecisionBindings(row,registries);
  const script:DecisionScript={...row,reads:isCandidate?['nearestPlayer','distance','hpShare','strikeState','stunned','alive','field']:['nearestPlayer','distance','hpShare','strikeState','stunned','alive'],lists:[],ids:generated.map.ids};
  return createScriptScenario(DecisionHost,{bytes:blob.bytes,script,seed:487,binding:{id:1,script:row.id,self:2,actors:[2],instance:0},
    actors:[{id:2,at:[0,0,0],fields:Object.fromEntries(fields.map(f=>[f.id,f.default])),fieldBounds:Object.fromEntries(fields.map(f=>[f.id,{min:f.min,max:f.max}]))}],players:[{id:99,at:[0,0,2]}]});
}
function actor(s:ScriptScenario) { const a=s.world.snapshot().actors?.[0]; if(a===undefined)throw new Error('No actor'); return a; }
function setPose(s:ScriptScenario,stage:number,clock:number) { const a=actor(s); s.world.setActor({...a,alive:false,fields:{...a.fields,110:stage,111:clock}}); }
function memory(s:ScriptScenario) { const f=actor(s).fields; return Object.fromEntries(fields.map(row=>[row.name,f?.[row.id]??row.default])); }
const snapshots=(r:ReturnType<typeof rig>)=>Object.values(r.bones).flatMap(b=>[...b.position,...b.quaternion,...b.scale]).map(value=>value===0?0:value);
const samples = [[0,0],[0,.75],[4,.2],[5,.2], ...([1,2,3] as const).flatMap(stage=> {
  const wind=stage===3?1.1:.9,active=stage===3?.18:.25,recover=stage===3?1.5:.35;
  return [0,wind*.4,wind*.8,wind-1e-6,wind,wind+active*.5,wind+active-1e-6,wind+active,wind+active+recover*.5,wind+active+recover].map(clock=>[stage,clock]);
})];

test('strict candidate catalogue, numeric/native admission; all non-pose gameplay products unchanged',()=>{
 const a=createColossusLethalPoseCandidateSource(), b=createColossusNativePreviewSource();
 expect(a.state.shared.slice(0,5)).toEqual(b.state.shared); expect(a.rows).toEqual(b.rows); expect(a.runtime).toEqual(b.runtime);
 const output=createColossusLethalPoseCandidateOutput({diagnosticOnly:true}), old=createColossusNativePreviewOutput({diagnosticOnly:true});
 for(const [path,bytes] of old.platform?.files??[]) if(path!=='sections/sim/scripts.json') expect(output.platform?.files.get(path)).toEqual(bytes);
 const animate=numericCreaturePose(colossusNativeClips()); expect(supportsRigidCorpseAnimation(animate)).toBe(true);
 expect(()=>numericCreaturePose({...colossusNativeClips(),unrecognized:true})).toThrow();
 expect(()=>numericCreaturePose({...colossusNativeClips(),scalars:[{name:'bad',path:['mem','__proto__']}]})).toThrow();
 writeFileSync(`${destination}clips.json`,JSON.stringify(colossusNativeClips(),null,2));
});

const orderingEvidence: {stage:number;clock:number;ordering:string;refusals:number;maxFuel:number}[]=[];
afterAll(()=>{ if(orderingEvidence.length>0)writeFileSync(`${destination}ordering-results.json`,JSON.stringify(orderingEvidence,null,2)); });
test.each(samples.flatMap(([stage=0,clock=0])=>['hit-death','death-hit','batch-hit-death','batch-death-hit'].map(ordering=>({stage,clock,ordering}))))('interruption $stage/$clock $ordering preserves inputs once',({stage,clock,ordering})=>{
  const s=scenario();s.send('start');setPose(s,stage,clock);
  if(ordering.startsWith('batch')) {
   const hit: [number,number,number,number,number,number]=[SCRIPT_V1_EVENTS.hit,2,99,22,0,0];
   const death: [number,number,number,number,number,number]=[SCRIPT_V1_EVENTS.death,2,99,0,0,0];
   for(const e of ordering==='batch-hit-death'?[hit,death]:[death,hit])s.host.enqueue(1,e); s.advance(.2);
  } else if(ordering==='hit-death') { s.send('hit','self',99,22,0);s.send('death','self',99); }
  else {s.send('death','self',99);s.send('hit','self',99,22,-2);}
  orderingEvidence.push({stage,clock,ordering,refusals:s.host.metrics()[0]?.refusals??-1,maxFuel:s.maxFuel()});
  expect(s.trace().filter(t=>t.kind==='call'&&!t.ok), `${ordering} ${stage}/${clock}`).toEqual([]);
  expect(memory(s), `${ordering} ${stage}/${clock}`).toMatchObject({'tg-state':6,'tg-clock':0,'tg-exposed':0,'tg-awake':0,'tg-death-step':stage,'tg-death-clock':clock,'tg-death-valid':1});
  for(let i=0;i<3;i++){s.send('death','self',99);s.send('hit','self',99,22,0);}
  expect(memory(s)['tg-death-step']).toBe(stage);expect(memory(s)['tg-death-clock']).toBe(clock);
  expect(s.host.metrics()[0]?.refusals).toBe(0);expect(Object.values(s.state()).every(x=>typeof x==='boolean'||Number.isFinite(x))).toBe(true);
  const commands=s.trace().flatMap(t=>t.kind==='call'&&t.ok?t.commands:[]);
  // One initialization write, then exactly one lethal capture, even after repeats.
  for(const id of [115,116,117])expect(commands.filter(c=>c[0]===4&&c[2]===id)).toHaveLength(2);
  const lethal=commands.findIndex(c=>c[0]===4&&c[2]===117&&c[3]===1);
  expect(lethal).toBeGreaterThan(0);expect(commands[lethal+2]).toEqual([4,2,110,6,0]);

});

test('same-time native joint onset exact and fixed first endpoint/interpolation match retained-input oracle',()=>{
 let count=0;
 for(const [stage=0,clock=0] of samples) for(const flinch of [0,.3,1]) {
  const s=scenario();s.send('start');setPose(s,stage,clock);
  const r=rig(),oracle=rig(),animate=numericCreaturePose(colossusNativeClips()),old=numericCreaturePose(rejectedClips());
  for(const c of [r.context,oracle.context]){c.t=2.31;c.flinch=flinch;c.mem={'tg-state':stage,'tg-clock':clock};}
  animate(r.context);old(oracle.context);const before=snapshots(r);expect(before).toEqual(snapshots(oracle));
  s.send('hit','self',99,22,0);r.context.mem=memory(s);r.context.alive=false;r.context.deathT=0;animate(r.context);expect(snapshots(r)).toEqual(before);
  oracle.context.alive=false;oracle.context.deathT=0;
  const a=new RigidCorpsePose({...r.context,bones:r.bones},animate),b=new RigidCorpsePose({...oracle.context,bones:oracle.bones},old);
  for(let i=0;i<49;i++){a.step(1/60);b.step(1/60);for(const alpha of [0,.25,.5,.75,1]){a.render(alpha);b.render(alpha);expect(snapshots(r)).toEqual(snapshots(oracle));expect(snapshots(r).every(Number.isFinite)).toBe(true);}}
  count++;
 }
 writeFileSync(`${destination}onset-results.json`,JSON.stringify({samples:count,sameTimeMaximumTransformJump:0,fixedStepsPerSample:49,renderAlphas:[0,.25,.5,.75,1],physicalAcceptance:false},null,2));
});

const livingMetrics: unknown[]=[];
afterAll(()=>{ if(livingMetrics.length>0)writeFileSync(`${destination}living-metrics.json`,JSON.stringify(livingMetrics,null,2)); });
test('living output is exact even with stale retained fields; living command/actions state matches original guest',()=>{
 const r=rig(),b=rig(),animate=numericCreaturePose(colossusNativeClips()),old=numericCreaturePose(liveClips());
 for(const stage of [0,1,2,3,4,5])for(let i=0;i<=100;i++){
  for(const c of [r.context,b.context]){c.t=i/11;c.flinch=(i%3)/2;c.mem={'tg-state':stage,'tg-clock':i/30,'tg-death-step':3,'tg-death-clock':.88,'tg-death-valid':1};}
  animate(r.context);old(b.context);expect(snapshots(r)).toEqual(snapshots(b));
 }
 for(const hpShare of [1,.5,.2]){
  const a=scenario(),b=scenario(false);for(const s of [a,b]){s.world.setActor({...actor(s),hpShare});s.send('start');}
  for(let i=0;i<30;i++){
   for(const s of [a,b]) { s.advance(.2); }
   expect(a.commands()).toEqual(b.commands());const {poseCaptured,...state}=a.state();expect(poseCaptured).toBe(0);expect(state).toEqual(b.state());
   for(const s of [a,b]) { const x=actor(s);s.world.setActor({...x,strikeState:i%4});s.send('hit','self',99,3,.5); }
   expect(a.commands()).toEqual(b.commands());
   if(i%5===0)for(const s of [a,b])s.send('strike.done','self','left',true);
   expect(a.commands()).toEqual(b.commands());
   for(const f of TIDAL_GIANTS_FIELDS)expect(actor(a).fields?.[f.id]).toBe(actor(b).fields?.[f.id]);
   livingMetrics.push({hpShare,i,candidate:a.host.metrics(),baseline:b.host.metrics()});
   expect(a.host.metrics()[0]?.refusals,'candidate living must not hide matching refusals').toBe(0);
   expect(b.host.metrics()[0]?.refusals,'baseline living must not hide matching refusals').toBe(0);
  }
 }
});

test('start initialization clears retained state; actual host save/restore preserves once-only latch',()=>{
 const s=scenario();s.send('start');setPose(s,3,.88);s.send('death','self',99);const saved=s.save();
 s.send('start');expect(memory(s)).toMatchObject({'tg-death-step':0,'tg-death-clock':0,'tg-death-valid':0});expect(s.state()['poseCaptured']).toBe(0);
 s.restore(saved);s.send('hit','self',99,22,0);expect(memory(s)).toMatchObject({'tg-death-step':3,'tg-death-clock':.88,'tg-death-valid':1});
 const reload=scenario();reload.restore(saved);reload.send('death','self',99);expect(memory(reload)).toEqual(memory(s));
 reload.send('start');setPose(reload,2,.3);reload.send('hit','self',99,22,0);expect(memory(reload)['tg-death-step']).toBe(2);expect(memory(reload)['tg-death-clock']).toBe(.3);
 for(const item of [s,reload])expect(item.host.metrics()[0]?.refusals).toBe(0);
});

test('invalid scalar refuses atomically; prior contact failure remains recorded as FAILED',()=>{
 const r=rig(),animate=numericCreaturePose(colossusNativeClips());animate(r.context);const before=snapshots(r);
 r.context.mem['tg-death-clock']=NaN;expect(()=>animate(r.context)).toThrow();expect(snapshots(r)).toEqual(before);
 const replay:unknown=JSON.parse(readFileSync(`${originalDestination}../death-fold1/world-replay.json`,'utf8'));
 expect(replay).toMatchObject({summary:{frames:141,framesBelow:135}});
 const hashes=Object.fromEntries(['src/shards/driftwood-isle/generators/colossusNativeClips.ts','src/shards/driftwood-isle/behaviour/tide-root-colossus.as',`${originalDestination}../death-fold1/world-replay.json`].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 writeFileSync(`${destination}evidence.json`,JSON.stringify({status:'Actual two-annotation source candidate; unchanged baseline paired gate remains FAILED; not promotion',publicInputs:hashes,contact:{status:'FAILED',framesBelow:135,total:141},orderingCases:samples.length*4,livingPoseSamples:606,engineChanges:0,bodyChanges:0},null,2));
});

test('duplicate lethal transition leaves unrelated stop/tick/strike-done dispatch intact; no guest rewards',()=>{
 const s=scenario();s.send('start');setPose(s,3,1.2);s.send('hit','self',99,22,0);
 for(const event of ['stop','strike.done'] as const){
  if(event==='stop')s.send('stop');else s.send('strike.done','self','slam',true);
  expect(s.commands()).toContainEqual(['stop','self']);
  expect(memory(s)).toMatchObject({'tg-death-step':3,'tg-death-clock':1.2,'tg-state':6});
 }
 s.advance(.2);expect(s.commands()).toContainEqual(['stop','self']);
 s.send('hit','self',99,22,0);expect(memory(s)['tg-death-clock']).toBe(1.2);
 expect(s.trace().flatMap(t=>t.kind==='call'&&t.ok?t.commands:[]).some(c=>c[0]===10||c[0]===11)).toBe(false);
 expect(s.host.metrics()[0]?.refusals).toBe(0);
});

test('baseline comparison: actual host must admit the ordinary paired lethal dispatch',()=>{
 const results=[];
 for(const isCandidate of [false,true]){
  const s=scenario(isCandidate);s.send('start');setPose(s,3,.88);
  s.host.enqueue(1,[SCRIPT_V1_EVENTS.hit,2,99,22,0,0]);s.host.enqueue(1,[SCRIPT_V1_EVENTS.death,2,99,0,0,0]);s.advance(.2);
  results.push({isCandidate,metrics:s.host.metrics(),calls:s.trace().filter(t=>t.kind==='call'),memory:memory(s)});
 }
 writeFileSync(`${destination}paired-dispatch-failure.json`,JSON.stringify(results,null,2));
 expect(results.every(row=>row.metrics.every(m=>m.refusals===0)),'Real paired lethal dispatch is a required gate, never an expected-failure pass').toBe(true);
});
