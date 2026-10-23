import { onSignal as original } from './titanCombined';
import { Signal, Field, Channel, Read, Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Spear publishes before chain observes its new mode, at the original clock slot.
export function onSignal(signal:i32,value:f64,source:i32):void{
  if(signal!=Signal.zzArenaSchedules){original(signal,value,source);return;}
  const dt=f(Field.dt),phase=f(Field.phase),mask=i32(f(Field.zzMask));
  let mode=f(Field.mode),t=f(Field.t),cd=f(Field.cd),x=f(Field.x),z=f(Field.z),strike=0.0,stuck=0.0;
  let chainCd=f(Field.zzChainCd),left=f(Field.zzChainLeft),chainT=f(Field.zzChainT),chainStrike=0.0;
  if((mask&1)!=0){
    t+=dt;
    if(mode==0){cd-=dt;if(cd<=0&&left==0){mode=1;t=0;x=f(Field.px);z=f(Field.pz);}}
    else if(mode==1){
      if(t<f(Field.aim)-f(Field.lock)){const k=Math.min(1,dt*5);x+=(f(Field.px)-x)*k;z+=(f(Field.pz)-z)*k;}
      if(t>=f(Field.aim)){mode=2;t=0;strike=1;}
    }else if(mode==2){if(t>.45){mode=3;t=0;stuck=phase==0?1:0;}}
    else if(mode==3){if(t>=f(Field.stuck)){mode=0;t=0;cd=phase==2?6+Read.random()*2:2+Read.random()*1.5;}}
  }
  if((mask&2)!=0){
    chainCd-=dt;
    if(left==0&&chainCd<=0&&mode==0){left=7;chainT=0;}
    if(left>0){chainT-=dt;if(chainT<=0){chainT=.42;left--;chainStrike=1;if(left==0)chainCd=5+Read.random()*2;}}
  }
  put(Channel.mode,mode);put(Channel.t,t);put(Channel.cd,cd);put(Channel.x,x);put(Channel.z,z);
  put(Channel.strike,strike);put(Channel.stuck,stuck);
  const dx=f(Field.px)-x,dz=f(Field.pz)-z;
  put(Channel.hurt,strike>0&&Math.sqrt(dx*dx+dz*dz)<f(Field.radius)?1:0);put(Channel.spread,strike>0&&phase==2?1:0);
  put(Channel.zzChainCd,chainCd);put(Channel.zzChainLeft,left);put(Channel.zzChainT,chainT);
  put(Channel.zzSpearActive,(mask&1)!=0?1:0);put(Channel.zzChainStrike,chainStrike);put(Channel.zzChainIndex,Math.max(0,f(Field.count)-5));
}
