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
import {parseCarriedQuest} from '../../../src/format/questSteps';
import {decodeSimSnapshot,snapshotSimHostBytes,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {physicsState,sameBytes} from '../../fake/simState';
import {chapterCampInputs,chapterApproachInputs,chapterBondInputs,chapterGoatInputs,chapterReturnInputs,chapterHomeInputs} from '../../proof/nalati-grasslands/chapterOne';
import {chapterCarvingRoadInputs,chapterCarvingArrivalInputs} from '../../proof/nalati-grasslands/chapterTwo';
import {checkedReplayPipeline} from './checkedReplayPipeline';
import {ChapterHandoffSchema,chapterObserved,chapterTwoObserved,chapterWire,chapterRead,chapterWireHash,chapterSnapshotDigest,
  chapterInputHash,checkChapterLedger,type ChapterPart,type ChapterHandoff} from './chapterHandoff';
import type {HeadlessCommand,HeadlessEffect,HeadlessTickCommit} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeObservation} from '../../../src/sdk/headlessTape';

import {PACKED_CHAPTER_TAMING,unpackChapterTaming} from './chapterObservation';

const [stage,outputPath,inputPath,inputHash]=process.argv.slice(2);assert.ok(stage==='plains'||stage==='approach'||stage==='bond'||stage==='goat'||stage==='return'||stage==='home'||stage==='carving-road'||stage==='carving-arrival');assert.ok(outputPath);
const observed=stage==='carving-road'||stage==='carving-arrival'?chapterTwoObserved:chapterObserved;
let inherited:ChapterHandoff|undefined;
if(stage!=='plains'){
  assert.ok(inputPath);assert.ok(inputHash);assert.ok(statSync(inputPath).size<=32_000_000);
  const wire=readFileSync(inputPath,'utf8');assert.equal(chapterWireHash(wire),inputHash);
  inherited=v.parse(ChapterHandoffSchema,chapterRead(wire));assert.equal(inherited.stage,stage==='approach'?'plains':stage==='bond'?'approach':stage==='goat'?'bond':stage==='return'?'goat':stage==='home'?'return':stage==='carving-road'?'home':'carving-road');checkChapterLedger(inherited.parts,inherited.tick);
}
const started=performance.now(),session=await beginProductSession('nalati-grasslands','nalati-chapter',inherited?.snapshot),{product,assets}=session;
const descriptor=outputDescriptor(product.shardfile);assert.ok(descriptor?.indexHash);
if(inherited!==undefined)assert.equal(inherited.source,descriptor.indexHash);
const inheritedParts=inherited?.parts.length??0,inheritedPartsHash=inherited===undefined?undefined:chapterWireHash(chapterWire(inherited.parts));
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
let pipeline:ReturnType<typeof checkedReplayPipeline<ChapterPart>>|undefined;
try{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier},prepareHeadlessRuntime,inherited?.snapshot);
  const active=resident,{host}=active,ready=session.ready(),history:ChapterPart[]=inherited?.parts??[],firstTick=host.state.tick;
  let commandsCount=history.reduce((sum,part)=>sum+(part.plan.segments[0]?.frames??[]).reduce((count,frame)=>count+frame.length,0),0);
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
    for(const [index,row]of repeated.report.observations.entries()){
      const packed=row.adapters?.find(adapter=>adapter.id===PACKED_CHAPTER_TAMING);
      if(packed!==undefined){const expected=part.expected.observations[index]?.adapters?.find(adapter=>adapter.id===PACKED_CHAPTER_TAMING);assert.ok(expected);
        assert.deepEqual(unpackChapterTaming(packed.state),unpackChapterTaming(expected.state),'every original taming field survives the lossless report codec');}
    }
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
      adapters:observed.map(identity=>{const adapter=host.adapters.get(identity);assert.ok(adapter);const state=adapter.snapshot();
        return {id:identity,state:typeof state==='string'?state:JSON.stringify(state)};})};
    const part:ChapterPart={plan:{version:1,observe:[...observed],segments:[{id,ticks:frames.length,commands:[],frames}]},
      expected:{version:1,ticks:frames.length,observations:[observation]},digest:chapterSnapshotDigest(snapshotSimHostBytes(host))};
    history.push(part);checkChapterLedger(history,host.state.tick);frames=[];effects=[];peakY=host.player.position.y;
    await checked.offer(part);
  };
  let bondTicks=0;
  if(stage==='bond'){assert.ok(inherited?.bondStart!==undefined);bondTicks=host.state.tick-inherited.bondStart;}
  const inputs=stage==='plains'?chapterCampInputs(host,product.shardfile.spawn):stage==='approach'?chapterApproachInputs(host):stage==='bond'?chapterBondInputs(host,bondTicks)
    :stage==='goat'?chapterGoatInputs(host,parseCarriedQuest(await product.json('quests/carried.json'))):stage==='return'?chapterReturnInputs(host):stage==='home'?chapterHomeInputs(host,true):stage==='carving-road'?chapterCarvingRoadInputs(host):chapterCarvingArrivalInputs(host,true);
  for(const commands of inputs){
    checked.check();commandsCount+=commands.length;assert.ok(commandsCount<=60_000&&host.state.tick<60_000);
    frames.push(structuredClone([...commands]));active.step(commands);effects.push(...structuredClone(active.effects));
    assert.ok(host.player.health.alive);peakY=Math.max(peakY,host.player.position.y);
    if(host.state.tick%512===0)await flush();
  }
  await flush();await checked.finish();assert.ok(final);
  assert.equal(replayedTicks,host.state.tick-firstTick);
  const {physics:a,...actual}=decodeSimSnapshot(final.snapshot),{physics:b,...expected}=snapshotSimHostBytes(host);
  assert.deepEqual(actual,expected);if(!sameBytes(a,b))assert.deepEqual(physicsState(a),physicsState(b));
  assert.equal((await ready).quarantined,false);checkChapterLedger(history,host.state.tick);
  if(inheritedPartsHash!==undefined)assert.equal(chapterWireHash(chapterWire(history.slice(0,inheritedParts))),inheritedPartsHash,
    'the checked prefix retains every original input, observation, effect and native digest');
  const secondChapter=stage==='carving-road'||stage==='carving-arrival',firstComplete=stage==='home'||secondChapter;
  assert.equal(host.flags.has('tamed:horse'),stage!=='plains'&&stage!=='approach');assert.equal(host.flags.has('won:kokpar'),stage==='goat'||stage==='return'||firstComplete);
  assert.equal(host.flags.has('told:tulpar'),firstComplete);assert.equal(host.flags.has('quest:tulpar'),firstComplete);
  assert.equal(host.flags.has('talked:elder:2'),secondChapter);
  for(const flag of ['clue:1','clue:2','clue:3','quest:golden-king','quest:father-wind','entered:kurgan','dead:golden-king','dead:jel-ata'])assert.equal(host.flags.has(flag),false,flag);
  const quest=product.shardfile.quests.quests.find(row=>row.id==='tulpar');assert.ok(quest?.onComplete?.fact);
  const fact=quest.onComplete.fact,earned=history.flatMap(part=>part.expected.observations.flatMap(row=>row.effects));
  const completionFacts=earned.filter(effect=>effect.kind==='fact'&&effect.name===fact&&effect.actorId===quest.id).length;
  assert.equal(completionFacts,Number(firstComplete));
  const snapshot=snapshotSimHostBytes(host),handoff:ChapterHandoff={version:1,stage,source:descriptor.indexHash,tick:host.state.tick,
    ...(stage==='approach'?{bondStart:firstTick}:{}),snapshot:serializeSimSnapshot(snapshot),digest:chapterSnapshotDigest(snapshot),parts:history};
  assert.equal(chapterSnapshotDigest(handoff.snapshot),handoff.digest,'the saved continuation retains every numeric native field');
  const wire=chapterWire(v.parse(ChapterHandoffSchema,handoff));assert.ok(Buffer.byteLength(wire)<=32_000_000);
  assert.equal(chapterInputHash(v.parse(ChapterHandoffSchema,chapterRead(wire)).parts),chapterInputHash(history),'child handoff retains every signed-zero command');
  writeFileSync(outputPath,wire,{flag:'wx',mode:0o600});
  const current=host.quests.find(row=>row.def.id===quest.id);assert.ok(current);
  console.info(JSON.stringify({story:`chapter-one-${stage}`,hash:chapterWireHash(wire),tick:host.state.tick,parts:history.length,
    current:current.current?.id??null,complete:current.isComplete,completionFacts,flags:[...host.flags.all],
    commands:history.reduce((sum,part)=>sum+(part.plan.segments[0]?.frames??[]).reduce((count,frame)=>count+frame.length,0),0),ms:performance.now()-started}));
}finally{
  try{await pipeline?.stop();}
  finally{resident?.dispose();await(await session.ready()).dispose();}
}
