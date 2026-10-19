import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import binaryen from 'binaryen';
import { DecisionHost, type DecisionScript } from '../../../src/engine/script/decision';
import { createScriptScenario } from '../../../src/sdk/scriptScenario';
import { compileDecisionScripts } from '../../../src/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '../../../src/sdk/decisionScriptBindings';
import { SCRIPT_V1_EVENTS as E, type ScriptV1Event } from '../../../src/format/scriptAbiV1';
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_FIELDS, TIDAL_GIANTS_MOVES, TIDAL_GIANTS_STRIKES } from '../../../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { decisions, retainedFields } from '../../../art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/candidateFactory';
const dir='docs/reviews/colossus-event-cost-audit/';
const path='behaviour/tide-root-colossus.as';
const original=readFileSync('art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/'+path,'utf8');
const fields=[...TIDAL_GIANTS_FIELDS,...retainedFields];
const registries={actors:new Map([['driftwood.colossus',2]]),moves:new Map(TIDAL_GIANTS_MOVES.map((r,i)=>[r.id,i+1])),strikes:new Map(TIDAL_GIANTS_STRIKES.map((r,i)=>[r.id,i+1])),fields:new Map(fields.map(r=>[r.name,r.id]))};
const hit:ScriptV1Event=[E.hit,2,99,22,0,0],death:ScriptV1Event=[E.death,2,99,0,0,0];
const batches:{name:string;events:ScriptV1Event[];duplicate?:boolean}[]=[
 {name:'lethal-hit',events:[hit]},{name:'death',events:[death]},
 {name:'hit-death',events:[hit,death]},{name:'death-hit',events:[death,hit]},
 {name:'duplicate-hit',events:[hit],duplicate:true},{name:'duplicate-death',events:[death],duplicate:true},
 {name:'duplicate-pair',events:[hit,death],duplicate:true},
 {name:'nonlethal-hit',events:[[E.hit,2,99,2,.5,0]]},
 {name:'dead-tick',events:[[E.tick,0,0,0,0,0]]},
 {name:'dead-strike-done',events:[[E['strike.done'],2,3,1,0,0]]},
 {name:'dead-stop',events:[[E.stop,0,0,0,0,0]]}
];
test('measure unchanged host fuel for real event batches and bounded inlining only',async()=>{
 const results=[];
 for(const [name,source] of [
  ['baseline',readFileSync('src/shards/driftwood-isle/'+path,'utf8')],
  ['candidate',original],
  ['inline-hit',original.replace('export function onHit(', '@inline export function onHit(')],
  ['inline-death',original.replace('export function onDeath(', '@inline export function onDeath(')],
  ['inline-hit-death',original.replace('export function onDeath(', '@inline export function onDeath(').replace('export function onHit(', '@inline export function onHit(')]
 ]){
  if(name===undefined||source===undefined)throw new Error('variant');
  const baseline=name==='baseline';
  const compiled=await compileDecisionScripts(baseline?TIDAL_GIANTS_DECISIONS.filter(r=>r.id==='driftwood.colossus.decision'):decisions,registries,new Map([[path,source]]),{asLineCeiling:300});
  const row=compiled.rows[0],blob=compiled.blobs[0];if(row===undefined||blob===undefined)throw new Error('compile');
  const generated=generateDecisionBindings(row,registries);
  const script:DecisionScript={...row,reads:baseline?['nearestPlayer','distance','hpShare','strikeState','stunned','alive']:['nearestPlayer','distance','hpShare','strikeState','stunned','alive','field'],lists:[],ids:generated.map.ids};
  const module=binaryen.readBinary(blob.bytes);const wat=module.emitText();module.dispose();
  // Meter calls retain their immediate constants, independent of source labels.
  const charges=[...wat.matchAll(/\(call \$[^\s]+\s+\(i32.const (\d+)\)/g)].map(m=>Number(m[1])).filter(n=>n>1000);
  const observations=[];
  for(const batch of batches){
   const s=createScriptScenario(DecisionHost,{bytes:blob.bytes,script,seed:487,binding:{id:1,script:row.id,self:2,actors:[2],instance:0},actors:[{id:2,at:[0,0,0],alive:false,fields:Object.fromEntries(fields.map(f=>[f.id,f.default])),fieldBounds:Object.fromEntries(fields.map(f=>[f.id,{min:f.min,max:f.max}]))}],players:[{id:99,at:[0,0,2]}]});
   s.send('start');const a=s.world.snapshot().actors?.[0];if(a===undefined)throw new Error('actor');s.world.setActor({...a,fields:{...a.fields,110:3,111:.88}});
   if(batch.duplicate)s.send('death','self',99);
   const before=s.trace().length;
   for(const event of batch.events)s.host.enqueue(1,event);
   s.advance(.2);
   observations.push({name:batch.name,calls:s.trace().slice(before).filter(t=>t.kind==='call'),reads:s.trace().slice(before).filter(t=>t.kind==='read'),state:s.state(),fields:s.world.snapshot().actors?.[0]?.fields});
  }
  results.push({name,module:row.module,meterCharges:[...new Set(charges)],bytes:blob.bytes.length,observations});
 }
 writeFileSync(dir+'measurements.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({name:r.name,charges:r.meterCharges,observations:r.observations.map(o=>({name:o.name,calls:o.calls.map(c=>({fuel:c.fuel,ok:c.ok}))}))})),null,2));
 expect(results).toHaveLength(5);
});
