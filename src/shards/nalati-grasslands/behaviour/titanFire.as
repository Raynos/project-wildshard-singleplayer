import { Signal, Field, Channel, Read, Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Event projections; retained state belongs to the native binding at <= 10 Hz.
@inline export function fireEntry(signal:i32,value:f64,source:i32):void {
if(signal==Signal.fieldClock){
 const t=f(Field.t)-f(Field.dt),spread=t<=0;put(Channel.t,spread?.25:t);put(Channel.spread,spread?1:0);
} else if(signal==Signal.fieldIgnite){
 const dx=f(Field.x)-f(Field.cx),dz=f(Field.z)-f(Field.cz),r=f(Field.radius)-2;
 put(Channel.burn,f(Field.mode)==0&&dx*dx+dz*dz<r*r?f(Field.burn)*(.8+Read.random()*.4):0);
} else if(signal==Signal.ignite){put(Channel.burn,f(Field.burn)*(.8+Read.random()*.4));} else if(signal==Signal.fire){
    const burn=f(Field.burn)-f(Field.dt);let mask:i32=0;
    if(burn>0&&f(Field.spread)>0){
      { const i:i32=1;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=2;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=3;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=4;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=5;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=6;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=7;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}
{ const i:i32=8;if(i<=i32(f(Field.count))&&Read.field(i,Field.mode)==0){
 const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
 if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
}}

    }
    put(Channel.burn,burn);put(Channel.mask,mask);
  } else if(signal==Signal.fireContact||signal==Signal.fieldContact){
 const cd=f(Field.cd)-f(Field.dt),hurt=f(Field.hit)>0&&cd<=0;
 let near=false;
 if(signal==Signal.fireContact)near=f(Field.open)>0;
 else if(f(Field.mounted)>0){
  if(1<=i32(f(Field.count))&&Read.field(1,Field.hit)>0)near=true;
  if(2<=i32(f(Field.count))&&Read.field(2,Field.hit)>0)near=true;
  if(3<=i32(f(Field.count))&&Read.field(3,Field.hit)>0)near=true;
  if(4<=i32(f(Field.count))&&Read.field(4,Field.hit)>0)near=true;
  if(5<=i32(f(Field.count))&&Read.field(5,Field.hit)>0)near=true;
  if(6<=i32(f(Field.count))&&Read.field(6,Field.hit)>0)near=true;
  if(7<=i32(f(Field.count))&&Read.field(7,Field.hit)>0)near=true;
  if(8<=i32(f(Field.count))&&Read.field(8,Field.hit)>0)near=true;
 }
 put(Channel.cd,hurt?.5:cd);put(Channel.hurt,hurt?f(Field.amount)*.5:0);put(Channel.speed,near?-10*f(Field.dt):0);
}

}
