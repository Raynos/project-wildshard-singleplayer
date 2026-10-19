import { Signal, Field, Channel, Read, Do } from './generated/nalatiStealth';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Long-grass hysteresis, crouch latch and awareness observations, at <= 10 Hz.
export function onSignal(signal:i32,value:f64,source:i32):void {
 if(signal!=Signal.step)return;
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
 for(let i:i32=1;i<=count;i++){
  const x=Read.field(i,Field.x),z=Read.field(i,Field.z),dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);
  if(d>f(Field.sense))continue;
  const awareness=Read.field(i,Field.awareness),hunting=Read.field(i,Field.hunting)!=0,lv=hunting?Math.max(1,awareness/Read.field(i,Field.alert)):awareness/Read.field(i,Field.alert);
  if(awareness>=f(Field.notice)||hunting){noticed=true;if(d<f(Field.quiet))quiet=false;}
  if(lv>level||(lv==level&&d<nearest)){level=lv;tx=x;tz=z;nearest=d;}
 }
 const context=f(Field.practice)==0&&(inLong||crouched);
 const state=!context?0:level>=1?4:noticed?3:crouched&&cover>=f(Field.hiddenCover)&&quiet?2:1;
 put(Channel.on,on);put(Channel.off,off);put(Channel.inLong,inLong?1:0);put(Channel.can,can?1:0);put(Channel.latched,latched?1:0);
 put(Channel.cover,cover);put(Channel.threat,Math.min(1,Math.max(0,level)));put(Channel.x,tx);put(Channel.z,tz);put(Channel.state,state);
}
