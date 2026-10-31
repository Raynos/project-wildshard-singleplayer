// oxlint-disable-next-line import/no-nodejs-modules -- Compare earned native inputs and independent continuation owners.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The native worker uses the original checked-in physics binary.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { beginProductSession } from './productSession';
import { checkedReplayPipeline } from './checkedReplayPipeline';
import { createNativeProofResident } from '../headless-native';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { snapshotSimHostBytes, decodeSimSnapshot } from '../../../src/engine/sim/snapshot';
import { physicsState, sameBytes } from '../../fake/simState';
import { installWalkRopeBodies } from './ropeBodies';
import { installNativeWalkBounds } from './nativeBounds';
import { prepareHeadlessRuntime } from '../driftwood-trade-native';
import { nativeEconomy, NATIVE_TRADE } from '../native-hosts/loot/nativeEconomy';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import type { HeadlessTapeObservation, HeadlessTapeSegment } from '../../../src/sdk/headlessTape';

const started=performance.now(), session=await beginProductSession('driftwood-isle','driftwood-trade'), {product,assets}=session;
const trace=(phase:string)=>console.info(JSON.stringify({phase,ms:performance.now()-started}));
let restoredSession:Awaited<ReturnType<typeof beginProductSession>>|undefined;
let stopReplay:(()=>Promise<void>)|undefined, negativeSession:Awaited<ReturnType<typeof beginProductSession>>|undefined;
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined, releaseRopes=()=>{ /* No walk owner before installation. */ };
try {
  negativeSession=await beginProductSession('driftwood-isle','driftwood-trade');
  const negativeOwner=negativeSession;
  const negativeOutcome=(async()=>{try{return {ok:true as const,sim:await negativeOwner.ready()};}
    catch(error){return {ok:false as const,error};}})();
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier},prepareHeadlessRuntime);
  const active=resident,{host}=active,economy=nativeEconomy(host),sim=await session.ready();
  releaseRopes=installWalkRopeBodies(host,product);installNativeWalkBounds(host);trace('capture-ready');
  const cape=economy.exchange.rows.goods.findIndex(row=>row.id==='cape'),offer=economy.exchange.rows.goods[cape];assert.ok(offer);
  const price=offer.costs.find(cost=>cost.item==='coin')?.n;assert.ok(price!==undefined&&price>0);
  const buy:HeadlessCommand={kind:'script',actorId:NATIVE_TRADE,value:cape};
  const parts:HeadlessTapeSegment[]=[],encoder=new TextEncoder();
  let frames:HeadlessCommand[][]=[],effects:HeadlessEffect[]=[],peakY=host.player.position.y,ticks=0,commandsCount=0,bytes=0,omitted=0;
  let identicalPhysics=0,canonicalPhysics=0,finalSnapshot='';
  const comparePhysics=(a:ArrayLike<number>,b:ArrayLike<number>)=>{if(sameBytes(a,b))identicalPhysics++;else{canonicalPhysics++;assert.deepEqual(physicsState(a),physicsState(b));}};
  const economySchema=v.object({purse:v.object({coins:v.number(),unsaved:v.boolean()}),owned:v.object({owned:v.array(v.string()),worn:v.array(v.string())}),durable:v.number()});
  const pipeline=checkedReplayPipeline<{segment:HeadlessTapeSegment;wanted:HeadlessTapeObservation;snapshot:ReturnType<typeof snapshotSimHostBytes>}>(async({segment,wanted,snapshot})=>{
    const ready=await negativeOutcome;if(!ready.ok)throw ready.error;
    const unarmed=segment.frames?.map(frame=>frame.filter(command=>{
      if(command.kind==='script'&&command.actorId===NATIVE_TRADE&&command.value===cape){omitted++;return false;}return true;
    }));assert.ok(unarmed);
    const outcomes=await Promise.allSettled([
      sim.verbTapePart({version:1,observe:[],segments:[segment]}),
      ready.sim.verbTapePart({version:1,observe:[],segments:[{...segment,frames:unarmed}]})
    ]);
    const [positive,negative]=outcomes;assert.ok(positive!==undefined&&negative!==undefined);
    if(positive.status==='rejected')throw positive.reason;if(negative.status==='rejected')throw negative.reason;
    assert.deepEqual(positive.value.report.observations,[wanted]);
    const {physics:actualPhysics,...actual}=decodeSimSnapshot(positive.value.commit.snapshot),{physics:expectedPhysics,...expected}=snapshot;
    assert.deepEqual(actual,expected);comparePhysics(actualPhysics,expectedPhysics);finalSnapshot=positive.value.commit.snapshot;
    const {physics:negativePhysics,adapters:negativeAdapters,...negativeState}=decodeSimSnapshot(negative.value.commit.snapshot);
    const {adapters:positiveAdapters,...positiveState}=actual;
    assert.deepEqual(negativeState,positiveState,'omitting BUY preserves all other native owners, clocks and RNG');comparePhysics(negativePhysics,expectedPhysics);
    assert.deepEqual(negativeAdapters.filter(row=>row.id!==NATIVE_TRADE),positiveAdapters.filter(row=>row.id!==NATIVE_TRADE));
    const positiveEconomy=positiveAdapters.find(row=>row.id===NATIVE_TRADE),negativeEconomy=negativeAdapters.find(row=>row.id===NATIVE_TRADE);assert.ok(positiveEconomy!==undefined&&negativeEconomy!==undefined);
    const good=v.parse(economySchema,positiveEconomy.state),bad=v.parse(economySchema,negativeEconomy.state);
    assert.equal(bad.owned.owned.includes('cape'),false);
    assert.deepEqual(bad.owned.owned,good.owned.owned.filter(id=>id!=='cape'));
    assert.deepEqual(bad.owned.worn,good.owned.worn);
    assert.equal(bad.purse.unsaved,good.purse.unsaved);
    const omitSaved=(value:typeof positiveEconomy.state)=>{
      if(typeof value!=='object'||value===null||Array.isArray(value))throw new Error('Missing saved economy object');
      const {owned,purse,durable,...rest}=value;void owned;void purse;void durable;return rest;
    };
    assert.deepEqual(omitSaved(negativeEconomy.state),omitSaved(positiveEconomy.state));
    assert.equal(bad.purse.coins,good.purse.coins+(good.owned.owned.includes('cape')?price:0));
    assert.equal(bad.durable,good.durable+(good.owned.owned.includes('cape')?price:0));
    trace(`checked-${segment.id}`);
  });stopReplay=pipeline.stop;
  const flush=async(id:string)=>{
    if(frames.length===0)return;
    const segment:HeadlessTapeSegment={id,ticks:frames.length,commands:[],frames};frames=[];parts.push(segment);
    const wanted:HeadlessTapeObservation={id,tick:host.state.tick,position:host.player.position.toArray(),peakY,grounded:host.player.motor.snapshot().result.grounded,flags:[...host.flags.all],
      quests:host.quests.map(row=>({id:row.def.id,currentId:row.current?.id??null,started:row.snapshot().started,complete:row.isComplete})),effects,adapters:[]};
    effects=[];peakY=host.player.position.y;bytes+=encoder.encode(JSON.stringify(wanted)).byteLength;assert.ok(bytes<=8_000_000&&parts.length<=128);
    await pipeline.offer({segment,wanted,snapshot:snapshotSimHostBytes(host)});
  };
  const step=async(commands:HeadlessCommand[])=>{pipeline.check();ticks++;commandsCount+=commands.length;assert.ok(ticks<=30_000&&commandsCount<=60_000);
    active.step(commands);frames.push(structuredClone(commands));effects.push(...structuredClone(active.effects));peakY=Math.max(peakY,host.player.position.y);
    if(frames.length===512)await flush(`part-${parts.length}`);
  };
  const go=async(x:number,z:number)=>{let best=Infinity,stall=0;for(let i=0;i<3600;i++){
    const p=host.player.position,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.25)return;
    if(d<best-.02){best=d;stall=0;}else stall++;
    const k=Math.min(1,d/.8)/Math.max(.01,d);await step([{kind:'player',moveX:dx*k,moveZ:dz*k,yaw:Math.atan2(-dx,-dz),...(stall>60&&stall%30===0?{jump:true}:{})}]);
  }throw new Error(`Trade walk stuck ${x},${z}`);};
  await step([buy]);await flush('out-of-reach-buy');assert.equal(economy.owned().has('cape'),false);
  for(const [x,z] of [[0,-186.5],[-8,-172],[-17,-161],[-20,-150],[-30,-142],[-30,-130],[-30,-118],[-30,-106],[-30,-104],[-24,-80],[-22,-74]] as const)await go(x,z);
  await step([{kind:'script',actorId:NATIVE_TRADE,value:-2}]);assert.equal(economy.exchange.active,true);
  await step([buy]);await flush('empty-purse-buy');assert.equal(economy.owned().has('cape'),false);assert.equal(economy.purse().coins,0);
  await step([{kind:'script',actorId:NATIVE_TRADE,value:-1}]);
  for(let kill=0;kill<16&&economy.purse().coins<price;kill++){
    const targets=[...host.entities].filter(([,a])=>a.alive&&(a.kind==='crab'||a.kind==='monkey'||a.kind==='boar'));
    targets.sort(([,a],[,b])=>a.position.distanceToSquared(host.player.position)-b.position.distanceToSquared(host.player.position));
    const selected=targets[0];assert.ok(selected);const [id,a]=selected;
    for(let frame=0;frame<3000&&a.alive;frame++){
      const p=host.player.position,dx=a.position.x-p.x,dz=a.position.z-p.z,d=Math.hypot(dx,dz),k=d>1.2?1/Math.max(d,.01):0;
      await step([{kind:'player',moveX:dx*k,moveZ:dz*k,yaw:Math.atan2(-dx,-dz),...(frame%40===0?{attack:{targetId:id}}:{})}]);
    }assert.equal(a.alive,false);await flush(`kill-${kill}`);
    for(let wait=0;wait<180;wait++)await step([]);await flush(`earned-${kill}`);
  }
  assert.ok(economy.purse().coins>=price);await go(-22,-74);await step([{kind:'script',actorId:NATIVE_TRADE,value:-2}]);
  const before=economy.purse().coins;await step([buy]);await flush('earned-buy');
  assert.equal(economy.owned().has('cape'),true);assert.equal(economy.purse().coins,before-price);
  await step([buy]);await flush('repeat-buy');assert.equal(economy.purse().coins,before-price);
  await pipeline.finish();assert.ok(omitted>=4&&finalSnapshot.length>0);assert.equal(sim.quarantined,false);trace('replay-complete');
  restoredSession=await beginProductSession('driftwood-isle','driftwood-trade',finalSnapshot);
  const restored=await restoredSession.ready(),suffixTicks=120,suffixEffects:HeadlessEffect[]=[];
  let suffixPeakY=host.player.position.y;assert.ok(parts.length+1<=128);
  for(let i=0;i<suffixTicks;i++){ticks++;assert.ok(ticks<=30_000);active.step([]);suffixEffects.push(...structuredClone(active.effects));suffixPeakY=Math.max(suffixPeakY,host.player.position.y);}
  // A constant-input suffix resumes the saved native world without asking the
  // walk adapter to allocate another set of already-saved rope colliders.
  const segment:HeadlessTapeSegment={id:'fresh-purchased-suffix',ticks:suffixTicks,commands:[]};
  const replies=await Promise.allSettled([sim.verbTapePart({version:1,observe:[],segments:[segment]}),restored.verbTapePart({version:1,observe:[],segments:[segment]})]);
  const wanted=snapshotSimHostBytes(host),suffixWanted:HeadlessTapeObservation={id:segment.id,tick:host.state.tick,position:host.player.position.toArray(),peakY:suffixPeakY,
    grounded:host.player.motor.snapshot().result.grounded,flags:[...host.flags.all],quests:host.quests.map(row=>({id:row.def.id,currentId:row.current?.id??null,started:row.snapshot().started,complete:row.isComplete})),effects:suffixEffects,adapters:[]};
  bytes+=encoder.encode(JSON.stringify(suffixWanted)).byteLength;assert.ok(bytes<=8_000_000);
  for(const reply of replies){if(reply.status==='rejected')throw reply.reason;assert.deepEqual(reply.value.report.observations,[suffixWanted]);const {physics,...actual}=decodeSimSnapshot(reply.value.commit.snapshot),{physics:expectedPhysics,...expected}=wanted;assert.deepEqual(actual,expected);comparePhysics(physics,expectedPhysics);}
  assert.equal(restored.quarantined,false);trace('fresh-purchased-suffix');
  console.info(JSON.stringify({restoredSuffix:suffixTicks,price,earned:before,spent:price,story:'driftwood-trade',ticks,commands:commandsCount,parts:parts.length,coins:economy.purse().coins,owned:economy.owned().all,omitted,identicalPhysics,canonicalPhysics,milliseconds:performance.now()-started}));
} finally {trace('dispose-start');await stopReplay?.();releaseRopes();resident?.dispose();await Promise.all([session.ready().then(sim=>sim.dispose()),negativeSession?.ready().then(sim=>sim.dispose()),restoredSession?.ready().then(sim=>sim.dispose())]);trace('disposed');}
