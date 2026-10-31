import {expect,test} from 'vitest';
import {Vector3} from 'three';
import {Scope} from '../src/engine/app/scope';
import {Rng} from '../src/engine/core/rng';
import {PhysicsRouteCursor} from '../src/sdk/headlessJourney';
import type {BossPresentation} from '../src/engine/ai/BossBrain';
import {parseBossProfile} from '../src/format/bossProfiles';
import {ArenaRoomGround} from '../src/game/boss/arenaGround';
import type {PhasedBossBody,PhasedBossBrain} from '../src/game/plugin/bossPhase';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {titanPrograms} from './fixtures/titanInlineWitness';
import king from './fixtures/nalati-goldenKing-original.json' with {type:'json'};
import room from '../src/shards/nalati-grasslands/data/bossArenaRoom.json' with {type:'json'};
import {KingContinuation,type KingContinuationRows} from './fixtures/nalati-king-continuation';
import {kingEntryPoint,kingWalkingRoute} from './proof/nalati-grasslands/king';

const profile=(()=>{const p=parseBossProfile(king.page.profile);if(p.pattern!=='arena')throw new Error('Missing original King');return p;})();
const row=profile.fight;
const rows:KingContinuationRows={room,profile,entrance:{x:200,y:2,z:200,facing:0},encounter:{definition:king.encounter,portal:king.portal}};
// Unplayed kernel bodies; this unit harness never supplies a native tape,
// encounter checkpoint, earned fact or author-controlled damage command.
class Body implements PhasedBossBody {
  readonly position=new Vector3();readonly lookTarget=new Vector3();readonly mem:Record<string,number>={};
  yaw=0;hp=1000;readonly maxHp=1000;hidden=false;readonly scale=1;lookWeight=0;
  attackT=-1;attackLength=1;speed=0;turn=0;
  constructor(readonly id:string){}
  get alive():boolean{return this.hp>0;}
  get attackPhase():number{return this.attackT<0?-1:this.attackT/this.attackLength;}
  startAttack(seconds:number):void{this.attackT=0;this.attackLength=seconds;}
  cancelAttack():void{this.attackT=-1;}
  setMotion(yaw:number,speed:number,turn=1):void{this.yaw=yaw;this.speed=speed;this.turn=turn;}
  place(x:number,z:number,yaw:number):void{this.position.set(x,row.origin.y,z);this.yaw=yaw;}
  headWorld(out:Vector3):Vector3{return out.copy(this.position).add(new Vector3(0,2,0));}
  applyDamage(amount:number):boolean{this.hp=Math.max(0,this.hp-amount);return !this.alive;}
  snapshot(){return {id:this.id,position:this.position.toArray(),look:this.lookTarget.toArray(),mem:{...this.mem},
    yaw:this.yaw,hp:this.hp,hidden:this.hidden,lookWeight:this.lookWeight,attackT:this.attackT,attackLength:this.attackLength,speed:this.speed,turn:this.turn};}
  static restore(saved:ReturnType<Body['snapshot']>):Body {
    const body=new Body(saved.id);body.position.fromArray(saved.position);body.lookTarget.fromArray(saved.look);Object.assign(body.mem,saved.mem);
    body.yaw=saved.yaw;body.hp=saved.hp;body.hidden=saved.hidden;body.lookWeight=saved.lookWeight;
    body.attackT=saved.attackT;body.attackLength=saved.attackLength;body.speed=saved.speed;body.turn=saved.turn;return body;
  }
}
function world(){
  const scope=new Scope('unplayed-king'),rng=new Rng(357),ground=new ArenaRoomGround(room),bodies=new Map<string,Body>();
  const brains=new Map<Body,PhasedBossBrain<Body>>(),events:unknown[][]=[],population={calm:false};
  const player={position:new Vector3(200,2,202),velocity:new Vector3(),yaw:0,pitch:0};
  let scale=1,sealed=false,time=0;
  const ui:BossPresentation={update:()=>undefined,barShown:false,hideBar:()=>undefined,hideNameCard:()=>undefined,hideReward:()=>undefined,
    showRetry:()=>undefined,showNameCard:()=>undefined,setSkip:()=>undefined,showBar:()=>undefined,setHp:()=>undefined,setShield:()=>undefined,setPhase:()=>undefined};
  const spawn=(x:number,z:number):Body=>{const b=new Body(`body-${bodies.size}`);b.place(x,z,0);bodies.set(b.id,b);return b;};
  const owner=new KingContinuation(rows,{scope,ground,player,population,moveScale:{read:()=>scale,write:v=>{scale=v;}},
    fight:{arena:{floorAt:(x,z)=>ground.floorAt(x,z),pile:(x,z,r,h,cap)=>{ground.addSand(x,z,r,h,cap);},clear:()=>{ground.clearSand();},
      drain:(dt,rate)=>{ground.drainSand(dt,rate);},inArena:p=>ground.inChamber(p)&&p.z<king.page.maxZ,seal:on=>{sealed=on;events.push(['seal',on]);}},
      body:{spawn,retire:b=>{b.hidden=true;events.push(['retire',b.id]);},bind:(b,brain)=>{brains.set(b,brain);events.push(['bind',b.id]);},ready:()=>undefined},
      spawnAdd:(_i,x,z,yaw)=>{const b=spawn(x,z);b.yaw=yaw;return b;},player:{position:player.position,dash:(...args)=>{events.push(['dash',...args]);}},
      hurt:(...args)=>{events.push(['hurt',...args]);},cut:()=>false,hazard:()=>undefined,rng:()=>rng.next(),feed:line=>{events.push(['feed',line]);},
      views:Object.fromEntries(row.views.map(id=>[id,(...values:number[])=>{events.push([id,...values]);}])),
      rewardPoint:()=>new Vector3().fromArray(king.page.reward),respawnPoint:()=>({pos:new Vector3().fromArray(king.page.respawn),yaw:king.page.yaw})},
    boss:{player,lockInput:on=>{events.push(['lock',on]);},respawn:()=>{events.push(['respawn']);},skipHeld:()=>false,faceToward:()=>undefined,
      spawnReward:()=>{events.push(['reward']);},persist:saved=>{events.push(['save',{...saved}]);}},ui,saved:{defeated:false,rewardTaken:false,kills:0},
    identify:b=>b.id,find:id=>bodies.get(id)??null,publishPlayer:()=>undefined,present:on=>{events.push(['present',on]);},sealed:()=>sealed,
    advanceRoom:dt=>{ground.pace(dt);}},ReturnProgram.page(titanPrograms.rules));
  const step=():void=>{
    time+=1/60;
    for(const b of bodies.values()){
      if(b.hidden)continue;
      if(b.attackT>=0)b.attackT+=1/60;
      b.position.x+=Math.sin(b.yaw)*b.speed/60;b.position.z+=Math.cos(b.yaw)*b.speed/60;
      const brain=brains.get(b);brain?.think(b,{dt:1/60,player:player.position});brain?.act(b,{player:player.position});
    }
    owner.update(1/60,time);
  };
  const enter=():void=>{
    for(let i=0;i<60&&!owner.observe().inside;i++)step();
    expect(owner.observe().inside).toBe(true);
    player.position.set(room.origin.x,room.origin.y,room.origin.z+8);
    for(let i=0;i<300&&owner.observe().state!=='fight';i++)step();
    expect(owner.observe().state).toBe('fight');
  };
  return {owner,scope,rng,ground,bodies,events,population,player,step,enter,
    copyOwners:(other:ReturnType<typeof owner.snapshot>,source:{ground:ArenaRoomGround;player:typeof player;rng:Rng;bodies:Map<string,Body>})=>{
      scale=other.locked?0:other.slow?rows.encounter.portal.slow:1;sealed=other.sealed;population.calm=other.portal.inside;
      ground.restore(source.ground.snapshot());player.position.copy(source.player.position);player.velocity.copy(source.player.velocity);player.yaw=source.player.yaw;player.pitch=source.player.pitch;
      rng.restore(source.rng.snapshot());for(const b of source.bodies.values())bodies.set(b.id,Body.restore(b.snapshot()));
    }};
}
test('an unopened King remains closed without actors, entropy or encounter effects',()=>{
  const a=world(),b=world();try{
    expect(a.bodies.size).toBe(0);expect(a.events).toEqual([]);expect(a.owner.observe().body).toBeNull();
    const before=b.rng.snapshot();b.owner.restore(a.owner.snapshot());expect(b.owner.snapshot()).toEqual(a.owner.snapshot());
    expect(b.bodies.size).toBe(0);expect(b.events).toEqual([]);expect(b.rng.snapshot()).toEqual(before);
    expect(b.owner.onPlayerDeath()).toBe(false);expect(b.owner.takeReward()).toBe(false);
  }finally{a.scope.dispose();b.scope.dispose();}
});
test('the original portal earns entry, locks the intro and lends detached observations',()=>{
  const a=world();try{
    a.enter();expect(a.population.calm).toBe(true);expect(a.events).toContainEqual(['present',true]);
    expect(a.events).toContainEqual(['lock',true]);expect(a.events).toContainEqual(['lock',false]);
    const read=a.owner.observe(),body=read.body;expect(body).not.toBeNull();if(body===null)throw new Error('Missing real kernel body');
    Reflect.set(body,'hp',-1);Reflect.set(body.position,0,9999);expect(a.owner.observe().body?.hp).toBe(1000);
    expect(a.owner.observe().body?.position[0]).not.toBe(9999);
  }finally{a.scope.dispose();}
});
test('restoring a fighting King is quiet and retains every original kernel clock in its suffix',()=>{
  const a=world(),b=world();try{
    a.enter();for(let i=0;i<180;i++)a.step();
    const saved=a.owner.snapshot();b.copyOwners(saved,a);const random=b.rng.snapshot();b.events.length=0;
    b.owner.restore(saved);expect(b.events).toEqual([['bind',saved.fight.king]]);expect(b.rng.snapshot()).toEqual(random);
    expect(b.owner.snapshot()).toEqual(saved);a.events.length=0;b.events.length=0;
    for(let i=0;i<240;i++){
      a.step();b.step();expect(b.owner.snapshot()).toEqual(a.owner.snapshot());expect(b.owner.observe()).toEqual(a.owner.observe());
      expect(b.rng.snapshot()).toEqual(a.rng.snapshot());expect(b.ground.snapshot()).toEqual(a.ground.snapshot());expect(b.events).toEqual(a.events);
      a.events.length=0;b.events.length=0;
    }
  }finally{a.scope.dispose();b.scope.dispose();}
});
test('foreign continuations and replaced physical owners refuse before any restore bind',()=>{
  const a=world();try{
    a.enter();const saved=a.owner.snapshot(),random=a.rng.snapshot();a.events.length=0;
    for(const value of [{...saved,recipe:'foreign'},{...saved,boss:{...saved.boss,phase:99}},
      {...saved,fight:{...saved.fight,king:'missing'}},{...saved,locked:!saved.locked},{...saved,sealed:!saved.sealed}]){
      expect(()=>a.owner.restore(value)).toThrow();expect(a.owner.snapshot()).toEqual(saved);expect(a.rng.snapshot()).toEqual(random);expect(a.events).toEqual([]);
    }
  }finally{a.scope.dispose();}
  expect(()=>a.owner.observe()).toThrow('retired');expect(()=>a.owner.snapshot()).toThrow('retired');
});

test.each([-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI])('the walking point satisfies the actual authored door at facing %s',facing=>{
  const entrance={x:200,y:2,z:200,facing},point=kingEntryPoint(entrance),program=ReturnProgram.page(titanPrograms.rules);
  const answer=program.project(rows.encounter.portal.signal,{px:point.x,py:entrance.y,pz:point.z,y:entrance.y,ex:entrance.x,ey:entrance.y,ez:entrance.z,
    facing,volume:0,inside:0,corridor:0,land:rows.encounter.portal.end,engaged:0,sand:0,floor:140,cy:140});
  expect(answer['enter']).toBe(1);
});

test('only the original health threshold earns the retry checkpoint and its owned reset',()=>{
  const a=world();try{
    a.enter();const id=a.owner.observe().body?.id,body=id===undefined?undefined:a.bodies.get(id);if(body===undefined)throw new Error('Missing unplayed kernel actor');
    // Controlled unit damage is not an input or a native continuation loan.
    body.applyDamage(450);a.step();expect(a.owner.observe().phase).toBe(1);
    a.events.length=0;expect(a.owner.onPlayerDeath()).toBe(true);
    const saved=a.owner.snapshot();expect(saved.boss.attempts).toBe(2);expect(saved.boss.checkpoint).toBe(1);
    expect(saved.boss.saved.defeated).toBe(false);expect(saved.boss.saved.kills).toBe(0);
    expect(a.events).toContainEqual(['respawn']);expect(a.events.some(event=>event[0]==='save')).toBe(false);
  }finally{a.scope.dispose();}
});

test('the owned room constructs its real hidden body once before portal arm',()=>{
  const a=world();try{
    const before=a.rng.snapshot();a.owner.open();expect(a.bodies.size).toBe(1);expect(a.owner.observe().state).toBe('dormant');
    expect(a.events).toContainEqual(['present',false]);expect(a.rng.snapshot()).not.toEqual(before);
    expect(()=>a.owner.open()).toThrow('already opened');
    a.enter();expect(a.bodies.size).toBe(1);expect(a.owner.observe().state).toBe('fight');
  }finally{a.scope.dispose();}
});

test('King walking supplies both observed feet and destination to the physical cursor',()=>{
  const from={x:-142,z:83},to=kingEntryPoint({x:-172.1,z:75,facing:-Math.PI/2});
  const cursor=new PhysicsRouteCursor(kingWalkingRoute(from,to),{once:true});
  const command=cursor.command([from.x,35,from.z],0);
  expect(cursor.complete).toBe(false);expect(cursor.stuck).toEqual([]);
  expect([command.moveX,command.moveZ,command.yaw].every(Number.isFinite)).toBe(true);
});
