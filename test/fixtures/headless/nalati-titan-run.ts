// oxlint-disable-next-line import/no-nodejs-modules -- Assert only actual input outcomes and independent native replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the admitted named product and shipped physics binary.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {productHeadlessSections} from '../../../src/sdk/headlessSections';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,serializeSimSnapshot,decodeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {canonicalSimDigest} from '../../fake/simState';
import {createNativeProofResident} from '../headless-native';
import {createNativeProofWorker} from '../headless-worker';
import {prepareHeadlessRuntime,nalatiTitanOf} from '../nalati-titan-native';
import {readArenaScriptData} from '../../../src/game/boss/openArenaFight';
import {questObservation} from '../../../src/game/quest/questObservation';
import {parseChapterStoryPresentation} from '../../../src/format/questStory';
import {reachTitanCairn} from '../../proof/nalati-grasslands/titanTravel';
import {titanBowPilot,titanRidersPilot} from '../../proof/nalati-grasslands/titanCombat';
import {checkedReplayPipeline} from './checkedReplayPipeline';
import type {HeadlessTapeObservation,HeadlessTapeSegment} from '../../../src/sdk/headlessTape';
import type {HeadlessCommand,HeadlessEffect} from '../../../src/sdk/tickProtocol';

const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
const descriptor=outputDescriptor(shard);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const resident=await createNativeProofResident({product,shard,assets,rapier},prepareHeadlessRuntime);
type Replay=Awaited<ReturnType<typeof createNativeProofWorker>>;
let pending:Promise<{ok:true;worker:Replay}|{ok:false;error:unknown}>|undefined,replay:Replay|undefined;
let pipeline:ReturnType<typeof checkedReplayPipeline<Part>>|undefined;
interface Part {readonly segment:HeadlessTapeSegment;readonly expected:HeadlessTapeObservation;readonly digest:string}
const started=performance.now();
try{
  const {host}=resident,titan=nalatiTitanOf(host);assert.ok(titan);
  const rows=await readArenaScriptData(product,{fight:'combat/titan-fight.json',geometry:'combat/titan-geometry.json'});
  const initial=titan.records.bosses.read()[rows.definition.id];
  assert.equal(initial?.defeated??false,false);assert.equal(initial?.rewardTaken??false,false);
  const deaths:{tick:number;phase:number;checkpoint:boolean}[]=[];
  host.events.on('player.died',event=>{deaths.push({tick:host.state.tick,phase:titan.fight.phase,checkpoint:event.checkpoint});},host.scope);
  const observed=['nalati.titan','nalati.weapons','nalati.chapter-records'];
  let captureTicks=0,checkpointTick=0,partTicks=0,partNumber=0,replayedTicks=0,replayMs=0,peakY=host.player.position.y;
  let frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[];
  const flush=async():Promise<void>=>{
    if(frames.length===0)return;assert.ok(pipeline);
    const id=`titan-${partNumber++}`,p=host.player.position;
    const expected:HeadlessTapeObservation={id,tick:host.state.tick,position:[p.x,p.y,p.z],peakY,grounded:host.player.motor.snapshot().result.grounded,
      flags:[...host.flags.all],quests:host.quests.map(quest=>({id:quest.def.id,currentId:quest.current?.id??null,started:quest.snapshot().started,complete:quest.isComplete})),effects,
      adapters:observed.map(identity=>{const owner=host.adapters.get(identity);assert.ok(owner);const state=owner.snapshot();assert.equal(typeof state,'string');
        if(typeof state!=='string')throw new Error('Missing native Titan observation');return {id:identity,state};})};
    const part:Part={segment:{id,ticks:frames.length,commands:[],frames},expected,digest:canonicalSimDigest(snapshotSimHost(host))};
    frames=[];effects=[];peakY=p.y;await pipeline.offer(part);
  };
  const step=async(commands:readonly HeadlessCommand[]):Promise<void>=>{
    pipeline?.check();assert.ok(captureTicks++<89_400,'the real entry and fight retain a finite input prefix');
    const actual=commands.map(command=>{
      if(command.kind!=='player'||command.commandVersion===1)return command;
      const c=Math.cos(command.yaw),s=Math.sin(command.yaw),clamp=(n:number):number=>Math.max(-1,Math.min(1,n));
      return {...command,commandVersion:1 as const,steer:{keyX:0,keyY:0,stickX:clamp(command.moveX*c-command.moveZ*s),stickY:clamp(-command.moveX*s-command.moveZ*c)}};
    });
    resident.step(actual);
    if(pipeline!==undefined){frames.push(structuredClone(actual));effects.push(...structuredClone(resident.effects));partTicks++;peakY=Math.max(peakY,host.player.position.y);
      if(frames.length===512)await flush();}
  };
  await reachTitanCairn(host,step);
  assert.equal(deaths.length,0,'the entry and borrowed-horse route must be earned without a checkpoint teleport');
  const checkpoint=snapshotSimHost(host),checkpointDigest=canonicalSimDigest(checkpoint);checkpointTick=host.state.tick;peakY=host.player.position.y;
  pending=(async()=>{try{return {ok:true as const,worker:await createNativeProofWorker(shard,assets,'nalati-titan',serializeSimSnapshot(checkpoint),productHeadlessSections(product),directory)};}
    catch(error){return {ok:false as const,error};}})();
  const ready=pending;
  pipeline=checkedReplayPipeline<Part>(async part=>{
    const result=await ready;if(!result.ok)throw result.error;replay=result.worker;
    if(replayedTicks===0){assert.ok(replay.checkpoint);assert.equal(canonicalSimDigest(replay.checkpoint.snapshot),checkpointDigest,'fresh worker restores the physically earned storm checkpoint');}
    const then=performance.now(),actual=await replay.verbTapePart({version:1,observe:observed,segments:[part.segment]});replayMs+=performance.now()-then;
    assert.deepEqual(actual.report.observations,[part.expected],'every real input part reproduces all ordered outcomes');
    assert.equal(canonicalSimDigest(decodeSimSnapshot(actual.commit.snapshot)),part.digest,'every checked part reproduces the complete current native save');
    replayedTicks+=actual.report.ticks;
  });
  await step([{kind:'script',actorId:'nalati.titan.use',value:1}]);assert.equal(titan.fight.tied,true);
  await titanBowPilot(product,host,step,1);
  await titanRidersPilot(product,host,step);
  await titanBowPilot(product,host,step,2);
  await titanBowPilot(product,host,step,3);
  for(let tick=0;tick<120;tick++)await step([]);
  assert.equal(titan.boss.state,'victory');assert.equal(titan.fight.dead,true);assert.equal(titan.fight.hp,0);
  assert.equal(titan.fight.tied,false,'the real arena clear must release the storm tie');
  assert.equal(titan.locked(),false);assert.equal(host.playerMoveScale,1);
  assert.ok(deaths.length>0,'the tape must exercise the real phase checkpoint, remount and refill');
  assert.ok(deaths.every(event=>event.checkpoint&&event.phase===2),'retry must retain the earned final phase');
  const saved=titan.records.bosses.read()[rows.definition.id];assert.ok(saved);
  assert.equal(saved.defeated,true);assert.equal(saved.kills,(initial?.kills??0)+1);assert.equal(saved.rewardTaken,false);
  const reward=titan.rewardPrompt();assert.ok(reward);assert.equal(reward.label,rows.reward.prompt);
  assert.ok(reward.position.toArray().every(Number.isFinite));assert.equal(titan.reward(),true);
  const presentation=parseChapterStoryPresentation(await product.json('quests/chapters.json'));
  const sources=Object.values(presentation.decision?.observations??{}).map(row=>row.source)
    .filter(ref=>'saved'in ref&&ref.saved.record==='bosses'&&ref.saved.id===rows.definition.id);
  assert.ok(sources.length>0);
  for(const source of sources){assert.ok('saved'in source);
    assert.equal(questObservation(source,{flags:()=>host.flags,quest:()=>{throw new Error('No quest read was requested');},
      active:()=>{throw new Error('No chapter read was requested');},saved:()=>titan.records}),Number(saved[source.saved.field]));}
  const readout=host.adapters.get('nalati.titan');assert.ok(readout);
  const readoutWire=readout.snapshot();assert.equal(typeof readoutWire,'string');if(typeof readoutWire!=='string')throw new Error('Missing actual Titan readouts');
  const text=v.parse(v.object({toasts:v.array(v.string()),feeds:v.array(v.string())}),JSON.parse(readoutWire));
  assert.ok(text.feeds.includes(rows.lines.grassFire),'the actual fire phase must publish its authored feed instruction');
  assert.equal(host.flags.has('tamed:horse'),false,'a borrowed camp horse cannot grant the taming chapter');
  await flush();await pipeline.finish();assert.equal(replayedTicks,partTicks);assert.ok(replay);assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:'titan',ticks:captureTicks,checkpointTick,replayedTicks,parts:partNumber,deaths,ms:performance.now()-started,replayMs}));
}finally{
  resident.dispose();await pipeline?.stop();
  const result=await pending;if(result?.ok)await result.worker.dispose();
}
