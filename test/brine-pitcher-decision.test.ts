// oxlint-disable-next-line import/no-nodejs-modules -- Compile the real owned AssemblyScript guest.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '@wildshard/sdk/decisionScriptBindings';
import { DecisionHost, type DecisionScript } from '@wildshard/engine/script/decision';
import { createScriptScenario } from '@wildshard/sdk/scriptScenario';
import { BRINE_PITCHER_DECISIONS, BRINE_PITCHER_FIELDS, BRINE_PITCHER_STRIKES } from '../src/shards/driftwood-isle/generators/brinePitcherCombat';

const registries={actors:new Map([['driftwood.brine-pitcher',1]]),fields:new Map(BRINE_PITCHER_FIELDS.map(r=>[r.name,r.id])),moves:new Map<string,number>(),strikes:new Map(BRINE_PITCHER_STRIKES.map((r,i)=>[r.id,20+i]))};
let product:Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async()=>{product=await compileDecisionScripts(BRINE_PITCHER_DECISIONS,registries,new Map(BRINE_PITCHER_DECISIONS.map(r=>[r.source,readFileSync(`src/shards/driftwood-isle/${r.source}`,'utf8')])),{asLineCeiling:100});});
function make(){
 const row=product.rows[0],blob=product.blobs[0];if(row===undefined||blob===undefined)throw new Error('Missing compiled guest');
 const script:DecisionScript={...row,ids:generateDecisionBindings(row,registries).map.ids,reads:['nearestPlayer','distance','alive','strikeState','stunned'],lists:[]};
 return createScriptScenario(DecisionHost,{bytes:blob.bytes,script,seed:16,binding:{id:1,script:row.id,self:1,actors:[1],instance:0},actors:[{id:1,at:[0,0,0],fields:Object.fromEntries(BRINE_PITCHER_FIELDS.map(f=>[f.id,f.default]))}],players:[{id:99,at:[0,0,8]}]});
}
test('out-of-range idle never pursues or damages; startup has a readable quiet interval',()=>{
 const s=make();s.send('start');s.advance(4);expect(s.state()['step']).toBe(0);expect(s.commands().some(c=>c[0]==='move'||c[0]==='strike')).toBe(false);
 s.world.setActor({id:99,at:[0,0,2]});s.advance(.1);expect(s.state()['step']).toBe(1);expect(s.commands().some(c=>c[0]==='strike')).toBe(true);
});
test('refused strike recovers instead of repeating; stun does not reset its clock forever',()=>{
 const s=make();s.send('start');s.world.setActor({id:99,at:[0,0,2]});s.advance(1.9);expect(s.state()['step']).toBe(1);const refused=s.world.snapshot().actors?.find(r=>r.id===1);if(refused===undefined)throw new Error('Missing actor');s.world.setActor({...refused,strikeState:0});s.advance(.4);expect(s.state()['step']).toBe(0);
 const actor=s.world.snapshot().actors?.find(r=>r.id===1);if(actor===undefined)throw new Error('Missing actor');
 s.world.setActor({...actor,stunned:true});s.advance(.2);expect(s.state()['step']).toBe(4);s.advance(.4);expect(s.state()['elapsed']).toBeGreaterThan(.2);
 s.world.setActor({...actor,stunned:false});s.advance(1);expect(s.state()['step']).toBe(0);
});
test('death suppresses late strike completions and future attacks',()=>{
 const s=make();s.send('start');s.send('death','self',99);const actor=s.world.snapshot().actors?.find(r=>r.id===1);if(actor===undefined)throw new Error('Missing actor');
 s.world.setActor({...actor,alive:false});s.send('strike.done','self','crown',true);s.advance(3);expect(s.state()['step']).toBe(6);expect(s.commands().some(c=>c[0]==='strike')).toBe(false);
});
