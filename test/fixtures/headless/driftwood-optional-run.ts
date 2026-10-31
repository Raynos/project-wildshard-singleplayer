// oxlint-disable-next-line import/no-nodejs-modules -- Only actual native input and independent replay are compared.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The existing checked-in native physics binary is immutable input.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {beginProductSession} from './productSession';
import {createNativeProofResident} from '../headless-native';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,decodeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {physicsState} from '../../fake/simState';
import {installWalkRopeBodies} from './ropeBodies';
import {installNativeWalkBounds} from './nativeBounds';
import {prepareHeadlessRuntime} from '../../proof/driftwood-isle/worker';
import {DRIFTWOOD_SPOTS} from '../../../src/shards/driftwood-isle/generators/spots';
import {readNativeQuestSpots} from '../native-hosts/quest/nativeComposition';
import policy from '../../../src/shards/driftwood-isle/data/nativeQuest.json' with {type:'json'};
import type {HeadlessCommand,HeadlessEffect} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeObservation,HeadlessTapeSegment} from '../../../src/sdk/headlessTape';

const started=performance.now(),session=await beginProductSession('driftwood-isle','driftwood'),{product,assets}=session;
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined,releaseRopes=()=>{ /* No rope owner before installation. */ };
try{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier},prepareHeadlessRuntime);
  const active=resident,{host}=active,sim=await session.ready();releaseRopes=installWalkRopeBodies(host,product);installNativeWalkBounds(host);
  const spots=readNativeQuestSpots(DRIFTWOOD_SPOTS),index=spots.rows.findIndex(row=>row.id==='vista-bench'),bench=spots.rows[index];assert.ok(bench);
  const use:HeadlessCommand={kind:'script',actorId:policy.actor,value:policy.actions.row+index};
  const schema=v.object({counts:v.record(v.string(),v.number())});
  const counts=()=>v.parse(schema,host.adapters.get(policy.step)?.snapshot()).counts;
  const parts:HeadlessTapeSegment[]=[],observations:HeadlessTapeObservation[]=[],encoder=new TextEncoder();
  let frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[],peakY=host.player.position.y,ticks=0,commandsCount=0,bytes=0;
  const flush=async(id:string):Promise<void>=>{
    if(frames.length===0)return;
    const segment:HeadlessTapeSegment={id,ticks:frames.length,commands:[],frames};frames=[];parts.push(segment);
    const wanted:HeadlessTapeObservation={id,tick:host.state.tick,position:host.player.position.toArray(),peakY,
      grounded:host.player.motor.snapshot().result.grounded,flags:[...host.flags.all],
      quests:host.quests.map(row=>({id:row.def.id,currentId:row.current?.id??null,started:row.snapshot().started,complete:row.isComplete})),effects,adapters:[]};
    effects=[];peakY=host.player.position.y;observations.push(wanted);
    bytes+=encoder.encode(JSON.stringify(wanted)).byteLength;assert.ok(bytes<=8_000_000);assert.ok(parts.length<=128);
    const replay=await sim.verbTapePart({version:1,observe:[],segments:[segment]});
    assert.deepEqual(replay.report.observations,[wanted],'fresh inputs preserve every boundary observation and effect');
    const {physics:actualPhysics,...actual}=decodeSimSnapshot(replay.commit.snapshot),{physics:expectedPhysics,...expected}=snapshotSimHost(host);
    assert.deepEqual(actual,expected,'every native continuation field is exact');
    assert.deepEqual(physicsState(actualPhysics),physicsState(expectedPhysics),'every native physics value is exact');
  };
  const step=async(commands:HeadlessCommand[]):Promise<void>=>{
    ticks++;commandsCount+=commands.length;assert.ok(ticks<=30_000&&commandsCount<=60_000);
    active.step(commands);frames.push(structuredClone(commands));effects.push(...structuredClone(active.effects));peakY=Math.max(peakY,host.player.position.y);
    if(frames.length===512)await flush(`walk-${parts.length}`);
  };
  const wait=async(n:number)=>{for(let i=0;i<n;i++)await step([]);};
  const go=async(x:number,z:number):Promise<void>=>{
    for(let i=0;i<3600;i++){
      const p=host.player.position,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.25)return;
      const k=Math.min(1,d/.8)/Math.max(.01,d);await step([{kind:'player',moveX:dx*k,moveZ:dz*k,yaw:Math.atan2(-dx,-dz)}]);
    }
    throw new Error(`Optional Driftwood walk stuck at ${JSON.stringify(host.player.position.toArray())} toward ${x},${z}`);
  };
  await step([use]);await flush('bench-out-of-reach');assert.equal(host.flags.has('used:vista-bench'),false);
  for(const [x,z] of [[0,-186.5],[-8,-172],[-17,-161],[-20,-150],[-20,-146]] as const)await go(x,z);
  await flush('glass-1');assert.ok(host.flags.has('glass:1'));assert.equal(counts()['glass'],1);
  await wait(120);await flush('glass-1-repeat');assert.equal(counts()['glass'],1);
  for(const [x,z] of [[-30,-142],[-30,-130],[-30,-126]] as const)await go(x,z);
  await flush('glass-2');assert.ok(host.flags.has('glass:2'));assert.equal(counts()['glass'],2);
  for(const [x,z] of [[-30,-118],[-30,-106],[-30,-104],[bench.x,bench.z+1]] as const)await go(x,z);
  await flush('bench-in-reach');assert.equal(host.flags.has('used:vista-bench'),false);
  await step([use]);await flush('bench-use');assert.ok(host.flags.has('used:vista-bench'));assert.equal(counts()['vista'],1);
  await wait(60);await step([use]);await flush('bench-repeat');assert.equal(counts()['vista'],1);assert.equal(counts()['glass'],2);
  for(const flag of ['talked:castaway','has:flint','quest:driftwood-done','open:reef-treasure'])assert.equal(host.flags.has(flag),false,flag);
  assert.equal(host.quests.some(row=>row.isComplete),false);assert.equal(sim.quarantined,false);
  const earned=observations.flatMap(row=>row.effects);
  assert.equal(earned.filter(effect=>effect.kind==='fact'&&effect.name==='driftwood.glass').length,2);
  assert.equal(earned.filter(effect=>effect.kind==='fact'&&effect.name==='driftwood.vista').length,1);
  const negativeSession=await beginProductSession('driftwood-isle','driftwood');
  try{
    const negative=await negativeSession.ready();let omitted=0;
    for(const part of parts){
      const unarmed=part.frames?.map(frame=>frame.filter(command=>{const omit=command.kind==='script'&&command.actorId===use.actorId&&command.value===use.value;if(omit)omitted++;return !omit;}));assert.ok(unarmed);
      const replay=await negative.verbTapePart({version:1,observe:[],segments:[{...part,frames:unarmed}]});
      const actual=replay.report.observations[0];assert.ok(actual);assert.equal(actual.flags.includes('used:vista-bench'),false);
      assert.equal(actual.effects.some(effect=>effect.kind==='fact'&&effect.name==='driftwood.vista'),false);
      const wanted=observations.find(row=>row.id===part.id);assert.ok(wanted);
      for(const flag of ['glass:1','glass:2'])assert.equal(actual.flags.includes(flag),wanted.flags.includes(flag),'only movement picks up sea glass');
    }
    assert.ok(omitted>0);assert.equal(negative.quarantined,false);
  }finally{await(await negativeSession.ready()).dispose();}
  console.info(JSON.stringify({story:'driftwood-optional',ticks,commands:commandsCount,parts:parts.length,glass:counts()['glass'],vista:counts()['vista'],milliseconds:performance.now()-started}));
}finally{releaseRopes();resident?.dispose();await(await session.ready()).dispose();}
