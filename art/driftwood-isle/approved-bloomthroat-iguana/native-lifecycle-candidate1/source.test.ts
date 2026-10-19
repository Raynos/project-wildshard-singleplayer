import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '@wildshard/sdk/decisionScriptBindings';
import { DecisionHost, type DecisionScript } from '@wildshard/engine/script/decision';
import { createScriptScenario } from '@wildshard/sdk/scriptScenario';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { supportsRigidCorpseAnimation } from '../../../../src/engine/entities/rigidCorpsePose';
import { BLOOMTHROAT_IGUANA_DECISIONS as decisions, BLOOMTHROAT_IGUANA_FIELDS as fields, BLOOMTHROAT_IGUANA_MOVES as moves, BLOOMTHROAT_IGUANA_STRIKES as strikes } from '../../../../src/shards/driftwood-isle/generators/bloomthroatIguanaCombat';
import { bloomthroatIguanaNativeClips } from '../../../../src/shards/driftwood-isle/generators/bloomthroatIguanaNativeClips';
import { createBloomthroatIguanaNativePreviewSource, createBloomthroatIguanaNativePreviewOutput } from '../../../../src/shards/driftwood-isle/generators/bloomthroatIguanaNativePreview';
const registries={actors:new Map([['driftwood.bloomthroat-iguana',1]]),fields:new Map(fields.map(r=>[r.name,r.id])),moves:new Map(moves.map(r=>[r.id,10])),strikes:new Map(strikes.map(r=>[r.id,20]))};
let product:Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async()=>{product=await compileDecisionScripts(decisions,registries,new Map(decisions.map(r=>[r.source,readFileSync(`src/shards/driftwood-isle/${r.source}`,'utf8')])),{asLineCeiling:100});});
function make(){
 const row=product.rows[0],blob=product.blobs[0];if(row===undefined||blob===undefined)throw new Error('Missing compiled guest');
 const script:DecisionScript={...row,ids:generateDecisionBindings(row,registries).map.ids,reads:['nearestPlayer','distance','alive','strikeState','stunned'],lists:[]};
 return createScriptScenario(DecisionHost,{bytes:blob.bytes,script,seed:10,binding:{id:1,script:row.id,self:1,actors:[1],instance:0},actors:[{id:1,at:[0,0,0],fields:Object.fromEntries(fields.map(f=>[f.id,f.default]))}],players:[{id:99,at:[0,0,8]}]});
}
test('actual compiled guest approaches and requests one covered bite in range',()=>{
 const s=make();s.send('start');s.advance(.2);expect(s.commands().some(c=>c[0]==='move')).toBe(true);expect(s.commands().some(c=>c[0]==='strike')).toBe(false);
 s.world.setActor({id:99,at:[0,0,1.7]});s.advance(.1);expect(s.state()['stage']).toBe(1);expect(s.commands().filter(c=>c[0]==='strike')).toHaveLength(1);
});
test('denied strike, stun, recovery, death, late completion and fresh restart remain bounded',()=>{
 const s=make();s.send('start');s.world.setActor({id:99,at:[0,0,1.7]});s.advance(.1);const denied=s.world.snapshot().actors?.find(r=>r.id===1);if(denied===undefined)throw new Error('Missing actor');s.world.setActor({...denied,strikeState:0});s.advance(.4);expect(s.state()['stage']).toBe(2);
 s.send('death','enemy',99);s.send('strike.done','enemy','bite',true);s.advance(3);expect(s.state()['stage']).toBe(5);expect(s.state()['cancelled']).toBe(true);
 s.world.setActor({id:99,at:[0,0,8]});s.send('start');expect(s.state()['stage']).toBe(0);expect(s.state()['cancelled']).toBe(false);
 const actor=s.world.snapshot().actors?.find(r=>r.id===1);if(actor===undefined)throw new Error('Missing actor');
 s.world.setActor({...actor,stunned:true});s.advance(.2);expect(s.state()['stage']).toBe(2);
 s.world.setActor({...actor,stunned:false});s.world.setActor({id:99,at:[0,0,8]});s.advance(1.3);expect(s.state()['stage']).toBe(0);
});
test('complete source stays isolated and native clips opt into only the authoritative bite clock',()=>{
 const source=createBloomthroatIguanaNativePreviewSource();
 expect(source.runtime?.spawns?.actors?.map(r=>r.kind)).toEqual(['bloomthroat-iguana']);
 expect(source.quests).toEqual({flags:[],quests:[],triggers:[],dialogue:[]});expect(source.encounters).toEqual([]);expect(source.ledger).toEqual([]);
 const clips=bloomthroatIguanaNativeClips();expect(clips.strikeIds).toEqual(['strike.bloomthroat-iguana.bite']);
 expect(supportsRigidCorpseAnimation(numericCreaturePose(clips))).toBe(true);
 expect(clips.programs.every(p=>p.nodes.length<=128&&p.locals===undefined)).toBe(true);
 expect(clips.programs.flatMap(p=>p.numeric?.outputs??[]).every(o=>o.target.startsWith('joint.')&&o.target!=='joint.body'&&o.path[0]!=='scale')).toBe(true);
 const meta:unknown=JSON.parse(readFileSync('art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next/metadata.json','utf8'));
 expect(createBloomthroatIguanaNativePreviewOutput(meta).namedFiles?.map(r=>r.name)).toContain('poses/bloomthroat-iguana.json');
 expect(strikes[0]).toMatchObject({windup:.75,active:.16,recover:.9,tags:['cover.checked']});
});
