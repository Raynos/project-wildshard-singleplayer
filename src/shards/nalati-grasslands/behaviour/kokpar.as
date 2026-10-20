import { chapterSignal } from './chapter';
import { courseSignal } from './course';
import { Signal, Field, Channel, Read, Do, Params } from './generated/nalatiKokpar';

@inline function get(field:i32):f64 { return Read.field(0,field); }
@inline function distance(x:f64,z:f64,tx:f64,tz:f64):f64 { return Math.hypot(x-tx,z-tz); }
// Stateless requests borrow the original page clocks; no actor or RNG is created.
export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.bow){
    Do.channel(Channel.bowSun,get(Field.bowPower)>=get(Field.bowThreshold)?1:0);
    Do.channel(Channel.bowDamage,Math.round(get(Field.bowBaseDamage)*get(Field.bowPierce))*(get(Field.bowCrush)!=0?get(Field.bowCrushScale):1));
    return;
  }
  if(chapterSignal(signal)||courseSignal(signal))return;
  let carrying=get(Field.carrying),left=get(Field.left),slow=get(Field.slow),cheer=get(Field.cheer),warned=get(Field.warned);
  let event:i32=0,pose:i32=0,goal:i32=0,warning:i32=0;
  const dt=get(Field.dt),px=get(Field.playerX),pz=get(Field.playerZ);
  if(signal==Signal.win) { carrying=0;cheer=4;event=7; }
  else {
    if(cheer>0) { cheer-=dt;if(cheer<=0)pose=1; }
    const dx=px-Params.homeX,dz=pz-Params.homeZ,off=dx*dx+dz*dz>Params.fieldRadius*Params.fieldRadius;
    if(carrying==0) {
      if(cheer<=0&&get(Field.mounted)!=0&&get(Field.practice)==0&&!off) {
        const x=pose==1?Params.homeX:get(Field.goatX),z=pose==1?Params.homeZ:get(Field.goatZ);
        if(distance(px,pz,x,z)<3.6) {carrying=1;left=45;slow=0;warned=0;event=1;}
      }
    } else {
      if(get(Field.mounted)==0||get(Field.horse)==0)event=2;
      else if(off)event=3;
      else {
        left-=dt;
        if(left<=0)event=4;
        else {
          if(warned==0&&left<15) {warned=1;warning=1;}
          slow=get(Field.fast)!=0?Math.max(0,slow-dt):slow+dt;
          if(slow>2.5)event=5;
          else {
            pose=2;
            const x=get(Field.horseX),z=get(Field.horseZ);
            if(distance(x,z,Params.goal0X,Params.goal0Z)<3.6) {goal=0;event=7;}
            else if(distance(x,z,Params.goal1X,Params.goal1Z)<3.6) {goal=1;event=7;}
            if(event==7) {carrying=0;cheer=4;pose=3;}
          }
        }
      }
      if(event>=2&&event<=5) {carrying=0;pose=1;}
    }
  }
  Do.channel(Channel.carrying,carrying);Do.channel(Channel.left,left);Do.channel(Channel.slow,slow);
  Do.channel(Channel.cheer,cheer);Do.channel(Channel.warned,warned);
  Do.channel(Channel.event,event);Do.channel(Channel.pose,pose);Do.channel(Channel.goal,goal);Do.channel(Channel.warning,warning);
}
