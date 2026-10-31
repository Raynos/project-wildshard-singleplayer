// oxlint-disable-next-line import/no-nodejs-modules -- Compare only actual earned native execution and independent replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the unchanged checked-in physics module.
import {readFileSync} from 'node:fs';
import {beginProductSession} from './productSession';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {decodeSimSnapshot,snapshotSimHost} from '../../../src/engine/sim/snapshot';
import {canonicalSimDigest} from '../../fake/simState';
import {createNativeProofResident} from '../headless-native';
import {installWalkRopeBodies} from './ropeBodies';
import {installNativeWalkBounds} from './nativeBounds';
import {prepareHeadlessRuntime} from '../sky-verbs';
import {SkyTape} from '../../proof/far-reach/tape';
import {ROOST_IDS} from '../../../src/shards/far-reach/generators/questPrompts';
import type {HeadlessCommand,HeadlessEffect} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeObservation,HeadlessTapeSegment} from '../../../src/sdk/headlessTape';

const started=performance.now(),session=await beginProductSession('far-reach','sky-verbs'),{product,assets}=session;
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined,releaseRopes=()=>{ /* No ropes are installed before the resident is ready. */ };
/** The existing controller's world axes enter the actual camera-relative phone stick law. */
function controls(command:HeadlessCommand):HeadlessCommand {
  if(command.kind!=='player')return command;
  const {moveX:x,moveZ:z,yaw}=command,c=Math.cos(yaw),s=Math.sin(yaw),clamp=(n:number)=>Math.max(-1,Math.min(1,n));
  return {...command,commandVersion:1,steer:{keyX:0,keyY:0,stickX:clamp(x*c-z*s),stickY:clamp(-x*s-z*c)}};
}
try{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier},prepareHeadlessRuntime);
  const active=resident,{host}=active;releaseRopes=installWalkRopeBodies(host,product);installNativeWalkBounds(host);
  const found=host.quests.find(row=>row.def.id==='far.quest');assert.ok(found);const quest=found;
  const actors=ROOST_IDS.map(id=>{const actor=host.entities.get(id);assert.ok(actor);return actor;});
  assert.ok(actors.every(actor=>actor.alive));assert.equal(host.flags.has('far.roost'),false);
  const parts:HeadlessTapeSegment[]=[];
  const controller=new SkyTape(),expected:HeadlessTapeObservation[]=[],encoder=new TextEncoder(),sim=await session.ready();
  let frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[],total=0,commandsCount=0,bytes=0,peakY=host.player.position.y,last=quest.current?.id;
  const flush=():HeadlessTapeSegment|undefined=>{
    if(frames.length===0)return undefined;
    const id=`roost-${expected.length}`,segment:HeadlessTapeSegment={id,ticks:frames.length,commands:[],frames};frames=[];
    const observation:HeadlessTapeObservation={id,tick:host.state.tick,position:host.player.position.toArray(),peakY,
      grounded:host.player.motor.snapshot().result.grounded,flags:[...host.flags.all],
      quests:host.quests.map(row=>({id:row.def.id,currentId:row.current?.id??null,started:row.snapshot().started,complete:row.isComplete})),
      effects,adapters:[]};effects=[];peakY=host.player.position.y;
    bytes+=encoder.encode(JSON.stringify(observation)).byteLength;assert.ok(bytes<=8_000_000);
    expected.push(observation);assert.ok(expected.length<=128);
    console.info(JSON.stringify({phase:'record',id,tick:host.state.tick,leg:controller.state.leg,current:quest.current?.id,
      alive:actors.filter(actor=>actor.alive).length,position:host.player.position.toArray(),milliseconds:performance.now()-started}));
    return segment;
  };
  let replayedTicks=0;
  const submit=async():Promise<void>=>{
    const segment=flush();if(segment===undefined)return;parts.push(segment);
    const replay=await sim.verbTapePart({version:1,observe:[],segments:[segment]});
    const wanted=expected.at(-1);assert.ok(wanted);
    assert.deepEqual(replay.report.observations,[wanted],'fresh inputs retain every boundary, feet, quest, peak and effect');
    assert.equal(canonicalSimDigest(decodeSimSnapshot(replay.commit.snapshot)),canonicalSimDigest(snapshotSimHost(host)),
      'each complete fresh-worker native continuation is exact');
    replayedTicks+=replay.report.ticks;
  };
  while(total<30_000&&!host.flags.has('far.roost')){
    const commands=structuredClone(controller.next(host).map(controls));commandsCount+=commands.length;assert.ok(commandsCount<=60_000);
    active.step(commands);total++;frames.push(commands);effects.push(...structuredClone(active.effects));
    peakY=Math.max(peakY,host.player.position.y);
    if(frames.length===512||quest.current?.id!==last){last=quest.current?.id;await submit();}
  }
  await submit();
  assert.ok(host.flags.has('far.notes'),'actual keeper talk earns the introduction');
  assert.ok(host.flags.has('far.roost'),'the real fan must clear all roost rays');
  assert.ok(actors.every(actor=>!actor.alive),'the quest cannot clear a live roost');
  assert.equal(quest.current?.id,'vanes');assert.equal(quest.isComplete,false);
  assert.equal(host.player.motor.snapshot().result.grounded,true,'the completed fan fight ends on the actual roost deck');
  for(const flag of ['far.vanes','far.bridge','far.complete','far.roc.down'])assert.equal(host.flags.has(flag),false,flag);
  assert.equal(replayedTicks,total);
  assert.equal(sim.quarantined,false);
  const negativeSession=await beginProductSession('far-reach','sky-verbs');
  let removedSwings=0;
  try{
    const negative=await negativeSession.ready();
    for(const part of parts){
      const unarmed=part.frames?.map(frame=>frame.map(command=>{
        if(command.kind!=='player'||command.attack===undefined)return command;
        const rest={...command};delete rest.attack;removedSwings++;return rest;
      }));assert.ok(unarmed);
      const replay=await negative.verbTapePart({version:1,observe:[],segments:[{...part,frames:unarmed}]});
      const observed=replay.report.observations[0];assert.ok(observed);
      assert.equal(observed.flags.includes('far.roost'),false,'identical movement without swings cannot earn the roost');
      const saved=decodeSimSnapshot(replay.commit.snapshot);
      for(const id of ROOST_IDS){const actor=saved.entities.find(row=>row.id===id);assert.ok(actor);assert.equal(actor.state.flags.alive,true);}
    }
    assert.ok(removedSwings>0);assert.equal(negative.quarantined,false);
  }finally{await(await negativeSession.ready()).dispose();}
  console.info(JSON.stringify({phase:'replayed',story:'sky-roost',ticks:total,commands:commandsCount,parts:expected.length,removedSwings,
    flags:[...host.flags.all],milliseconds:performance.now()-started}));
}catch(error){console.error(JSON.stringify({phase:'failed',tick:resident?.host.state.tick,error:error instanceof Error?error.message:String(error)}));throw error;}
finally{releaseRopes();resident?.dispose();await(await session.ready()).dispose();}
