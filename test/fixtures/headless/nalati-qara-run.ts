// oxlint-disable-next-line import/no-nodejs-modules -- Assert only earned native combat and independent replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the named product and unchanged repository physics bytes.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {Vector3} from 'three';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {canonicalSimDigest} from '../../fake/simState';
import {decodeSimSnapshot,snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {HeldBowFileSchema} from '../../../src/format/weaponProfiles';
import {parseHeldSlots} from '../../../src/format/heldArms';
import {heldBowBase} from '../../../src/game/weapons/heldBowBase';
import {bowLaunchSpeed} from '../../../src/engine/combat/bowLaw';
import {runTrustedHeadlessTape,type HeadlessTapeObservation,type HeadlessTapeSegment} from '../../../src/sdk/headlessTape';
import type {HeadlessCommand,HeadlessEffect,HeadlessTickCommit} from '../../../src/sdk/tickProtocol';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime,nalatiQaraOf} from '../nalati-qara-native';
import {nalatiPatrolOf} from '../nalati-patrol-native';
import {beginProductSession} from './productSession';

const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
const descriptor=outputDescriptor(shard);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const resident=await createNativeProofResident({shard,assets,rapier,product},prepareHeadlessRuntime);
let session:Awaited<ReturnType<typeof beginProductSession>>|undefined;
let replay:Awaited<ReturnType<Awaited<ReturnType<typeof beginProductSession>>['ready']>>|undefined;
let failed=false;
const dispose=async():Promise<void>=>{resident.dispose();const worker=replay??await session?.ready();await worker?.dispose();};
try{
  const host=resident.host,patrol=nalatiPatrolOf(host),qara=nalatiQaraOf(host);assert.ok(patrol);assert.ok(qara);
  assert.equal(patrol.law.riders.length,0);assert.equal(patrol.readiness.eligible,false);assert.equal(qara.captain(),null);
  const idle:HeadlessCommand[]=[{kind:'player',moveX:0,moveZ:0,yaw:0,commandVersion:1,crouch:true,steer:{keyX:0,keyY:0,stickX:0,stickY:0}}];
  runTrustedHeadlessTape(host,commands=>resident.step(commands),()=>resident.effects,{version:1,observe:[],segments:[{
    id:'camp-road',ticks:3600,commands:[],route:[{x:0,z:216},{x:20,z:216},{x:40,z:218},{x:60,z:214}],
  }]});
  for(let tick=0;tick<60_000&&patrol.law.riders.length===0;tick++){
    resident.step(idle);assert.equal(host.player.health.alive,true);assert.equal(patrol.readiness.eligible,false);assert.equal(qara.captain(),null);
  }
  assert.ok(patrol.law.riders.length>0);assert.equal(host.dayClock?.dayPhase,'night');assert.equal(patrol.law.killsTonight,0);
  const nightTick=host.state.tick,checkpoint=serializeSimSnapshot(snapshotSimHost(host));
  session=await beginProductSession('nalati-grasslands','nalati-qara',checkpoint);
  const source=v.parse(HeldBowFileSchema,await product.json('weapons/bow-page.json')),bow=heldBowBase({bow:source.bow,base:source.base});
  const head=new Vector3(),observed=['nalati.patrol','nalati.qara','nalati.weapons'];
  const segments:HeadlessTapeSegment[]=[];
  const ready=session.ready();
  let flight:Promise<{ok:true}|{ok:false;error:unknown}>|undefined,final:HeadlessTickCommit|undefined;
  const settle=async():Promise<void>=>{if(flight===undefined)return;const result=await flight;if(!result.ok)throw result.error;};
  let frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[],ticks=0,peakY=host.player.position.y;
  const motion=new Map<string,{x:number;z:number;vx:number;vz:number}>();
  for(const rider of patrol.law.riders)motion.set(rider.a.entityId,{x:rider.a.position.x,z:rider.a.position.z,vx:0,vz:0});
  const flush=async(id:string):Promise<void>=>{
    if(frames.length===0)return;
    // A terminal observation must not step the owner again. The empty tape
    // segment is not used: observe through the actual final captured tick.
    segments.push({id,ticks:frames.length,commands:[],frames});
    const expected:HeadlessTapeObservation={id,tick:host.state.tick,position:host.player.position.toArray(),peakY,grounded:host.player.motor.snapshot().result.grounded,
      flags:[...host.flags.all],quests:host.quests.map(quest=>({id:quest.def.id,currentId:quest.current?.id??null,started:quest.snapshot().started,complete:quest.isComplete})),
      effects,adapters:observed.map(identity=>{const adapter=host.adapters.get(identity);assert.ok(adapter);const state=adapter.snapshot();assert.equal(typeof state,'string');
        if(typeof state!=='string')throw new Error('Missing native fight observation');return {id:identity,state};})};
    const segment=segments.at(-1);assert.ok(segment);
    frames=[];effects=[];peakY=host.player.position.y;
    // Keep one checked request in flight while the recorder produces only its
    // next bounded part. Neither owner skips a tick or resets a tape budget.
    await settle();
    flight=(async()=>{try{
      const worker=await ready;replay=worker;
      const repeated=await worker.verbTapePart({version:1,observe:observed,segments:[segment]});
      assert.equal(repeated.report.observations.length,1);
      assert.deepEqual(repeated.report.observations[0],expected,'fresh worker must reproduce all native observations and ordered effects');
      final=repeated.commit;return {ok:true as const};
    }catch(error){return {ok:false as const,error};}})();
  };
  const step=async(commands:readonly HeadlessCommand[]):Promise<void>=>{
    frames.push(structuredClone([...commands]));resident.step(commands);effects.push(...resident.effects);ticks++;peakY=Math.max(peakY,host.player.position.y);
    for(const rider of patrol.law.riders){
      const p=rider.a.position,old=motion.get(rider.a.entityId);
      motion.set(rider.a.entityId,{x:p.x,z:p.z,vx:old===undefined?0:(p.x-old.x)*60,vz:old===undefined?0:(p.z-old.z)*60});
    }
    assert.equal(host.player.health.alive,true,'ordinary combat must keep the player alive');assert.ok(ticks<=60_000,'one fight retains the original tape tick budget');
    if(frames.length===512)await flush(`fight-${segments.length}`);
  };
  const nearest=()=>patrol.law.riders.filter(row=>row.a.alive&&!row.a.hidden&&row.a!==qara.captain())
    .sort((a,b)=>a.a.position.distanceToSquared(host.player.position)-b.a.position.distanceToSquared(host.player.position))[0]?.a;
  const approach=async(captain:boolean):Promise<void>=>{
    const target=captain?qara.captain():patrol.law.riders.find(row=>row.a.alive&&!row.a.hidden&&row.a!==qara.captain())?.a;
    assert.ok(target,'the approach must select a real living body');
    if(!host.playerBoard.on)await step([{kind:'player',moveX:0,moveZ:0,yaw:0,hover:true}]);
    let arrived=false;
    for(let tick=0;tick<3600;tick++){
      if(!target.alive)break;
      const p=host.player.position,dx=target.position.x-p.x,dz=target.position.z-p.z,d=Math.hypot(dx,dz);
      if(d<20){arrived=true;break;}
      await step([{kind:'player',moveX:dx/d,moveZ:dz/d,yaw:Math.atan2(-dx,-dz),...(tick%90===60?{jump:true}:{})}]);
    }
    if(host.playerBoard.on)await step([{kind:'player',moveX:0,moveZ:0,yaw:0,hover:true}]);
    for(let tick=0;tick<90;tick++)await step(idle);
    assert.ok(arrived,'actual hover inputs must approach the live target');
  };
  const aim=(held:boolean,captain:boolean):HeadlessCommand[]=>{
    const target=captain?qara.captain():nearest();if(target===undefined||target===null)return idle;
    const feet=host.player.position;patrol.aimPoint(target,head);
    const time=Math.hypot(head.x-feet.x,head.z-feet.z)/bowLaunchSpeed(bow.base,1);
    const velocity=motion.get(target.entityId);
    head.x+=(velocity?.vx??0)*time;head.z+=(velocity?.vz??0)*time;head.y+=.5*bow.rows.arrow.gravity*time*time;
    const dx=head.x-feet.x,dz=head.z-feet.z;
    return [{kind:'player',moveX:0,moveZ:0,yaw:Math.atan2(-dx,-dz),commandVersion:1,steer:{keyX:0,keyY:0,stickX:0,stickY:0},...(held?{heavy:{}}:{})},
      {kind:'script',actorId:'nalati.weapon.aim',value:1},{kind:'script',actorId:'nalati.weapon.pitch',value:Math.atan2(head.y-feet.y-1.68,Math.hypot(dx,dz))}];
  };
  const hold=Math.ceil((bow.base.draw?.drawTime??.75)*60)+15;
  const weaponState=()=>{
    const owner=host.adapters.get('nalati.weapons');assert.ok(owner);
    const saved=owner.snapshot();assert.equal(typeof saved,'string');if(typeof saved!=='string')throw new Error('Missing actual weapon observation');
    return v.parse(v.object({slot:v.string(),bolts:v.number(),blade:v.object({contacts:v.number()})}),JSON.parse(saved));
  };
  for(let shot=0;shot<bow.base.quiver&&patrol.law.killsTonight<5;shot++){
    if(nearest()===undefined){for(let tick=0;tick<4200&&nearest()===undefined;tick++)await step(idle);}
    const target=nearest();assert.ok(target,'the next ordinary patrol must materialize its own riders');
    if(target.position.distanceTo(host.player.position)>60)await approach(false);
    for(let tick=0;tick<hold;tick++)await step(aim(true,false));await step(aim(false,false));for(let tick=0;tick<75;tick++)await step(idle);
    console.error(JSON.stringify({stage:'rider-shot',shot,kills:patrol.law.killsTonight,tick:host.state.tick,feet:host.player.position.toArray(),
      riders:patrol.law.riders.map(row=>({id:row.a.entityId,hp:row.a.hp,distance:row.a.position.distanceTo(host.player.position)}))}));
  }
  assert.ok(patrol.law.killsTonight>=5,'five actual rider deaths must open the gate');
  for(let tick=0;tick<12;tick++)await step(idle);
  assert.equal(patrol.readiness.eligible,true);const captain=qara.captain();assert.ok(captain?.alive,'the original lair must spawn its own eligible captain');
  await approach(true);
  for(let shot=0;shot<bow.base.quiver&&captain.alive;shot++){
    if(weaponState().bolts===0)break;
    for(let tick=0;tick<hold;tick++)await step(aim(true,true));await step(aim(false,true));for(let tick=0;tick<75;tick++)await step(idle);
    console.error(JSON.stringify({stage:'captain-shot',shot,hp:qara.captain()?.hp,tick:host.state.tick}));
  }
  if(captain.alive){
    const slots=parseHeldSlots(await product.json('held/slots.json')),blade=slots.slots.find(row=>row.kind==='blade');assert.ok(blade);
    for(let swaps=0;swaps<slots.registration.length&&weaponState().slot!==blade.id;swaps++)
      await step([...idle,{kind:'script',actorId:'nalati.weapon.swap',value:1}]);
    assert.equal(weaponState().slot,blade.id,'empty arrows require a real weapon swap, not an ammo grant');
    for(let tick=0;tick<3600&&captain.alive;tick++){
      const p=host.player.position,dx=captain.position.x-p.x,dz=captain.position.z-p.z,d=Math.max(.01,Math.hypot(dx,dz));
      patrol.aimPoint(captain,head);
      // Version-one movement is the real local stick, resolved against this
      // facing. World move fields cannot substitute for a released stick.
      await step([{kind:'player',moveX:0,moveZ:0,yaw:Math.atan2(-dx,-dz),commandVersion:1,
        steer:{keyX:0,keyY:0,stickX:d>2?0:.3,stickY:d>2?1:0}},
        {kind:'script',actorId:'nalati.weapon.pitch',value:Math.atan2(head.y-p.y-1.68,d)},
        ...(tick%24===0?[{kind:'script' as const,actorId:'nalati.weapon.attack',value:1}]:[])]);
      if(tick%120===0)console.error(JSON.stringify({stage:'captain-sabre',hp:captain.hp,health:host.player.health.attributes.health,
        distance:d,tick:host.state.tick,weapon:weaponState()}));
    }
  }
  await step(idle);assert.equal(captain.alive,false,'actual weapon contacts must fell Qara');
  assert.equal(qara.core.entry('qara-batyr')?.phase2,true,'real damage must enter the original second phase');
  const owner=host.adapters.get('nalati.qara');assert.ok(owner);const state=owner.snapshot();assert.equal(typeof state,'string');
  if(typeof state!=='string')throw new Error('Missing complete captain observation');
  const fight=v.parse(v.object({supports:v.number(),signatures:v.number()}),JSON.parse(state));
  assert.ok(fight.supports>=3,'actual engagement must call the original support line');
  assert.ok(fight.signatures>0,'the admitted charge must execute its signature');
  assert.equal(qara.core.record('qara-batyr')?.kills,1);assert.equal(qara.core.entry('qara-batyr')?.state,'dead');
  await flush('qara-felled');await settle();
  assert.ok(final);
  assert.equal(canonicalSimDigest(decodeSimSnapshot(final.snapshot)),canonicalSimDigest(snapshotSimHost(host)),
    'the complete native fight retains its final canonical continuation');
  assert.ok(replay);
  assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:'nalati-qara-full-fight',nightTick,kills:patrol.law.killsTonight,ticks,segments:segments.length}));
}catch(error){failed=true;throw error;}finally{
  if(failed){try{await dispose();}catch(error){console.error('Secondary native worker cleanup failure',error);}}
  else await dispose();
}

