import {Signal,Field,Channel,Read,Do} from './generated/nalatiPowerWeapon';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function c(i:i32,id:i32):f64{return Read.field(i,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
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
// Eight native broadphase candidates; bounded scalar work without guest loops.
export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal!=Signal.step)return;const dt=f(Field.dt),count=i32(f(Field.count));
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
