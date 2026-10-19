import { Signal, Field, Channel, Read, Do } from './generated/nalatiPastureWind';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
@inline function length2(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
// Event projections; retained state belongs to the native binding at <= 10 Hz.
@inline export function windEntry(signal:i32,value:f64,source:i32):void {
if(signal==Signal.whirl){
    const dt=f(Field.dt),cx=f(Field.cx),cz=f(Field.cz),radius=f(Field.radius)-8;
    let x=f(Field.x),z=f(Field.z),vx=f(Field.vx),vz=f(Field.vz),cd=f(Field.cd)-(f(Field.hit)>0?dt:0);
    const angle=Math.sin(f(Field.t)*.3+f(Field.index)*2)*1.2+Math.atan2(cz-z,cx-x)*.35,k=Math.min(1,dt*.6);
    vx+=(Math.cos(angle)*4.2+f(Field.wx)*1.5-vx)*k;vz+=(Math.sin(angle)*4.2+f(Field.wz)*1.5-vz)*k;x+=vx*dt;z+=vz*dt;
    const d=length2(x-cx,z-cz);if(d>radius){x=cx+(x-cx)*radius/d;z=cz+(z-cz)*radius/d;}
    const hurt=f(Field.open)>0&&cd<=0&&length2(f(Field.px)-x,f(Field.pz)-z)<f(Field.flank);
    put(Channel.x,x);put(Channel.z,z);put(Channel.vx,vx);put(Channel.vz,vz);put(Channel.cd,hurt?2:cd);put(Channel.hurt,hurt?1:0);
  }
}
