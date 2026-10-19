import { Signal, Field, Channel, Read, Do } from './generated/nalatiPolearmWeapon';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function c(i:i32,id:i32):f64{return Read.field(i,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
// Native observations and impulses; at most one snapshot per 100 ms.
export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal!=Signal.step)return;const dt=f(Field.dt);

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
  for(let i:i32=1;i<=i32(f(Field.count));i++){
   if(c(i,Field.kind)==1){if(pickup==0&&f(Field.ammo)<f(Field.capacity)&&c(i,Field.distance)<f(Field.pickupRadius)&&c(i,Field.height)<f(Field.pickupHeight)){pickup=c(i,Field.id);recover=c(i,Field.random)<f(Field.survive)?1:0;}continue;}
   const d=c(i,Field.distance),speed=f(Field.speed)+Math.max(0,c(i,Field.closing));
   if(lance&&target==0&&c(i,Field.live)!=0&&d>.01&&d-c(i,Field.radius)<=f(Field.lanceReach)&&c(i,Field.height)<=2&&c(i,Field.angle)<=f(Field.cone)&&speed>=f(Field.minSpeed)&&c(i,Field.since)>=f(Field.rehit)){target=c(i,Field.id);damage=Math.round(f(Field.baseDamage)+f(Field.speedDamage)*speed);}
  }
  put(Channel.thrust,thrust);put(Channel.wind,wind);put(Channel.throwing,throwing);put(Channel.queued,queued);put(Channel.release,release);put(Channel.threw,threw);put(Channel.hit,hit);
  put(Channel.previousAds,ads?1:0);put(Channel.start,start);put(Channel.dry,dry);put(Channel.launch,launch);put(Channel.strike,strike);put(Channel.lance,lance?1:0);put(Channel.target,target);put(Channel.damage,damage);put(Channel.pickup,pickup);put(Channel.recover,recover);

}
