// oxlint-disable-next-line import/no-nodejs-modules -- Assert actual wildlife awareness and fresh native replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the shipped physics binary.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {runTrustedHeadlessTape,type HeadlessTapeSegment} from '../../../src/sdk/headlessTape';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-stealth-native';
import {walkNalatiHorsePlains} from '../../proof/nalati-grasslands/horsePlainsWalk';
import {beginProductSession} from './productSession';

const session=await beginProductSession('nalati-grasslands','nalati-stealth'),{product,assets}=session;
let replay:Awaited<ReturnType<typeof session.ready>>|undefined;
const resident=await createNativeProofResident({product,assets,shard:product.shardfile,
  rapier:await loadRapier(readFileSync('public/assets/physics/rapier.wasm'))},prepareHeadlessRuntime).catch(async(error:unknown)=>{
  const worker=await session.ready();await worker.dispose();throw error;
});
const State=v.object({law:v.object({state:v.string(),threat:v.number(),observation:v.object({threats:v.array(v.object({awareness:v.number(),alert:v.number(),hunting:v.number()}))})}),
  label:v.string(),hints:v.number()});
const frames:HeadlessCommand[][]=[],marks:{id:string;tick:number;state:string}[]=[],seen=new Set<string>();
let checkpoint:string|undefined,checkpointTick=0;
try{
  const owner=resident.host.adapters.get('nalati.stealth');assert.ok(owner);
  const read=()=>{const saved=owner.snapshot();assert.equal(typeof saved,'string');if(typeof saved!=='string')throw new Error('Missing actual awareness state');return saved;};
  const step=(commands:readonly HeadlessCommand[]):void=>{
    assert.ok(frames.length<18_000,'the real approach retains its finite input allowance');
    frames.push(structuredClone([...commands]));resident.step(commands);
    const saved=read(),state=v.parse(State,JSON.parse(saved));
    if(!seen.has(state.law.state)){
      seen.add(state.law.state);marks.push({id:`awareness-${state.law.state}`,tick:frames.length,state:saved});
      if(state.law.state==='noticed'){
        assert.equal(state.label,'Noticed');assert.ok(state.law.threat>0&&state.law.threat<1);
        assert.ok(state.law.observation.threats.some(threat=>threat.awareness>0),'live animals supply the actual rising awareness');
        checkpoint=serializeSimSnapshot(snapshotSimHost(resident.host));checkpointTick=frames.length;
      }
      if(state.law.state==='detected'){assert.equal(state.label,'Detected');assert.equal(state.law.threat,1);}
    }
  };
  // The same physical bridge and bowl shelves as the earned field-taming
  // proof. Running past real herds changes their own senses; no threat input
  // or population mutation is exposed to this pilot.
  walkNalatiHorsePlains(resident.host,step);
  for(let tick=0;tick<120;tick++)step([]);
  assert.ok(seen.has('visible'));assert.ok(seen.has('noticed'));assert.ok(seen.has('detected'));assert.ok(checkpoint);
  assert.equal(resident.host.player.health.alive,true);
  const final=read();marks.push({id:'after-real-awareness',tick:frames.length,state:final});
  const segments:HeadlessTapeSegment[]=[];let start=0;
  for(const mark of marks){assert.ok(mark.tick>start);segments.push({id:mark.id,ticks:mark.tick-start,commands:[],frames:frames.slice(start,mark.tick)});start=mark.tick;}
  replay=await session.ready();const repeated=await replay.verbTape({version:1,observe:['nalati.stealth'],segments});
  for(const mark of marks){const observation=repeated.observations.find(row=>row.id===mark.id);assert.ok(observation);
    const state=observation.adapters.find(row=>row.id==='nalati.stealth');assert.ok(state);
    assert.deepEqual(JSON.parse(state.state),JSON.parse(mark.state),'fresh inputs reproduce each actual awareness transition and original threat order');}
  await replay.dispose();replay=undefined;
  const restored=await beginProductSession('nalati-grasslands','nalati-stealth',checkpoint);replay=await restored.ready();
  const suffix=frames.slice(checkpointTick),report=runTrustedHeadlessTape(resident.host,commands=>resident.step(commands),()=>resident.effects,
    {version:1,observe:['nalati.stealth'],segments:[{id:'after-awareness-restore',ticks:1,commands:[]}]});
  const continuation=await replay.verbTape({version:1,observe:['nalati.stealth'],segments:[
    {id:'actual-rising-awareness-suffix',ticks:suffix.length,commands:[],frames:suffix},{id:'after-awareness-restore',ticks:1,commands:[]},
  ]});
  assert.deepEqual(continuation.observations.at(-1),report.observations[0],'an earned Noticed checkpoint continues the real herd senses and detection state');
  assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:'native-awareness',inputs:frames.length,checkpointTick,states:[...seen],hints:v.parse(State,JSON.parse(final)).hints}));
}finally{resident.dispose();replay??=await session.ready();await replay.dispose();}
