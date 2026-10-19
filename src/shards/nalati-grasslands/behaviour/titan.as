import { Signal, Field, Channel, Read, Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
@inline function length2(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
// Event projections; retained state belongs to the native binding at <= 10 Hz.
@inline export function attackEntry(signal:i32,value:f64,source:i32):void {
if(signal==Signal.spear){
    const dt=f(Field.dt),phase=f(Field.phase);let mode=f(Field.mode),t=f(Field.t)+dt,cd=f(Field.cd),x=f(Field.x),z=f(Field.z),strike=0.0,stuck=0.0;
    if(mode==0){cd-=dt;if(cd<=0&&f(Field.chain)==0){mode=1;t=0;x=f(Field.px);z=f(Field.pz);}}
    else if(mode==1){
      if(t<f(Field.aim)-f(Field.lock)){const k=Math.min(1,dt*5);x+=(f(Field.px)-x)*k;z+=(f(Field.pz)-z)*k;}
      if(t>=f(Field.aim)){mode=2;t=0;strike=1;}
    }else if(mode==2){if(t>.45){mode=3;t=0;stuck=phase==0?1:0;}}
    else if(mode==3){if(t>=f(Field.stuck)){mode=0;t=0;cd=phase==2?6+Read.random()*2:2+Read.random()*1.5;}}
    put(Channel.mode,mode);put(Channel.t,t);put(Channel.cd,cd);put(Channel.x,x);put(Channel.z,z);put(Channel.strike,strike);put(Channel.stuck,stuck);
  } else if(signal==Signal.rider){
    const dt=f(Field.dt),px=f(Field.px),pz=f(Field.pz),ax=f(Field.ax),az=f(Field.az),x0=f(Field.x0),z0=f(Field.z0),x1=f(Field.x1),z1=f(Field.z1);
    let mode=f(Field.mode),t=f(Field.t)+dt,theta=f(Field.theta),hit=f(Field.hit),x=0.0,z=0.0,speed=0.0,turn=0.0,alpha=0.0,show=0.0,hurt=0.0;
    if(mode==0){theta+=dt*12/26;x=px+Math.sin(theta)*26;z=pz+Math.cos(theta)*26;speed=12;turn=2.8;}
    else if(mode==1){x=x0;z=z0;speed=.5;turn=5;show=1;alpha=.9*(.65+.35*Math.sin(t*18));if(t>=f(Field.lane)){mode=2;t=0;hit=0;}}
    else if(mode==2){
      x=x1;z=z1;speed=21;turn=6;show=1;alpha=Math.max(0,.5-t*.3);
      if(hit==0&&length2(px-ax,pz-az)<3.4){hit=1;hurt=1;}
      if(length2(x1-ax,z1-az)<4||t>3.2){mode=3;t=0;show=0;}
    }else if(mode==3){
      const dx=x1-x0,dz=z1-z0,d=length2(dx,dz),length=d==0?1:d;
      x=x1+dx/length*14;z=z1+dz/length*14;speed=7;turn=2;
      if(t>=f(Field.flank)){mode=0;t=0;theta=Math.atan2(ax-px,az-pz);}
    }
    put(Channel.mode,mode);put(Channel.t,t);put(Channel.theta,theta);put(Channel.hit,hit);put(Channel.x,x);put(Channel.z,z);
    put(Channel.speed,speed);put(Channel.turn,turn);put(Channel.alpha,alpha);put(Channel.show,show);put(Channel.hurt,hurt);
  } else if(signal==Signal.chain){
    const dt=f(Field.dt);let cd=f(Field.cd)-dt,left=f(Field.chain),step=f(Field.t),strike=0.0;
    if(left==0&&cd<=0&&f(Field.mode)>0){left=7;step=0;}
    if(left>0){step-=dt;if(step<=0){step=.42;left--;strike=1;if(left==0)cd=5+Read.random()*2;}}
    put(Channel.cd,cd);put(Channel.left,left);put(Channel.t,step);put(Channel.strike,strike);put(Channel.index,Math.max(0,f(Field.count)-5));
  } else if(signal==Signal.chainLand){
    const t=f(Field.t)+f(Field.dt),land=t>=f(Field.land);
    put(Channel.t,t);put(Channel.strike,land?1:0);put(Channel.hurt,land&&length2(f(Field.px)-f(Field.x),f(Field.pz)-f(Field.z))<f(Field.radius)?1:0);
  }
}
