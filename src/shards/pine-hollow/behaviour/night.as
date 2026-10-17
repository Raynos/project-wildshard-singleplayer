import { Actor, Spawn, Field, Flag, Cue, Channel, Move, Read, List, Do, State, Params, Clock } from './generated/pineNight';

// Placement owns the original Mulberry32 stream; actor recipe rolls remain in the native roster.
@inline function random(): f64 {
  let t = u32(State.rng) + 0x6d2b79f5; State.rng = f64(t);
  t = (t ^ (t >>> 15)) * (t | 1); t ^= t + (t ^ (t >>> 7)) * (t | 61);
  return f64(t ^ (t >>> 14)) / 4294967296;
}
@inline function actor(i:i32):i32 {
  if(i===0)return Actor.roam0;if(i===1)return Actor.roam1;if(i===2)return Actor.roam2;return Actor.roam3;
}
@inline function flee(i:i32):f64 {
  if(i===0)return State.flee0;if(i===1)return State.flee1;if(i===2)return State.flee2;return State.flee3;
}
@inline function setFlee(i:i32,n:f64):void {
  if(i===0)State.flee0=n;else if(i===1)State.flee1=n;else if(i===2)State.flee2=n;else State.flee3=n;
}
@inline function woke(i:i32):bool { if(i===0)return State.woke0;if(i===1)return State.woke1;return State.woke2; }
@inline function setWoke(i:i32):void {if(i===0)State.woke0=true;else if(i===1)State.woke1=true;else State.woke2=true;}
@inline function raceActor(i:i32):i32 {if(i===0)return Actor.race0;if(i===1)return Actor.race1;return Actor.race2;}
@inline function count(n:i32):i32 {return i32(popcnt<u32>(u32(n)));}
@inline function spawnRow(slot:i32,kind:i32):i32 {
  if(slot===0)return kind===0?Spawn.roam0Elk:Spawn.roam0Boar;
  if(slot===1)return kind===0?Spawn.roam1Elk:Spawn.roam1Boar;
  if(slot===2)return kind===0?Spawn.roam2Elk:Spawn.roam2Boar;
  return kind===0?Spawn.roam3Elk:Spawn.roam3Boar;
}
@inline function roamer(player:i32,force:bool):void {
  let slot:i32=0;while(slot<4&&(State.roam&(1<<slot))!==0)slot++;
  if(slot>=4)return;
  const px=Read.x(player),pz=Read.z(player);
  for(let tries:i32=0;tries < 12;tries++) {
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*Params.radius;
    Read.radial(angle);
    const x=Params.regionX+List.at(0)*Params.axisX*radius,z=Params.regionZ+List.at(1)*Params.axisZ*radius;
    const distance=Math.sqrt((x-px)*(x-px)+(z-pz)*(z-pz));
    const low:f64=force?18:45,high:f64=force?60:150;
    if(distance < low || distance > high)continue;
    if(Math.sqrt((x-Params.excludeX)*(x-Params.excludeX)+(z-Params.excludeZ)*(z-Params.excludeZ))<Params.excludeR)continue;
    if(Math.abs(x)>Params.bound||Math.abs(z)>Params.bound)continue;
    Read.groundHeight(x,z);if(List.at(0)<Params.water)continue;
    const a=actor(slot);Do.field(a,Field.x,x);Do.field(a,Field.z,z);Do.spawn(spawnRow(slot,count(State.roam)%2));
    Do.cue(Cue.call,a);State.roam|=1<<slot;setFlee(slot,0);return;
  }
}
export function onStart():void {}
export function onTick(_dt:f64):void {
  const dt=f64(Clock.tick-State.lastTick)/60;State.lastTick=Clock.tick;
  const player=Read.nearestPlayer(Actor.roam0),night=Read.field(Actor.roam0,Field.night);
  for(let i:i32=0;i<4;i++) {
    if((State.roam&(1<<i))===0)continue;const a=actor(i);
    if(!Read.alive(a)){State.roam&=~(1<<i);continue;}
    let age=flee(i);
    if(age>0){if(!Read.moving(a))Do.move(a,Move.escape,player);age+=dt;if(age>3.5){Do.cue(Cue.burst,a);Do.despawn(a);State.roam&=~(1<<i);}else setFlee(i,age);}
    else if(night<0.35){Do.field(a,Field.scripted,1);Do.move(a,Move.escape,player);setFlee(i,0.01);Do.cue(Cue.flee,a);}
  }
  for(let i:i32=0;i<3;i++) {
    if((State.race&(1<<i))===0||woke(i))continue;const a=raceActor(i);
    if(Read.alive(a)&&!Read.moving(a))Do.move(a,Move.listen);
    if(Read.alive(a)&&(Read.distance(a,player)<20||Read.hpShare(a)<1)){
      Do.stop(a);Do.field(a,Field.scripted,0);setWoke(i);Do.cue(Cue.wake,a);
    }
  }
  const accumulated=State.acc+dt,due=accumulated+0.000000001>=1;
  State.acc=due?0:accumulated;
  const force=Read.field(Actor.roam0,Field.force)>0;
  if(due||force) {
    State.acc=0;
    if(State.race!==0){let alive:bool=false;for(let i:i32=0;i<3;i++)if(Read.alive(raceActor(i)))alive=true;
      if(!alive){State.race=0;Do.flag(Flag.done,true);}}
    else if(Read.flag(Flag.asked)&&!Read.flag(Flag.done)&&(force||(night>0.5&&Math.sqrt((Read.x(player)-Params.millX)*(Read.x(player)-Params.millX)+(Read.z(player)-Params.millZ)*(Read.z(player)-Params.millZ))<Params.raceRange))){
      Do.spawn(Spawn.race0);Do.spawn(Spawn.race1);Do.spawn(Spawn.race2);
      for(let i:i32=0;i<3;i++){const a=raceActor(i);Do.field(a,Field.scripted,1);Do.field(a,Field.lookWeight,0);Do.move(a,Move.listen);}
      State.race=7;State.woke0=false;State.woke1=false;State.woke2=false;
    }
    for(let i:i32=0;i<4;i++){const a=actor(i);if((State.roam&(1<<i))!==0&&flee(i)===0&&Read.distance(a,player)>230){Do.despawn(a);State.roam&=~(1<<i);}}
    const x=(Read.x(player)-Params.regionX)/(Params.axisX*Params.regionScale),z=(Read.z(player)-Params.regionZ)/(Params.axisZ*Params.regionScale);
    if(count(State.roam)<i32(Read.field(Actor.roam0,Field.limit))&&(force||(night>0.55&&x*x+z*z<1)))roamer(player,force);
    if(force)Do.field(Actor.roam0,Field.force,Read.field(Actor.roam0,Field.force)-1);
  }
  Do.channel(Channel.count,f64(count(State.roam)+count(State.race)));
}
