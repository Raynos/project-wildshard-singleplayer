// oxlint-disable-next-line import/no-nodejs-modules -- The native proof checks real arrival and independent replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the original native physics bytes.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {beginProductSession} from './productSession';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-world-verbs';
import {ChapterViewSchema} from '../../../src/format/questPageComposition';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {runTrustedHeadlessTape,type HeadlessTapeSegment} from '../../../src/sdk/headlessTape';
import {PhysicsRouteCursor} from '../../../src/sdk/headlessJourney';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';

const session=await beginProductSession('nalati-grasslands','nalati-world');
let first:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
try{
  const product=session.product,shard=product.shardfile;
  const rows=v.parse(ChapterViewSchema,await product.json('quests/content.json')).places;
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  first=await createNativeProofResident({shard,assets:session.assets,rapier,product},prepareHeadlessRuntime);
  const active=first,{host}=active,frames:HeadlessCommand[][]=[];
  const arrived=new Map<string,{tick:number;position:number[]}>(),notices=new Map<string,number>();
  const step=(commands:readonly HeadlessCommand[]):void=>{
    assert.ok(frames.length<60_000,'outdoor discoveries keep the original finite native tape allowance');
    const input=commands.map(command=>{
      if(command.kind!=='player'||command.commandVersion===1)return command;
      const c=Math.cos(command.yaw),s=Math.sin(command.yaw),clamp=(n:number)=>Math.max(-1,Math.min(1,n));
      return {...command,commandVersion:1 as const,steer:{keyX:0,keyY:0,
        stickX:clamp(command.moveX*c-command.moveZ*s),stickY:clamp(-command.moveX*s-command.moveZ*c)}};
    });
    frames.push(structuredClone(input));active.step(input);
    assert.equal(host.player.health.alive,true,'discovery input must keep the real traveller alive');
    const p=host.player.position;
    for(const row of rows)if(host.flags.has(`seen:${row.id}`)&&!arrived.has(row.id)){
      assert.ok((p.x-row.x)**2+(p.z-row.z)**2<row.r**2,`only actual arrival discovers ${row.id}`);
      arrived.set(row.id,{tick:frames.length,position:p.toArray()});
    }
    for(const effect of active.effects){
      assert.equal(effect.kind,'hint','discovery cannot grant quest facts, inventory or damage');
      if(effect.kind==='hint')notices.set(effect.text,(notices.get(effect.text)??0)+1);
    }
  };
  step([]);
  assert.equal(arrived.size,0,'the entry cannot pre-discover distant places');
  // First walk the real camp road, then use the player's own hover toggle.
  // The board's motor still resolves every wall, trunk and jump. Discovery
  // requires actual feet inside each circle regardless of locomotion mode.
  runTrustedHeadlessTape(host,step,()=>active.effects,{version:1,observe:[],segments:[
    {id:'camp-road',ticks:3600,commands:[],route:[{x:0,z:216},{x:20,z:216},{x:40,z:218},{x:60,z:214}]},
  ]});
  step([{kind:'player',moveX:0,moveZ:0,yaw:0,commandVersion:1,hover:true,
    steer:{keyX:0,keyY:0,stickX:0,stickY:0}}]);
  for(let tick=0;tick<30;tick++)step([]);
  assert.equal(host.playerBoard.on,true,'the ordinary input must engage the real board');
  const discover=(place:typeof rows[number]):void=>{
    if(arrived.has(place.id))return;
    // A board carries momentum between inputs. Release the stick through its
    // real coasting law before starting the next route's progress window.
    for(let tick=0;tick<600&&Math.hypot(host.boardVelocity.x,host.boardVelocity.z)>.1;tick++)step([]);
    assert.ok(Math.hypot(host.boardVelocity.x,host.boardVelocity.z)<=.1,'ordinary released input must brake the board');
    if(arrived.has(place.id))return;
    const origin=host.player.position,distance=Math.hypot(place.x-origin.x,place.z-origin.z);
    const points=[{x:origin.x,z:origin.z},{x:place.x,z:place.z}];
    try{
      const cursor=new PhysicsRouteCursor(points,{once:true}),limit=Math.min(18_000,Math.max(1200,Math.ceil(distance*90)));
      const previous=host.player.position.clone();let stopped=0;
      for(let tick=0;tick<limit&&!arrived.has(place.id);tick++){
        const p=host.player.position,command=cursor.command([p.x,p.y,p.z],tick);
        assert.equal(cursor.stuck.length,0,'the unchanged native route must progress until actual discovery');
        if(cursor.complete)break;
        stopped=p.distanceToSquared(previous)<.0004?stopped+1:0;previous.copy(p);
        const jump=stopped>=45&&stopped%30===15;
        step([jump?{...command,jump:true}:command]);
      }
    }catch(error){throw new Error(`Native discovery approach ${place.id} at ${JSON.stringify({feet:host.player.position,board:host.playerBoard,velocity:host.boardVelocity,ground:host.groundHeightAt(host.player.position.x,host.player.position.z),motor:host.player.motor.snapshot().result})} via ${JSON.stringify(points)}`,{cause:error});}
    step([]);assert.ok(arrived.has(place.id),`the real approach must discover ${place.id}`);
    console.error(JSON.stringify({place:place.id,tick:frames.length,at:host.player.position}));
  }
  // Visit the pasture along the north bank before touring the plateau.
  const pasture=rows.find(row=>row.id==='sheep-pasture');assert.ok(pasture);discover(pasture);
  while(arrived.size<rows.length){
    const pending=rows.filter(row=>!arrived.has(row.id)).sort((a,b)=>
      Math.hypot(a.x-host.player.position.x,a.z-host.player.position.z)-Math.hypot(b.x-host.player.position.x,b.z-host.player.position.z));
    const place=pending[0];assert.ok(place);discover(place);
  }
  for(const row of rows)assert.equal(notices.get(`Discovered · ${row.label}`)??0,row.quiet===true?0:1,`one original notice for ${row.id}`);
  assert.equal(host.quests.some(quest=>quest.isComplete),false);
  const replay=await session.ready();
  try{
    // Stream finite original input parts without changing any child watchdog.
    const parts=function* parts():Generator<HeadlessTapeSegment,void> {
      for(let offset=0;offset<frames.length;offset+=600){
        const chunk=frames.slice(offset,offset+600);
        yield {id:`discovery-part-${offset/600}`,ticks:chunk.length,commands:[],frames:chunk};
      }
    }
    const iterator=parts();
    const reports=await replay.streamVerbTape(['nalati.world'],{[Symbol.asyncIterator]:()=>({next:()=>Promise.resolve(iterator.next())})});
    const end=reports.observations.at(-1);assert.ok(end);
    assert.equal(end.tick,host.state.tick,'replay commits every original movement tick');
    assert.deepEqual(end.position,host.player.position.toArray(),'replay retains the exact final native feet');
    assert.deepEqual(end.flags,[...host.flags.all],'fresh native input replay preserves every earned discovery');
    const owner=host.adapters.get('nalati.world'),observed=end.adapters.find(row=>row.id==='nalati.world');
    assert.ok(owner);assert.ok(observed);
    assert.equal(observed.state,owner.snapshot(),'replay retains the actual motor, water and discovery observations');
    assert.equal(replay.quarantined,false);
    console.info(JSON.stringify({story:'nalati-discoveries',ticks:frames.length,places:[...arrived.keys()],notices:[...notices]}));
  }finally{await replay.dispose();}
}catch(error){const ready=await session.ready().then(sim=>({sim}),()=>null);if(ready!==null)await ready.sim.dispose();throw error;}
finally{first?.dispose();}
