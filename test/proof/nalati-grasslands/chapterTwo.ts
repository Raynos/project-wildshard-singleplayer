// oxlint-disable-next-line import/no-nodejs-modules -- Every chapter edge requires its genuinely earned original owner.
import assert from 'node:assert/strict';
import type {SimHost} from '../../../src/engine/sim';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import {mountedPlayerOf} from '../../../src/game/riding/native';
import {nativeTamingOf} from '../../../src/game/riding/nativeTaming';
import {SKY_ROAD} from '../../../src/shards/nalati-grasslands/generators/layout';
import {chapterWalkInputs,chapterRideInputs} from './chapterOne';

/** Leave the completed first reading and accept only the actual next elder
 * dialogue, then ride the earned horse to the real carving field. */
export function* chapterCarvingRoadInputs(host:SimHost):Generator<readonly HeadlessCommand[]> {
  assert.ok(host.flags.has('quest:tulpar'));assert.equal(host.flags.has('talked:elder:2'),false);
  yield [{kind:'script',actorId:'nalati.talk',value:-1}];
  for(let tick=0;tick<600&&!host.flags.has('talked:elder:2');tick++)yield tick%16===0?[{kind:'script',actorId:'nalati.talk',value:0}]:[];
  assert.ok(host.flags.has('talked:elder:2'));
  yield [{kind:'script',actorId:'nalati.talk',value:-1}];
  for(let tick=0;tick<60&&host.quests.find(row=>row.def.id==='golden-king')?.current?.id!=='clues';tick++)yield [];
  assert.equal(host.quests.find(row=>row.def.id==='golden-king')?.current?.id,'clues');
  yield* chapterWalkInputs(host,'return-to-earned-horse',[
    {x:86.6,z:219.5},{x:91,z:216},{x:94,z:210},{x:95,z:204},{x:88,z:204.5},{x:84.8,z:203.8},{x:83,z:206},
    {x:73,z:206.1},{x:66,z:209.5},{x:63,z:212},
  ],3600);
  const mount=mountedPlayerOf(host),taming=nativeTamingOf(host);assert.ok(mount);assert.ok(taming?.companion);
  const horse=taming.companion;
  for(let tick=0;tick<600&&!mount.mounted;tick++){
    const p=host.player.position,dx=horse.position.x-p.x,dz=horse.position.z-p.z,d=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz);
    yield [{kind:'player',moveX:d>2.5?dx/d:0,moveZ:d>2.5?dz/d:0,yaw},
      ...(d<3.2&&tick%20===0?[{kind:'script' as const,actorId:'nalati.ride',value:1}]:[])];
  }
  assert.equal(mount.mounted,true);assert.equal(mount.horse,horse);
  const road:readonly (readonly[number,number])[]=[[60,214],[40,218],[20,216],[0,216],[0,205],[0,190],[0,170],[0,158],
    [0,147],[1,146],[23,146],[27,142],[39,141],[53,139],[57,136],[57,134],[40,133],
    ...SKY_ROAD.slice(4)];
  for(const [x,z]of road)yield* chapterRideInputs(host,x,z);
  assert.equal(mount.mounted,true);assert.equal(mount.horse,horse);
  assert.ok(Math.hypot(host.player.position.x-120,host.player.position.z-70)<2.5);
  assert.equal(host.flags.has('clue:1'),false);assert.equal(host.flags.has('entered:kurgan'),false);
}
/** Continue from the actually ridden rim; each original field leg has its
 * own fresh cursor, with the same horse and native carrying momentum. */
export function* chapterCarvingArrivalInputs(host:SimHost,fromRoad=false):Generator<readonly HeadlessCommand[]> {
  if(!fromRoad)yield* chapterCarvingRoadInputs(host);
  const mount=mountedPlayerOf(host),taming=nativeTamingOf(host);assert.ok(mount);assert.ok(taming?.companion);
  assert.equal(mount.mounted,true);assert.equal(mount.horse,taming.companion);
  assert.ok(Math.hypot(host.player.position.x-120,host.player.position.z-70)<2.5);
  assert.equal(host.quests.find(row=>row.def.id==='golden-king')?.current?.id,'clues');
  for(const [x,z]of [[95,65],[65,55],[20,40],[-20,54],[-60,70],[-83,81],[-103,83]]){
    assert.ok(x!==undefined&&z!==undefined);yield* chapterRideInputs(host,x,z);
  }
  for(let tick=0;tick<120&&Math.abs(mount.body.speed)>.2;tick++)yield [{kind:'player',moveX:0,moveZ:0,yaw:host.player.yaw,commandVersion:1,
    steer:{keyX:0,keyY:0,stickX:0,stickY:-1}}];
  yield [{kind:'script',actorId:'nalati.ride',value:2}];assert.equal(mount.mounted,false);
  assert.ok(Math.hypot(host.player.position.x+106,host.player.position.z-83)<12);
  assert.equal(host.flags.has('clue:1'),false);assert.equal(host.flags.has('dead:golden-king'),false);
}

