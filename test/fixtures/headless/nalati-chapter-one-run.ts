// oxlint-disable-next-line import/no-nodejs-modules -- Require earned native state and exact independent input replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixed child uses the admitted physics bytes and its owned continuation file.
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import * as v from 'valibot';
import {beginProductSession} from './productSession';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-chapter-native';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {decodeSimSnapshot,snapshotSimHostBytes,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {physicsState,sameBytes} from '../../fake/simState';
import {chapterCampInputs,chapterBondInputs} from '../../proof/nalati-grasslands/chapterOne';
import {checkedReplayPipeline} from './checkedReplayPipeline';
import {ChapterHandoffSchema,chapterObserved,chapterWire,chapterRead,chapterWireHash,chapterSnapshotDigest,
  chapterInputHash,checkChapterLedger,type ChapterPart,type ChapterHandoff} from './chapterHandoff';
import type {HeadlessCommand,HeadlessEffect,HeadlessTickCommit} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeObservation} from '../../../src/sdk/headlessTape';

const [stage,outputPath,inputPath,inputHash]=process.argv.slice(2);assert.ok(stage==='plains'||stage==='bond');assert.ok(outputPath);
let inherited:ChapterHandoff|undefined;
if(stage==='bond'){
  assert.ok(inputPath);assert.ok(inputHash);assert.ok(statSync(inputPath).size<=32_000_000);
  const wire=readFileSync(inputPath,'utf8');assert.equal(chapterWireHash(wire),inputHash);
  inherited=v.parse(ChapterHandoffSchema,chapterRead(wire));assert.equal(inherited.stage,'plains');checkChapterLedger(inherited.parts,inherited.tick);
}
const started=performance.now(),session=await beginProductSession('nalati-grasslands','nalati-chapter',inherited?.snapshot),{product,assets}=session;
const descriptor=outputDescriptor(product.shardfile);assert.ok(descriptor?.indexHash);
if(inherited!==undefined)assert.equal(inherited.source,descriptor.indexHash);
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
let pipeline:ReturnType<typeof checkedReplayPipeline<ChapterPart>>|undefined;
try{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier},prepareHeadlessRuntime,inherited?.snapshot);
  const active=resident,{host}=active,ready=session.ready(),history:ChapterPart[]=inherited?.parts??[],firstTick=host.state.tick;
  if(inherited!==undefined)assert.equal(chapterSnapshotDigest(snapshotSimHostBytes(host)),inherited.digest,'the recorder quietly restores the earned arrival');
  let initialized=false;
  let final:HeadlessTickCommit|undefined,replayedTicks=0,frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[],peakY=host.player.position.y;
  pipeline=checkedReplayPipeline<ChapterPart>(async part=>{
    const worker=await ready;
    if(!initialized&&inherited!==undefined){
      const checkpoint=worker.checkpoint;assert.ok(checkpoint);
      assert.equal(chapterSnapshotDigest(checkpoint.snapshot),inherited.digest,'the fresh worker quietly restores the same earned arrival');
    }
    initialized=true;
    console.info(JSON.stringify({stage,phase:'replay-request',tick:part.expected.observations[0]?.tick,ms:performance.now()-started}));
    const repeated=await worker.verbTapePart(part.plan);
    assert.deepEqual(repeated.report,part.expected,'independent inputs retain every observation and ordered effect');
    assert.equal(chapterSnapshotDigest(repeated.commit.snapshot),part.digest,'every boundary retains the complete numeric native continuation');
    final=repeated.commit;replayedTicks+=repeated.report.ticks;
    console.info(JSON.stringify({stage,phase:'replay-checked',tick:repeated.commit.tick,ms:performance.now()-started}));
  });
  const checked=pipeline;
  const flush=async():Promise<void>=>{
    if(frames.length===0)return;
    const id=`chapter-${history.length}`,observation:HeadlessTapeObservation={id,tick:host.state.tick,position:host.player.position.toArray(),peakY,
      grounded:host.player.motor.snapshot().result.grounded,flags:[...host.flags.all],
      quests:host.quests.map(quest=>({id:quest.def.id,currentId:quest.current?.id??null,started:quest.snapshot().started,complete:quest.isComplete})),effects,
      adapters:chapterObserved.map(identity=>{const adapter=host.adapters.get(identity);assert.ok(adapter);const state=adapter.snapshot();
        return {id:identity,state:typeof state==='string'?state:JSON.stringify(state)};})};
    const part:ChapterPart={plan:{version:1,observe:[...chapterObserved],segments:[{id,ticks:frames.length,commands:[],frames}]},
      expected:{version:1,ticks:frames.length,observations:[observation]},digest:chapterSnapshotDigest(snapshotSimHostBytes(host))};
    history.push(part);checkChapterLedger(history,host.state.tick);frames=[];effects=[];peakY=host.player.position.y;
    await checked.offer(part);
  };
  const inputs=stage==='plains'?chapterCampInputs(host,product.shardfile.spawn):chapterBondInputs(host);
  for(const commands of inputs){
    checked.check();frames.push(structuredClone([...commands]));active.step(commands);effects.push(...structuredClone(active.effects));
    assert.ok(host.player.health.alive);peakY=Math.max(peakY,host.player.position.y);
    if(host.state.tick%512===0)await flush();
  }
  await flush();await checked.finish();assert.ok(final);
  assert.equal(replayedTicks,host.state.tick-firstTick);
  const {physics:a,...actual}=decodeSimSnapshot(final.snapshot),{physics:b,...expected}=snapshotSimHostBytes(host);
  assert.deepEqual(actual,expected);if(!sameBytes(a,b))assert.deepEqual(physicsState(a),physicsState(b));
  assert.equal((await ready).quarantined,false);checkChapterLedger(history,host.state.tick);
  assert.equal(host.flags.has('tamed:horse'),stage==='bond');
  for(const flag of ['won:kokpar','told:tulpar','quest:tulpar','talked:elder:2','entered:kurgan','dead:golden-king','dead:jel-ata'])assert.equal(host.flags.has(flag),false,flag);
  const snapshot=snapshotSimHostBytes(host),handoff:ChapterHandoff={version:1,stage,source:descriptor.indexHash,tick:host.state.tick,
    snapshot:serializeSimSnapshot(snapshot),digest:chapterSnapshotDigest(snapshot),parts:history};
  const wire=chapterWire(v.parse(ChapterHandoffSchema,handoff));assert.ok(Buffer.byteLength(wire)<=32_000_000);
  assert.equal(chapterInputHash(v.parse(ChapterHandoffSchema,chapterRead(wire)).parts),chapterInputHash(history),'child handoff retains every signed-zero command');
  writeFileSync(outputPath,wire,{flag:'wx',mode:0o600});
  console.info(JSON.stringify({story:`chapter-one-${stage}`,hash:chapterWireHash(wire),tick:host.state.tick,parts:history.length,
    commands:history.reduce((sum,part)=>sum+(part.plan.segments[0]?.frames??[]).reduce((count,frame)=>count+frame.length,0),0),ms:performance.now()-started}));
}finally{
  try{await pipeline?.stop();}
  finally{resident?.dispose();await(await session.ready()).dispose();}
}
