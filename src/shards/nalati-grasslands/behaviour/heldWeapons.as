import {balbalEntry} from './balbal';
import { Signal, Field, Channel, Read, Do } from './generated/nalatiHeldWeapons';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function c(i:i32,id:i32):f64{return Read.field(i,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
@inline function lanceCandidate(i:i32,best:i32,count:i32,on:bool):i32{
 if(best!=0||i>count||!on||c(i,Field.kind)==1)return best;
 const d=c(i,Field.distance),speed=f(Field.speed)+Math.max(0,c(i,Field.closing));
 return c(i,Field.live)!=0&&d>.01&&d-c(i,Field.radius)<=f(Field.lanceReach)&&c(i,Field.height)<=2&&c(i,Field.angle)<=f(Field.cone)&&speed>=f(Field.minSpeed)&&c(i,Field.since)>=f(Field.rehit)?i:best;
}
@inline function pickupCandidate(i:i32,best:i32,count:i32):i32{
 if(best!=0||i>count||c(i,Field.kind)!=1)return best;
 return f(Field.ammo)<f(Field.capacity)&&c(i,Field.distance)<f(Field.pickupRadius)&&c(i,Field.height)<f(Field.pickupHeight)?i:best;
}
@inline function passCandidate(i:i32,best:i32,count:i32):i32{
 if(i>count)return best;const d=c(i,Field.distance);
 return c(i,Field.live)!=0&&d<=f(Field.sense)&&d<(best==0?1e9:c(best,Field.distance))&&c(i,Field.forward)>=f(Field.behind)?i:best;
}
// Three native weapon projections share one stateless ABI-v1 module.
@inline export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal==Signal.polearm)polearm();else if(signal==Signal.blade)blade();else if(signal==Signal.power)power();else if(signal==Signal.step)stealth();else if(signal==Signal.think||signal==Signal.damage)balbal(signal,value,source);
}
// Native observations and impulses; at most one snapshot per 100 ms.
@inline export function polearm():void{
 const dt=f(Field.dt);

  let thrust=f(Field.thrust),wind=f(Field.wind),throwing=f(Field.throwing),queued=f(Field.queued),release=f(Field.release),threw=f(Field.threw),hit=f(Field.hit);
  const held=f(Field.held)!=0,enabled=f(Field.enabled)!=0,ads=f(Field.ads)!=0&&held&&enabled;
  let start:f64=0,dry:f64=0,launch:f64=0;
  if(!held){thrust=-1;wind=-1;release=0;queued=0;}
  if(enabled&&held&&f(Field.attack)!=0&&wind<0&&throwing<0){if(thrust<0){thrust=0;hit=0;queued=0;start=1;}else if(thrust>f(Field.windup))queued=1;}
  if(enabled&&held&&(f(Field.tap)!=0||(ads&&f(Field.previousAds)==0))&&throwing<0){
   if(f(Field.ammo)<=0)dry=1;else {thrust=-1;queued=0;wind=0;release=f(Field.tap);put(Channel.charge,1);}
  }
  if(!ads&&f(Field.previousAds)!=0&&wind>=0)release=1;
  if(wind>=0){wind+=dt;if(release!=0&&wind>=f(Field.throwWindup)){wind=-1;release=0;throwing=0;threw=0;}}
  if(throwing>=0){throwing+=dt;if(threw==0&&throwing>=f(Field.throwRelease)*.5){threw=1;launch=1;}if(throwing>=f(Field.throwRelease)+f(Field.recovery))throwing=-1;}
  let strike:f64=0;
  if(thrust>=0){const before=thrust;thrust+=dt;if(hit==0&&thrust>=f(Field.windup)&&before<=f(Field.activeEnd))strike=1;
   if(thrust>=f(Field.total)){thrust=-1;if(queued!=0){thrust=0;hit=0;queued=0;start=1;}}}
  const lance=held&&f(Field.mounted)!=0&&f(Field.speed)>=f(Field.minSpeed)&&wind<0&&throwing<0;
  let target:f64=0,damage:f64=0,pickup:f64=0,recover:f64=0;
  const count=i32(f(Field.count));let ti:i32=0,pi:i32=0;
  ti=lanceCandidate(1,ti,count,lance);pi=pickupCandidate(1,pi,count);
  ti=lanceCandidate(2,ti,count,lance);pi=pickupCandidate(2,pi,count);
  ti=lanceCandidate(3,ti,count,lance);pi=pickupCandidate(3,pi,count);
  ti=lanceCandidate(4,ti,count,lance);pi=pickupCandidate(4,pi,count);
  ti=lanceCandidate(5,ti,count,lance);pi=pickupCandidate(5,pi,count);
  ti=lanceCandidate(6,ti,count,lance);pi=pickupCandidate(6,pi,count);
  ti=lanceCandidate(7,ti,count,lance);pi=pickupCandidate(7,pi,count);
  ti=lanceCandidate(8,ti,count,lance);pi=pickupCandidate(8,pi,count);
  if(ti!=0){target=c(ti,Field.id);damage=Math.round(f(Field.baseDamage)+f(Field.speedDamage)*(f(Field.speed)+Math.max(0,c(ti,Field.closing))));}
  if(pi!=0){pickup=c(pi,Field.id);recover=c(pi,Field.random)<f(Field.survive)?1:0;}
  put(Channel.thrust,thrust);put(Channel.wind,wind);put(Channel.throwing,throwing);put(Channel.queued,queued);put(Channel.release,release);put(Channel.threw,threw);put(Channel.hit,hit);
  put(Channel.previousAds,ads?1:0);put(Channel.start,start);put(Channel.dry,dry);put(Channel.launch,launch);put(Channel.strike,strike);put(Channel.lance,lance?1:0);put(Channel.target,target);put(Channel.damage,damage);put(Channel.pickup,pickup);put(Channel.recover,recover);

}

// Native observations and impulses; at most one snapshot per 100 ms.
@inline export function blade():void{
 const dt=f(Field.dt);

  let cooldown=Math.max(0,f(Field.cooldown)-dt),chain=Math.max(0,f(Field.chain)-dt),links=chain>0?f(Field.links):0;
  if(f(Field.hits)>0){links=chain>0?links+f(Field.hits):f(Field.hits);chain=f(Field.chainWindow);}
  let side:f64=0,damage:f64=0;
  if(f(Field.attack)!=0&&cooldown<=0&&f(Field.charging)==0&&f(Field.mounted)!=0){
   let selected:i32=0;const count=i32(f(Field.count));
   selected=passCandidate(1,selected,count);
   selected=passCandidate(2,selected,count);
   selected=passCandidate(3,selected,count);
   selected=passCandidate(4,selected,count);
   selected=passCandidate(5,selected,count);
   selected=passCandidate(6,selected,count);
   selected=passCandidate(7,selected,count);
   selected=passCandidate(8,selected,count);
   if(selected!=0)side=c(selected,Field.side);
   if(side==0)side=f(Field.look)>0?-1:1;
   damage=Math.round(f(Field.baseDamage)*(1+Math.max(0,f(Field.speed))/f(Field.speedDivisor))*Math.min(f(Field.chainMax),1+f(Field.chainStep)*links));cooldown=f(Field.passCooldown);
  }
  put(Channel.cooldown,cooldown);put(Channel.chain,chain);put(Channel.links,links);put(Channel.side,side);put(Channel.damage,damage);

}

@inline function primary(i:i32,best:i32,count:i32,range:f64,width:f64):i32{
 if(i>count||c(i,Field.live)==0)return best;const along=c(i,Field.along);
 return along>=.5&&along<=range&&c(i,Field.side)<=width+c(i,Field.radius)&&(best==0||along<c(best,Field.along))?i:best;
}
@inline function distance(a:i32,b:i32):f64{const x=c(a,Field.x)-c(b,Field.x),y=c(a,Field.y)-c(b,Field.y),z=c(a,Field.z)-c(b,Field.z);return x*x+y*y+z*z;}
@inline function candidate(i:i32,best:i32,count:i32,from:i32,first:i32,skip:i32,radius:f64):i32{
 if(i>count||i==from||i==first||i==skip||c(i,Field.live)==0)return best;
 const d=distance(i,from);return d<radius*radius&&(best==0||d<distance(best,from))?i:best;
}
@inline function arc(count:i32,from:i32,first:i32,skip:i32,radius:f64):i32{
 if(from==0)return 0;let best:i32=0;
 best=candidate(1,best,count,from,first,skip,radius);best=candidate(2,best,count,from,first,skip,radius);best=candidate(3,best,count,from,first,skip,radius);best=candidate(4,best,count,from,first,skip,radius);
 best=candidate(5,best,count,from,first,skip,radius);best=candidate(6,best,count,from,first,skip,radius);best=candidate(7,best,count,from,first,skip,radius);return candidate(8,best,count,from,first,skip,radius);
}
@inline function area(i:i32,count:i32,x:f64,z:f64,radius:f64):i32{
 if(i>count||c(i,Field.live)==0)return 0;const dx=c(i,Field.x)-x,dz=c(i,Field.z)-z,r=radius+.6*c(i,Field.scale);return dx*dx+dz*dz<=r*r?1<<(i-1):0;
}

@inline export function power():void{
 const dt=f(Field.dt),count=i32(f(Field.count));
 let call=f(Field.call),action:f64=0,detonate:f64=0;
 if(f(Field.swing)!=0){if(f(Field.mounted)!=0&&f(Field.speed)>=f(Field.gallopMin))action=1;else if(f(Field.mounted)==0&&f(Field.heavy)!=0){action=2;call=0;}}
 if(call>=0){call+=dt;if(call>=f(Field.callTime)){call=-1;detonate=1;}}
 const storm=f(Field.storm)!=0,mul=storm?f(Field.stormMultiplier):1;
 put(Channel.action,action);put(Channel.call,call);put(Channel.detonate,detonate);put(Channel.damage,Math.round(f(Field.crescentDamage)*mul));put(Channel.callDamage,Math.round(f(Field.callDamage)*mul));
 let target:i32=0,arc1:i32=0,arc2:i32=0;
 if(action==1){const range=f(Field.crescentRange),width=f(Field.crescentWidth),radius=f(Field.arcRadius);
  target=primary(1,target,count,range,width);target=primary(2,target,count,range,width);target=primary(3,target,count,range,width);target=primary(4,target,count,range,width);
  target=primary(5,target,count,range,width);target=primary(6,target,count,range,width);target=primary(7,target,count,range,width);target=primary(8,target,count,range,width);
  const arcs=storm?f(Field.stormArcs):f(Field.clearArcs);if(arcs>=1)arc1=arc(count,target,target,0,radius);if(arcs>=2)arc2=arc(count,arc1,target,arc1,radius);
 }
 put(Channel.target,target);put(Channel.arc1,arc1);put(Channel.arc2,arc2);
 let mask:i32=0;if(detonate!=0){const x=f(Field.callX),z=f(Field.callZ),radius=f(Field.callRadius);mask=area(1,count,x,z,radius)|area(2,count,x,z,radius)|area(3,count,x,z,radius)|area(4,count,x,z,radius)|area(5,count,x,z,radius)|area(6,count,x,z,radius)|area(7,count,x,z,radius)|area(8,count,x,z,radius);}
 put(Channel.aoe0,mask);
}

// Long-grass hysteresis, crouch latch and awareness observations, at <= 10 Hz.
@inline export function stealth():void {
 const dt=f(Field.dt),blocked=f(Field.blocked)!=0,long=!blocked&&f(Field.grass)>=f(Field.longGrass);
 const on=long?f(Field.on)+dt:0,off=long?0:f(Field.off)+dt;
 const inLong=!blocked&&(f(Field.inLong)!=0?off<f(Field.outAfter):on>=f(Field.inAfter));
 const can=!blocked&&(inLong||f(Field.forced)!=0);
 let latched=f(Field.latched)!=0;
 if(f(Field.toggle)!=0&&(can||latched))latched=!latched;
 if(!can||f(Field.sprint)!=0||f(Field.jump)!=0)latched=false;
 const crouched=f(Field.crouched)!=0;
 const cover=Math.min(1,Math.max(0,(f(Field.grass)-f(Field.floor))/( (crouched?f(Field.low):f(Field.high))-f(Field.floor))));
 let level:f64=0,quiet=true,noticed=false,tx:f64=0,tz:f64=0,nearest:f64=1e9;
 const count=i32(f(Field.count)),px=f(Field.px),pz=f(Field.pz);
 { const i:i32=1;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=2;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=3;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=4;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=5;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=6;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=7;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}
{ const i:i32=8;if(i<=count){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d<=f(Field.sense)){
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }}}

 const context=f(Field.practice)==0&&(inLong||crouched);
 const state=!context?0:level>=1?4:noticed?3:crouched&&cover>=f(Field.hiddenCover)&&quiet?2:1;
 put(Channel.on,on);put(Channel.off,off);put(Channel.inLong,inLong?1:0);put(Channel.can,can?1:0);put(Channel.latched,latched?1:0);
 put(Channel.cover,cover);put(Channel.threat,Math.min(1,Math.max(0,level)));put(Channel.x,tx);put(Channel.z,tz);put(Channel.state,state);
}

@inline export function balbal(signal:i32,value:f64,source:i32):void{balbalEntry(signal,value,source);}
