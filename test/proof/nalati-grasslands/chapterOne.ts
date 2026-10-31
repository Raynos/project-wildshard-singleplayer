// oxlint-disable-next-line import/no-nodejs-modules -- A failed real input route must refuse its proof.
import assert from 'node:assert/strict';
import type {SimHost} from '../../../src/engine/sim';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapePlan} from '../../../src/sdk/headlessTape';
import {PhysicsRouteCursor} from '../../../src/sdk/headlessJourney';
import {nativeTamingOf} from '../../../src/game/riding/nativeTaming';
import {mountedPlayerOf} from '../../../src/game/riding/native';
import {nalatiCampIntroTape} from './verbTape';
import {nalatiHorsePlainsInputs} from './horsePlainsWalk';
import {createNalatiTamingPilot} from './tamingPilot';

/** Yield the existing trusted route's exact commands, allowing a checked
 * worker reply between ticks. The consumer must commit each yielded tick. */
function* planInputs(host:SimHost,plan:HeadlessTapePlan):Generator<readonly HeadlessCommand[]> {
  for(const segment of plan.segments){
    const cursor=segment.route===undefined?null:new PhysicsRouteCursor(segment.route,{once:true});
    const moving=[...segment.commands];if(cursor!==null)moving.push({kind:'player',moveX:0,moveZ:0,yaw:0});
    for(let tick=0;tick<segment.ticks;tick++){
      if(cursor!==null){
        const p=host.player.position,command=cursor.command([p.x,p.y,p.z],tick);
        if(cursor.complete)break;
        if(cursor.stuck.length>0)throw new Error(`Chapter route stuck ${segment.id}`);
        moving[moving.length-1]=command;
      }
      const prior=host.state.tick;
      yield segment.frames?.[tick]??(cursor===null?segment.commands:moving);
      if(host.scope.disposed||host.scope.disposing||host.state.tick!==prior+1)throw new Error('Chapter input lost its live tick owner');
      if(!host.player.position.toArray().every(Number.isFinite))throw new Error('Nonfinite chapter feet');
    }
    if(cursor!==null&&!cursor.complete){
      const p=host.player.position;cursor.command([p.x,p.y,p.z],segment.ticks);
      if(!cursor.complete)throw new Error(`Chapter route incomplete ${segment.id}`);
    }
  }
}

/** Earn the chapter's actual horse-plains arrival through the camp and bank. */
export function* chapterCampInputs(host:SimHost,spawn:{readonly x:number;readonly z:number}):Generator<readonly HeadlessCommand[]> {
  yield* planInputs(host,nalatiCampIntroTape(spawn));
  assert.ok(host.flags.has('talked:elder'));
  assert.equal(host.quests.find(quest=>quest.def.id==='tulpar')?.current?.id,'tame');
  yield* planInputs(host,{version:1,observe:[],segments:[{id:'leave-camp',ticks:6000,commands:[{kind:'script',actorId:'nalati.talk',value:-1}],route:[
    {x:86.6,z:219.5},{x:91,z:216},{x:94,z:210},{x:95,z:204},{x:88,z:204.5},{x:84.8,z:203.8},{x:83,z:206},
    {x:73,z:206.1},{x:66,z:209.5},{x:60,z:214},{x:40,z:218},{x:20,z:216},{x:0,z:216},
  ]}]});
  yield* nalatiHorsePlainsInputs(host);
  assert.ok(host.flags.has('talked:elder'));assert.equal(host.flags.has('tamed:horse'),false);
}

/** Side gaze avoids staring the original living horse into flight. A moving
 * target is intercepted using observed positions; the public gauge controls
 * each lean. All movement, trust, five rounds and adoption stay native. */
export function* chapterBondInputs(host:SimHost):Generator<readonly HeadlessCommand[]> {
  const original=[...host.entities.values()].find(actor=>actor.kind==='horse'&&actor.variant==='stallion');assert.ok(original);
  const taming=nativeTamingOf(host),mounted=mountedPlayerOf(host);assert.ok(taming);assert.ok(mounted);
  const pilot=createNalatiTamingPilot();
  let wasBreaking=false,balance=0,velocity=0,sampled=0,horseX=original.position.x,horseZ=original.position.z,horseTick=host.state.tick,vx=0,vz=0;
  for(let tick=0;tick<20_000&&taming.phase!=='bonded';tick++){
    const commands=pilot(host,original.entityId);
    if(taming.phase==='wild'){
      const dx=original.position.x-host.player.position.x,dz=original.position.z-host.player.position.z,d=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz)+Math.PI/3;
      if(original.position.x!==horseX||original.position.z!==horseZ){
        const elapsed=(host.state.tick-horseTick)/60;
        vx=(original.position.x-horseX)/elapsed;vz=(original.position.z-horseZ)/elapsed;
        horseX=original.position.x;horseZ=original.position.z;horseTick=host.state.tick;
      }
      const lead=d>3.4?Math.min(2,5/(Math.hypot(vx,vz)||1)):0,ax=dx+vx*lead,az=dz+vz*lead,len=Math.hypot(ax,az);
      const x=d>2.2&&len>0?ax/len:0,z=d>2.2&&len>0?az/len:0,c=Math.cos(yaw),s=Math.sin(yaw);
      commands[0]={kind:'player',moveX:x,moveZ:z,yaw,commandVersion:1,crouch:d<=35,sprint:d>35,
        steer:{keyX:0,keyY:0,stickX:Math.max(-1,Math.min(1,x*c-z*s)),stickY:Math.max(-1,Math.min(1,-x*s-z*c))}};
    }
    if(taming.phase==='breaking'){
      if(!wasBreaking){balance=taming.view.balance;velocity=0;sampled=host.state.tick;}
      if(taming.view.balance!==balance){velocity=(taming.view.balance-balance)/((host.state.tick-sampled)/60);balance=taming.view.balance;sampled=host.state.tick;}
      const lean=Math.max(-1,Math.min(1,balance*8+velocity*2));
      for(let index=0;index<commands.length;index++){
        const command=commands[index];
        if(command?.kind==='script'&&command.actorId==='nalati.taming.lean')commands[index]={...command,value:lean};
      }
    }
    wasBreaking=taming.phase==='breaking';yield commands;
  }
  assert.equal(taming.phase,'bonded');assert.ok(taming.companion);assert.equal(mounted.horse,taming.companion);
  for(let tick=0;tick<60&&!host.flags.has('tamed:horse');tick++)yield [];
  assert.ok(host.flags.has('tamed:horse'));
  assert.equal(host.quests.find(quest=>quest.def.id==='tulpar')?.current?.id,'kokpar');
  assert.equal(host.flags.has('won:kokpar'),false);
}

