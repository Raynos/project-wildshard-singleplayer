// oxlint-disable-next-line import/no-nodejs-modules -- Assert actual native contacts and independent replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only admitted product and shipped physics bytes.
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import * as v from 'valibot';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-predators-native';
import {nativePopulationOf} from '../../../src/game/riding/nativePopulation';
import {nativeGroupCollection} from '../../../src/game/shardfile/groupRuntime';
import {mountedPlayerOf} from '../../../src/game/riding/native';
import {runTrustedHeadlessTape} from '../../../src/sdk/headlessTape';
import {decodeSimSnapshot,snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {canonicalSimDigest} from '../../fake/simState';
import {BladeRowsSchema} from '../../../src/format/heldMelee';
import {MeleeWeaponProfileSchema} from '../../../src/format/weaponProfiles';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import {beginProductSession} from './productSession';
import {checkedReplayPipeline} from './checkedReplayPipeline';

const State=v.object({passes:v.number(),moves:v.array(v.string()),pass:v.object({passChain:v.number(),chainT:v.number()}),
  blade:v.object({contacts:v.number(),struck:v.array(v.string())})});
const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),descriptor=outputDescriptor(product.shardfile);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const blade=v.parse(BladeRowsSchema,await product.json('weapons/sabre.json'));
const item=product.shardfile.items.rows.find(row=>row.id==='weapon.sabre');assert.equal(item?.kind,'weapon');
if(item?.kind!=='weapon')throw new Error('Missing actual mounted sabre profile');
const profile=v.parse(MeleeWeaponProfileSchema,item.profile),passes=[blade.moves.passes.left,blade.moves.passes.right];
const passReach=Math.min(...passes.map(row=>row.reach??profile.reach)),passWindup=Math.min(...passes.map(row=>row.windup));
const lookLimit=Math.PI*140/180; // The page mount's ordinary look limit, not its breaking limit.
const rear=new Vector3(),front=new Vector3(),aimPoint=new Vector3();
const resident=await createNativeProofResident({product,assets,shard:product.shardfile,rapier:await loadRapier(readFileSync('public/assets/physics/rapier.wasm'))},prepareHeadlessRuntime);
let replay:Awaited<ReturnType<Awaited<ReturnType<typeof beginProductSession>>['ready']>>|undefined;
let stopReplay:(()=>Promise<void>)|undefined;
try{
  const host=resident.host,mount=mountedPlayerOf(host),population=nativePopulationOf(host);assert.ok(mount);assert.ok(population);
  let inputs=0;
  const move=(commands:readonly HeadlessCommand[]):void=>{assert.ok(inputs++<24_000,'mounted inputs retain their finite allowance');resident.step(commands);};
  runTrustedHeadlessTape(host,move,()=>resident.effects,{version:1,observe:[],segments:[{id:'walk-to-camp-horse',ticks:6000,commands:[],
    route:[{x:20,z:216},{x:40,z:218},{x:60,z:214},{x:66,z:209.5},{x:66,z:211.5},{x:66.8,z:213.4}]}]});
  move([{kind:'script',actorId:'nalati.companion.use',value:1}]);assert.equal(mount.mounted,true);
  const ridden=mount.horse;assert.ok(ridden);const riddenHealth=ridden.hp;
  const reins=(forward:number,turn:number,sprint=false,jump=false,yaw=host.player.yaw):HeadlessCommand=>{
    const length=Math.max(1,Math.hypot(forward,turn));return {kind:'player',moveX:0,moveZ:0,yaw,commandVersion:1,
      steer:{keyX:0,keyY:0,stickX:turn/length,stickY:forward/length},sprint,...(jump?{jump:true}:{})};
  };
  for(let tick=0;tick<90;tick++)move([reins(-1,0)]);
  const drive=(x:number,z:number):void=>{
    for(let tick=0;tick<1800;tick++){
      assert.equal(mount.mounted,true);
      const p=host.player.position,dx=x-p.x,dz=z-p.z,distance=Math.hypot(dx,dz);if(distance<2.5)return;
      const target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(mount.body.heading-target),Math.cos(mount.body.heading-target));
      const brake=Math.abs(delta)>.7&&Math.abs(mount.body.speed)>1.5;
      move([reins(brake?-.3:Math.abs(delta)>.7?0:1,brake?0:Math.max(-1,Math.min(1,delta*2.5)),!brake,tick>120&&tick%60===0&&mount.body.speed<1)]);
    }
    throw new Error(`Actual mounted approach stopped at ${x}, ${z}`);
  };
  for(const [x,z] of [[60,214],[40,218],[20,216],[0,216],[-50,218],[-100,212],[-135,214],[-157,218],[-175,206],[-190,191],[-196,188]] as const)drive(x,z);
  for(let tick=0;tick<300&&mount.body.speed>.15;tick++)move([reins(-1,0)]);
  const flock=population.flocks[0];assert.ok(flock);
  for(let tick=0;tick<600;tick++){
    const p=host.player.position,heading=Math.atan2(flock.cx-p.x,flock.cz-p.z),delta=Math.atan2(Math.sin(mount.body.heading-heading),Math.cos(mount.body.heading-heading));
    if(Math.abs(delta)<.08)break;move([reins(0,Math.max(-1,Math.min(1,delta*2.5)))]);
  }
  for(let tick=0;tick<300&&mount.body.speed>.15;tick++)move([reins(-1,0)]);
  for(let tick=0;tick<18_000&&population.raid.raids===0;tick++)move([reins(0,0)]);
  assert.equal(population.raid.raids,1,'the untouched natural raid clock must admit the actual raiders');
  const pack=nativeGroupCollection(host,'nalati.groups').packs[population.raid.snapshot().raiders];assert.ok(pack);
  const before=new Map([...host.entities.values()].map(actor=>[actor.entityId,{kind:actor.kind,hp:actor.hp}]));
  const checkpoint=serializeSimSnapshot(snapshotSimHost(host)),checkpointTick=host.state.tick;
  const pending=await beginProductSession('nalati-grasslands','nalati-predators',checkpoint);replay=await pending.ready();const worker=replay;
  const owner=host.adapters.get('nalati.weapons');assert.ok(owner);
  const read=()=>{const raw=owner.snapshot();assert.equal(typeof raw,'string');if(typeof raw!=='string')throw new Error('Missing native mounted weapon state');return v.parse(State,JSON.parse(raw));};
  const frames:HeadlessCommand[][]=[],contacts:{tick:number;struck:string[]}[]=[];
  interface Part {start:number;tick:number;digest:string}
  const parts:Part[]=[];let offset=0,replayed=0,middle:string|undefined,middleTick=0,contactCount=0;
  const pipeline=checkedReplayPipeline<Part>(async part=>{
    const chunk=frames.slice(part.start,part.tick),result=await worker.verbTapePart({version:1,observe:['nalati.weapons','nalati.predators'],segments:[
      {id:`mounted-chain-${part.tick}`,ticks:chunk.length,commands:[],frames:chunk},
    ]});
    assert.equal(result.report.ticks,chunk.length);assert.equal(result.commit.tick,checkpointTick+part.tick);
    assert.equal(canonicalSimDigest(decodeSimSnapshot(result.commit.snapshot)),part.digest,'fresh mounted input reproduces every native body, hit and weapon cursor');
    replayed+=result.report.ticks;
  });stopReplay=pipeline.stop;
  const flush=async():Promise<void>=>{
    if(offset===frames.length)return;
    assert.ok(frames.length-offset<=512);
    const part={start:offset,tick:frames.length,digest:canonicalSimDigest(snapshotSimHost(host))};parts.push(part);
    await pipeline.offer(part);offset=frames.length;
  };
  const step=async(commands:readonly HeadlessCommand[]):Promise<void>=>{
    pipeline.check();frames.push(structuredClone([...commands]));move(commands);
    const saved=read();
    if(saved.blade.contacts>contactCount){contacts.push({tick:frames.length,struck:[...saved.blade.struck]});contactCount=saved.blade.contacts;}
    if(middle===undefined&&saved.pass.passChain===1){middle=serializeSimSnapshot(snapshotSimHost(host));middleTick=frames.length;await flush();}
    if(frames.length-offset>=512)await flush();
  };
  await step([{kind:'script',actorId:'nalati.weapon.swap',value:1}]);
  for(let tick=0;tick<1800&&read().pass.passChain<2;tick++){
    const p=host.player.position,target=pack.members.filter(actor=>actor.alive).sort((a,b)=>a.position.distanceToSquared(p)-b.position.distanceToSquared(p))[0];assert.ok(target);
    const dx=target.position.x-p.x,dz=target.position.z-p.z,distance=Math.hypot(dx,dz),direct=Math.atan2(dx,dz);
    const heading=Math.atan2(target.position.x+Math.cos(direct)*2-p.x,target.position.z-Math.sin(direct)*2-p.z);
    const delta=Math.atan2(Math.sin(mount.body.heading-heading),Math.cos(mount.body.heading-heading));
    const brake=(Math.abs(delta)>.9||distance<2.5)&&Math.abs(mount.body.speed)>3;
    target.bodyCapsule(rear,front);aimPoint.addVectors(rear,front).multiplyScalar(.5);
    const aimDx=aimPoint.x-p.x,aimDz=aimPoint.z-p.z,gap=Math.hypot(aimDx,aimPoint.y-p.y-1.68,aimDz);
    const vx=mount.rider.velocity.x-Math.sin(target.yaw)*target.speed,vz=mount.rider.velocity.z-Math.cos(target.yaw)*target.speed;
    const closing=Math.max(0,(vx*dx+vz*dz)/Math.max(distance,.001)),pressRange=passReach+target.dims.bodyRadius*target.scale+closing*passWindup;
    const base=mount.body.heading-Math.PI,look=Math.atan2(Math.sin(Math.atan2(-aimDx,-aimDz)-base),Math.cos(Math.atan2(-aimDx,-aimDz)-base));
    const commands:HeadlessCommand[]=[reins(brake?-.8:Math.abs(delta)>.9?0:distance<6?.85:1,brake?0:Math.max(-1,Math.min(1,delta*2.5)),!brake&&distance>=10,false,base+Math.max(-lookLimit,Math.min(lookLimit,look))),
      {kind:'script',actorId:'nalati.weapon.pitch',value:Math.atan2(aimPoint.y-p.y-1.68,Math.hypot(aimDx,aimDz))}];
    if(gap<=pressRange&&Math.abs(look)<=lookLimit&&tick%20===0)commands.push({kind:'script',actorId:'nalati.weapon.attack',value:1});
    await step(commands);
  }
  assert.ok(read().pass.passChain>=2,'only actual accepted mounted contacts earn a two-hit chain');assert.ok(middle);
  for(let tick=0;tick<12;tick++)await step([reins(0,0)]);
  assert.ok(read().pass.passChain>=2);assert.ok(read().pass.chainT>0);assert.ok(read().blade.contacts>=2);assert.ok(contacts.length>=2);
  assert.equal(mount.horse,ridden);assert.equal(ridden.hp,riddenHealth,'the actual ridden horse is never struck');
  for(const contact of contacts)for(const id of contact.struck){assert.ok(before.has(id));assert.ok(host.entities.get(id));}
  const damage=[...host.entities.values()].filter(actor=>actor.hp<(before.get(actor.entityId)?.hp??actor.hp))
    .map(actor=>({id:actor.entityId,kind:actor.kind,before:before.get(actor.entityId)?.hp,after:actor.hp}));
  assert.ok(damage.length>0,'the chain must accompany real native damage, never synthetic hit messages');
  await flush();await pipeline.finish();assert.equal(replayed,frames.length);assert.equal(replay.quarantined,false);
  await replay.dispose();replay=undefined;
  const restored=await beginProductSession('nalati-grasslands','nalati-predators',middle);replay=await restored.ready();
  let suffix=0;
  for(const part of parts.filter(row=>row.tick>middleTick)){
    assert.equal(part.start,middleTick+suffix);
    const chunk=frames.slice(part.start,part.tick),result=await replay.verbTapePart({version:1,observe:['nalati.weapons','nalati.predators'],segments:[
      {id:`continue-chain-${part.tick}`,ticks:chunk.length,commands:[],frames:chunk},
    ]});
    assert.equal(result.report.ticks,chunk.length);assert.equal(result.commit.tick,checkpointTick+part.tick);
    assert.equal(canonicalSimDigest(decodeSimSnapshot(result.commit.snapshot)),part.digest,'an earned one-hit checkpoint continues the same contacts and chain');suffix+=result.report.ticks;
  }
  assert.equal(suffix,frames.length-middleTick);assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:'native-mounted-chain',approach:checkpointTick,inputs:frames.length,parts:parts.length,middleTick,contacts,chain:read().pass,damage}));
}finally{await stopReplay?.();resident.dispose();await replay?.dispose();}
