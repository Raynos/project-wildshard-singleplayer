import { Signal, Field, Channel, Read, Do } from './generated/nalatiBladeWeapon';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function c(i:i32,id:i32):f64{return Read.field(i,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
// Native observations and impulses; at most one snapshot per 100 ms.
export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal!=Signal.step)return;const dt=f(Field.dt);

  let cooldown=Math.max(0,f(Field.cooldown)-dt),chain=Math.max(0,f(Field.chain)-dt),links=chain>0?f(Field.links):0;
  if(f(Field.hits)>0){links=chain>0?links+f(Field.hits):f(Field.hits);chain=f(Field.chainWindow);}
  let side:f64=0,damage:f64=0,best:f64=1e9;
  if(f(Field.attack)!=0&&cooldown<=0&&f(Field.charging)==0&&f(Field.mounted)!=0){
   for(let i:i32=1;i<=i32(f(Field.count));i++){const d=c(i,Field.distance);if(c(i,Field.live)!=0&&d<=f(Field.sense)&&d<best&&c(i,Field.forward)>=f(Field.behind)){best=d;side=c(i,Field.side);}}
   if(side==0)side=f(Field.look)>0?-1:1;
   damage=Math.round(f(Field.baseDamage)*(1+Math.max(0,f(Field.speed))/f(Field.speedDivisor))*Math.min(f(Field.chainMax),1+f(Field.chainStep)*links));cooldown=f(Field.passCooldown);
  }
  put(Channel.cooldown,cooldown);put(Channel.chain,chain);put(Channel.links,links);put(Channel.side,side);put(Channel.damage,damage);

}
