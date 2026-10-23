import { onSignal as original,runSchedule,publishSchedule,chainStrike } from './titanSchedules';
import { Signal,Field,Channel,Read,Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
export function onSignal(signal:i32,value:f64,source:i32):void{
  if(signal!=Signal.zzzArenaFrame){original(signal,value,source);return;}
  const dt=f(Field.dt),px=f(Field.px),pz=f(Field.pz),active=f(Field.fighting)>0,phase=f(Field.phase);
  const mask=active?(phase==0?1:phase==2?3:0):0,land=active&&phase==2;
  let count=f(Field.count),elapsed=f(Field.elapsed);
  let x0=f(Field.trailX0),z0=f(Field.trailZ0);
  let x1=f(Field.trailX1),z1=f(Field.trailZ1);
  let x2=f(Field.trailX2),z2=f(Field.trailZ2);
  let x3=f(Field.trailX3),z3=f(Field.trailZ3);
  let x4=f(Field.trailX4),z4=f(Field.trailZ4);
  let x5=f(Field.trailX5),z5=f(Field.trailZ5);
  let x6=f(Field.trailX6),z6=f(Field.trailZ6);
  let x7=f(Field.trailX7),z7=f(Field.trailZ7);
  let x8=f(Field.trailX8),z8=f(Field.trailZ8);
  let x9=f(Field.trailX9),z9=f(Field.trailZ9);
  let x10=f(Field.trailX10),z10=f(Field.trailZ10);
  let x11=f(Field.trailX11),z11=f(Field.trailZ11);
  if(active){elapsed+=dt;if(elapsed+1e-9>=f(Field.every)){
    const capacity=f(Field.capacity),full=count>=capacity;
    const replace0=0<capacity&&(full?0==capacity-1:count==0);x0=replace0?px:(full&&0<capacity?x1:x0);z0=replace0?pz:(full&&0<capacity?z1:z0);
    const replace1=1<capacity&&(full?1==capacity-1:count==1);x1=replace1?px:(full&&1<capacity?x2:x1);z1=replace1?pz:(full&&1<capacity?z2:z1);
    const replace2=2<capacity&&(full?2==capacity-1:count==2);x2=replace2?px:(full&&2<capacity?x3:x2);z2=replace2?pz:(full&&2<capacity?z3:z2);
    const replace3=3<capacity&&(full?3==capacity-1:count==3);x3=replace3?px:(full&&3<capacity?x4:x3);z3=replace3?pz:(full&&3<capacity?z4:z3);
    const replace4=4<capacity&&(full?4==capacity-1:count==4);x4=replace4?px:(full&&4<capacity?x5:x4);z4=replace4?pz:(full&&4<capacity?z5:z4);
    const replace5=5<capacity&&(full?5==capacity-1:count==5);x5=replace5?px:(full&&5<capacity?x6:x5);z5=replace5?pz:(full&&5<capacity?z6:z5);
    const replace6=6<capacity&&(full?6==capacity-1:count==6);x6=replace6?px:(full&&6<capacity?x7:x6);z6=replace6?pz:(full&&6<capacity?z7:z6);
    const replace7=7<capacity&&(full?7==capacity-1:count==7);x7=replace7?px:(full&&7<capacity?x8:x7);z7=replace7?pz:(full&&7<capacity?z8:z7);
    const replace8=8<capacity&&(full?8==capacity-1:count==8);x8=replace8?px:(full&&8<capacity?x9:x8);z8=replace8?pz:(full&&8<capacity?z9:z8);
    const replace9=9<capacity&&(full?9==capacity-1:count==9);x9=replace9?px:(full&&9<capacity?x10:x9);z9=replace9?pz:(full&&9<capacity?z10:z9);
    const replace10=10<capacity&&(full?10==capacity-1:count==10);x10=replace10?px:(full&&10<capacity?x11:x10);z10=replace10?pz:(full&&10<capacity?z11:z10);
    const replace11=11<capacity&&(full?11==capacity-1:count==11);x11=replace11?px:(full&&11<capacity?x11:x11);z11=replace11?pz:(full&&11<capacity?z11:z11);
    count=Math.min(capacity,count+1);elapsed=0;
  }}
  runSchedule(mask);
  const index=Math.max(0,count-5),capacity=f(Field.zzzLandingCapacity);assert(capacity>=1&&capacity<=8&&capacity==Math.floor(capacity));
  let pickedX=px,pickedZ=pz,launched=false;
  if(index==0&&index>=0&&index<count){pickedX=x0;pickedZ=z0;}
  if(index==1&&index>=0&&index<count){pickedX=x1;pickedZ=z1;}
  if(index==2&&index>=0&&index<count){pickedX=x2;pickedZ=z2;}
  if(index==3&&index>=0&&index<count){pickedX=x3;pickedZ=z3;}
  if(index==4&&index>=0&&index<count){pickedX=x4;pickedZ=z4;}
  if(index==5&&index>=0&&index<count){pickedX=x5;pickedZ=z5;}
  if(index==6&&index>=0&&index<count){pickedX=x6;pickedZ=z6;}
  if(index==7&&index>=0&&index<count){pickedX=x7;pickedZ=z7;}
  if(index==8&&index>=0&&index<count){pickedX=x8;pickedZ=z8;}
  if(index==9&&index>=0&&index<count){pickedX=x9;pickedZ=z9;}
  if(index==10&&index>=0&&index<count){pickedX=x10;pickedZ=z10;}
  if(index==11&&index>=0&&index<count){pickedX=x11;pickedZ=z11;}
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(0<capacity){
      on=f(Field.zzzLanding0on);t=f(Field.zzzLanding0t);x=f(Field.zzzLanding0x);z=f(Field.zzzLanding0z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding0on,on);put(Channel.zzzLanding0t,t);put(Channel.zzzLanding0x,x);put(Channel.zzzLanding0z,z);put(Channel.zzzLanding0strike,strike);put(Channel.zzzLanding0hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(1<capacity){
      on=f(Field.zzzLanding1on);t=f(Field.zzzLanding1t);x=f(Field.zzzLanding1x);z=f(Field.zzzLanding1z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding1on,on);put(Channel.zzzLanding1t,t);put(Channel.zzzLanding1x,x);put(Channel.zzzLanding1z,z);put(Channel.zzzLanding1strike,strike);put(Channel.zzzLanding1hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(2<capacity){
      on=f(Field.zzzLanding2on);t=f(Field.zzzLanding2t);x=f(Field.zzzLanding2x);z=f(Field.zzzLanding2z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding2on,on);put(Channel.zzzLanding2t,t);put(Channel.zzzLanding2x,x);put(Channel.zzzLanding2z,z);put(Channel.zzzLanding2strike,strike);put(Channel.zzzLanding2hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(3<capacity){
      on=f(Field.zzzLanding3on);t=f(Field.zzzLanding3t);x=f(Field.zzzLanding3x);z=f(Field.zzzLanding3z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding3on,on);put(Channel.zzzLanding3t,t);put(Channel.zzzLanding3x,x);put(Channel.zzzLanding3z,z);put(Channel.zzzLanding3strike,strike);put(Channel.zzzLanding3hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(4<capacity){
      on=f(Field.zzzLanding4on);t=f(Field.zzzLanding4t);x=f(Field.zzzLanding4x);z=f(Field.zzzLanding4z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding4on,on);put(Channel.zzzLanding4t,t);put(Channel.zzzLanding4x,x);put(Channel.zzzLanding4z,z);put(Channel.zzzLanding4strike,strike);put(Channel.zzzLanding4hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(5<capacity){
      on=f(Field.zzzLanding5on);t=f(Field.zzzLanding5t);x=f(Field.zzzLanding5x);z=f(Field.zzzLanding5z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding5on,on);put(Channel.zzzLanding5t,t);put(Channel.zzzLanding5x,x);put(Channel.zzzLanding5z,z);put(Channel.zzzLanding5strike,strike);put(Channel.zzzLanding5hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(6<capacity){
      on=f(Field.zzzLanding6on);t=f(Field.zzzLanding6t);x=f(Field.zzzLanding6x);z=f(Field.zzzLanding6z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding6on,on);put(Channel.zzzLanding6t,t);put(Channel.zzzLanding6x,x);put(Channel.zzzLanding6z,z);put(Channel.zzzLanding6strike,strike);put(Channel.zzzLanding6hurt,hurt);
  }
  {
    let on=0.0,t=0.0,x=0.0,z=0.0,strike=0.0,hurt=0.0;
    if(7<capacity){
      on=f(Field.zzzLanding7on);t=f(Field.zzzLanding7t);x=f(Field.zzzLanding7x);z=f(Field.zzzLanding7z);
      if(chainStrike==1&&!launched&&on==0){on=1;t=0;x=pickedX;z=pickedZ;launched=true;}
      if(land&&on==1){t+=dt;const done=t>=f(Field.zzzLandSeconds);on=done?0:1;strike=done?1:0;
        const dx=px-x,dz=pz-z;hurt=done&&Math.sqrt(dx*dx+dz*dz)<f(Field.zzzLandRadius)?1:0;}
    }
    put(Channel.zzzLanding7on,on);put(Channel.zzzLanding7t,t);put(Channel.zzzLanding7x,x);put(Channel.zzzLanding7z,z);put(Channel.zzzLanding7strike,strike);put(Channel.zzzLanding7hurt,hurt);
  }
  publishSchedule(mask,count);put(Channel.count,count);put(Channel.elapsed,elapsed);
  put(Channel.trailX0,x0);put(Channel.trailZ0,z0);
  put(Channel.trailX1,x1);put(Channel.trailZ1,z1);
  put(Channel.trailX2,x2);put(Channel.trailZ2,z2);
  put(Channel.trailX3,x3);put(Channel.trailZ3,z3);
  put(Channel.trailX4,x4);put(Channel.trailZ4,z4);
  put(Channel.trailX5,x5);put(Channel.trailZ5,z5);
  put(Channel.trailX6,x6);put(Channel.trailZ6,z6);
  put(Channel.trailX7,x7);put(Channel.trailZ7,z7);
  put(Channel.trailX8,x8);put(Channel.trailZ8,z8);
  put(Channel.trailX9,x9);put(Channel.trailZ9,z9);
  put(Channel.trailX10,x10);put(Channel.trailZ10,z10);
  put(Channel.trailX11,x11);put(Channel.trailZ11,z11);
}
