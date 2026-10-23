import { Field, Channel, Signal, Read, Do } from './generated/nalatiMounts';
@inline function set(id:i32,value:f64):void{Read.captureField(id,value);}
@inline function out(id:i32,fallback:f64):f64{return Do.captured(id,fallback);}
@inline function clear():void{Do.capture();}
import { approachEntry } from './tamingApproach';
import { breakingEntry } from './tamingBreak';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function h(index:i32,id:i32):f64{return Read.field(index+1,id);}
let nextSignal:f64=0,captureKind:f64=0,upgradeResult:f64=0,presentView:f64=0,acceptedResult:f64=0;
@inline function control(id:i32,value:f64):void{switch(id){case Channel.zzNext:nextSignal=value;return;case Channel.zzCapture:captureKind=value;return;case Channel.zzUpgrade:upgradeResult=value;return;case Channel.zzPresent:presentView=value;return;case Channel.zzAccept:acceptedResult=value;return;default:unreachable();}}
@inline function action(op:i32,target:i32,a:f64=0,b:f64=0,c:f64=0,d:f64=0,e:f64=0,g:f64=0):void{Do.taming(op,target,a,b,c,d,e,g);}
let phase:f64=0;
let bonded:f64=0;
let upgraded:f64=0;
let herd:f64=0;
let stallion:f64=0;
let clock:f64=0;
let previous:f64=0;
let prevX:f64=0;
let prevY:f64=0;
let prevZ:f64=0;
let drove0:f64=0;
let drove1:f64=0;
let drove2:f64=0;
let drove3:f64=0;
let drove4:f64=0;
let drove5:f64=0;
let drove6:f64=0;
let drove7:f64=0;
let s_lookT:f64=0;
let s_round:f64=0;
let s_roundT:f64=0;
let s_b:f64=0;
let s_bv:f64=0;
let s_redT:f64=0;
let s_spinF:f64=0;
let s_spinT:f64=0;
let s_next:f64=0;
let s_kind:f64=0;
let s_dir:f64=0;
let s_power:f64=0;
let s_rearAt:f64=0;
let s_shake:f64=0;
let s_speed:f64=0;
let s_rearDir:f64=0;
let v_trust:f64=0;
let v_alert:f64=0;
let v_ear:f64=0;
let v_earOffset:f64=0;
let v_round:f64=0;
let v_balance:f64=0;
let v_danger:f64=0;
let v_offer:f64=0;
let v_radius:f64=0;
let v_beaten:f64=0;
let v_roll:f64=0;
let v_shake:f64=0;
@inline function load():void{
phase=f(Field.zzPhase);
bonded=f(Field.zzBonded);
upgraded=f(Field.zzUpgraded);
herd=f(Field.zzHerd);
stallion=f(Field.zzStallion);
clock=f(Field.zzClock);
previous=f(Field.zzPrevious);
prevX=f(Field.zzPrevX);
prevY=f(Field.zzPrevY);
prevZ=f(Field.zzPrevZ);
drove0=f(Field.zzDrove0);
drove1=f(Field.zzDrove1);
drove2=f(Field.zzDrove2);
drove3=f(Field.zzDrove3);
drove4=f(Field.zzDrove4);
drove5=f(Field.zzDrove5);
drove6=f(Field.zzDrove6);
drove7=f(Field.zzDrove7);
s_lookT=f(Field.zzSLookT);
s_round=f(Field.zzSRound);
s_roundT=f(Field.zzSRoundT);
s_b=f(Field.zzSB);
s_bv=f(Field.zzSBv);
s_redT=f(Field.zzSRedT);
s_spinF=f(Field.zzSSpinF);
s_spinT=f(Field.zzSSpinT);
s_next=f(Field.zzSNext);
s_kind=f(Field.zzSKind);
s_dir=f(Field.zzSDir);
s_power=f(Field.zzSPower);
s_rearAt=f(Field.zzSRearAt);
s_shake=f(Field.zzSShake);
s_speed=f(Field.zzSSpeed);
s_rearDir=f(Field.zzSRearDir);
v_trust=f(Field.zzVTrust);
v_alert=f(Field.zzVAlert);
v_ear=f(Field.zzVEar);
v_earOffset=f(Field.zzVEarOffset);
v_round=f(Field.zzVRound);
v_balance=f(Field.zzVBalance);
v_danger=f(Field.zzVDanger);
v_offer=f(Field.zzVOffer);
v_radius=f(Field.zzVRadius);
v_beaten=f(Field.zzVBeaten);
v_roll=f(Field.zzVRoll);
v_shake=f(Field.zzVShake);
}
@inline function publish():void{
Do.release();Do.channel(Channel.zzNext,nextSignal);Do.channel(Channel.zzCapture,captureKind);Do.channel(Channel.zzUpgrade,upgradeResult);Do.channel(Channel.zzPresent,presentView);Do.channel(Channel.zzAccept,acceptedResult);
Do.channel(Channel.zzPhase,phase);
Do.channel(Channel.zzBonded,bonded);
Do.channel(Channel.zzUpgraded,upgraded);
Do.channel(Channel.zzHerd,herd);
Do.channel(Channel.zzStallion,stallion);
Do.channel(Channel.zzClock,clock);
Do.channel(Channel.zzPrevious,previous);
Do.channel(Channel.zzPrevX,prevX);
Do.channel(Channel.zzPrevY,prevY);
Do.channel(Channel.zzPrevZ,prevZ);
Do.channel(Channel.zzDrove0,drove0);
Do.channel(Channel.zzDrove1,drove1);
Do.channel(Channel.zzDrove2,drove2);
Do.channel(Channel.zzDrove3,drove3);
Do.channel(Channel.zzDrove4,drove4);
Do.channel(Channel.zzDrove5,drove5);
Do.channel(Channel.zzDrove6,drove6);
Do.channel(Channel.zzDrove7,drove7);
Do.channel(Channel.zzSLookT,s_lookT);
Do.channel(Channel.zzSRound,s_round);
Do.channel(Channel.zzSRoundT,s_roundT);
Do.channel(Channel.zzSB,s_b);
Do.channel(Channel.zzSBv,s_bv);
Do.channel(Channel.zzSRedT,s_redT);
Do.channel(Channel.zzSSpinF,s_spinF);
Do.channel(Channel.zzSSpinT,s_spinT);
Do.channel(Channel.zzSNext,s_next);
Do.channel(Channel.zzSKind,s_kind);
Do.channel(Channel.zzSDir,s_dir);
Do.channel(Channel.zzSPower,s_power);
Do.channel(Channel.zzSRearAt,s_rearAt);
Do.channel(Channel.zzSShake,s_shake);
Do.channel(Channel.zzSSpeed,s_speed);
Do.channel(Channel.zzSRearDir,s_rearDir);
Do.channel(Channel.zzVTrust,v_trust);
Do.channel(Channel.zzVAlert,v_alert);
Do.channel(Channel.zzVEar,v_ear);
Do.channel(Channel.zzVEarOffset,v_earOffset);
Do.channel(Channel.zzVRound,v_round);
Do.channel(Channel.zzVBalance,v_balance);
Do.channel(Channel.zzVDanger,v_danger);
Do.channel(Channel.zzVOffer,v_offer);
Do.channel(Channel.zzVRadius,v_radius);
Do.channel(Channel.zzVBeaten,v_beaten);
Do.channel(Channel.zzVRoll,v_roll);
Do.channel(Channel.zzVShake,v_shake);
}
@inline function hasDrove(i:i32):bool{return drove0==i||drove1==i||drove2==i||drove3==i||drove4==i||drove5==i||drove6==i||drove7==i;}
@inline function remember(i:i32):void{
if(drove0<0)drove0=i;
else if(drove1<0)drove1=i;
else if(drove2<0)drove2=i;
else if(drove3<0)drove3=i;
else if(drove4<0)drove4=i;
else if(drove5<0)drove5=i;
else if(drove6<0)drove6=i;
else if(drove7<0)drove7=i;
}
@inline function finish(won:bool):void{
phase=bonded==0?0:2;v_round=-1;v_danger=0;v_roll=0;v_shake=0;action(37,1,0);
if(stallion==0||herd<0){if(f(Field.zzMounted)!=0)action(23,1,1);return;}
action(31,64+i32(stallion)-1,0,1,0,0,0,0);
if(won){control(Channel.zzNext,Signal.zzFinishBond);control(Channel.zzCapture,3);control(Channel.zzUpgrade,h(i32(herd),Field.zzHUpgraded));return;}
clear();set(Field.won,0);approachEntry(Signal.finish,0,0);action(23,1,1);action(30,1,out(Channel.damage,0));action(26,16+i32(herd),out(Channel.trust,0));action(28,16+i32(herd),f(Field.px),f(Field.pz));action(38,1,2);
}
@inline function buck(elapsed:f64):void{
clear();
set(Field.lookT,s_lookT);
set(Field.round,s_round);
set(Field.roundT,s_roundT);
set(Field.b,s_b);
set(Field.bv,s_bv);
set(Field.redT,s_redT);
set(Field.spinF,s_spinF);
set(Field.spinT,s_spinT);
set(Field.next,s_next);
set(Field.kind,s_kind);
set(Field.dir,s_dir);
set(Field.power,s_power);
set(Field.rearAt,s_rearAt);
set(Field.shake,s_shake);
set(Field.speed,s_speed);
set(Field.rearDir,s_rearDir);
set(Field.dt,elapsed);set(Field.lean,f(Field.zzLean));set(Field.r0,f(Field.zzR0));set(Field.r1,f(Field.zzR1));set(Field.r2,f(Field.zzR2));breakingEntry(Signal.step,0,0);
s_round=out(Channel.round,s_round);
s_roundT=out(Channel.roundT,s_roundT);
s_b=out(Channel.b,s_b);
s_bv=out(Channel.bv,s_bv);
s_redT=out(Channel.redT,s_redT);
s_spinF=out(Channel.spinF,s_spinF);
s_spinT=out(Channel.spinT,s_spinT);
s_next=out(Channel.next,s_next);
s_kind=out(Channel.kind,s_kind);
s_dir=out(Channel.dir,s_dir);
s_power=out(Channel.power,s_power);
s_rearAt=out(Channel.rearAt,s_rearAt);
s_shake=out(Channel.shake,s_shake);
s_rearDir=out(Channel.rearDir,s_rearDir);
v_roll=out(Channel.roll,0);v_shake=out(Channel.shake,0);v_round=out(Channel.round,1);v_balance=out(Channel.b,0);v_danger=out(Channel.danger,0);v_trust=-1;v_ear=0;
if(stallion!=0)action(31,64+i32(stallion)-1,out(Channel.buck,0),s_dir,out(Channel.rear,-1),out(Channel.kick,0),out(Channel.toss,0),out(Channel.yaw,0));
const outcome=out(Channel.outcome,0);if(outcome!=0)finish(outcome==1);
}
@inline function sample():void{
 const dt=f(Field.zzDt);assert(dt>=0);
 if(phase==1&&f(Field.zzMounted)!=stallion){finish(false);return;}
 clock+=dt;if(clock+1e-9<.1)return;
 const elapsed=clock;clock=0;
 if(phase==1){buck(elapsed);return;}
 s_speed=previous==0?0:s_speed+(f(Field.zzMoved)/elapsed-s_speed)*Math.min(1,elapsed*6);
 previous=1;prevX=f(Field.px);prevY=f(Field.py);prevZ=f(Field.pz);
 clear();set(Field.count,f(Field.zzCount));set(Field.bonded,bonded==0?0:1);set(Field.argymaq,upgraded);
 approachEntry(Signal.select,0,0);
 const index=i32(out(Channel.index,-1)),valid=index>=0&&index<i32(f(Field.zzCount));
 if(herd>=0&&herd!=index)action(27,16+i32(herd),0);
 herd=valid?index:-1;stallion=valid?h(index,Field.zzHActor):0;
 v_radius=0;v_round=-1;v_danger=0;v_trust=-1;v_ear=0;v_offer=0;
 if(!valid||stallion==0)return;
 if(out(Channel.active,1)==0){action(27,16+index,0);action(26,16+index,-elapsed);return;}
 const distance=out(Channel.distance,41);clear();
 set(Field.dt,elapsed);set(Field.distance,distance);set(Field.beaten,h(index,Field.zzHBeaten));set(Field.mounted,f(Field.zzMounted)==0?0:1);set(Field.speed,s_speed);
 set(Field.scale,h(index,Field.zzHScale));set(Field.dot,h(index,Field.zzHDot));set(Field.lookT,s_lookT);set(Field.offer,f(Field.zzOffer));set(Field.alert,h(index,Field.zzHAlert));set(Field.trust,h(index,Field.zzHTrust));set(Field.crouched,f(Field.zzCrouched));
 set(Field.downwind,h(index,Field.zzHDownwind));set(Field.strength,f(Field.zzWindStrength));set(Field.flee,h(index,Field.zzHFlee));
 approachEntry(Signal.approach,0,0);s_lookT=out(Channel.lookT,0);
 action(27,16+index,1);action(26,16+index,out(Channel.trust,0),1,out(Channel.alert,h(index,Field.zzHAlert)));
 if(out(Channel.lead,0)==1)action(28,16+index,f(Field.px),f(Field.pz));
 v_radius=out(Channel.radius,0);v_earOffset=out(Channel.ear,0);v_trust=Math.max(0,Math.min(100,h(index,Field.zzHTrust)+out(Channel.trust,0)));
 v_alert=out(Channel.alert,h(index,Field.zzHAlert));v_ear=1;v_offer=out(Channel.offer,0);v_beaten=h(index,Field.zzHBeaten);
}
@inline function event():void{
 const shot=f(Field.zzShot)!=0;
 for(let index:i32=0;index<8;index++){
  if(index>=i32(f(Field.zzCount)))break;
  if((!shot&&hasDrove(index))||(shot&&h(index,Field.zzHActor)==0))continue;
  clear();set(Field.x,f(Field.zzEventX));set(Field.z,f(Field.zzEventZ));set(Field.cx,h(index,shot?Field.x:Field.zzHCx));set(Field.cz,h(index,shot?Field.z:Field.zzHCz));
  set(Field.shot,shot?1:0);set(Field.alert,h(index,Field.zzHAlert));approachEntry(Signal.event,0,0);
  const trust=out(Channel.trust,0);action(26,16+index,trust,1,out(Channel.alert,h(index,Field.zzHAlert)));
  if(!shot&&trust>0){remember(index);action(38,1,0);}
 }
}
@inline export function tamingEntry(signal:i32):void{
 load();
 nextSignal=0;captureKind=0;upgradeResult=0;presentView=0;acceptedResult=0;
 if(signal==Signal.zzSample){sample();control(Channel.zzPresent,1);}
 else if(signal==Signal.zzEvent){event();control(Channel.zzPresent,1);}
 else if(signal==Signal.zzProbe){control(Channel.zzNext,Signal.zzSample);control(Channel.zzCapture,phase==1&&clock+f(Field.zzDt)+1e-9>=.1?2:1);}
 else if(signal==Signal.zzStart||signal==Signal.zzEligible){
  clear();set(Field.bonded,bonded==0?0:1);set(Field.argymaq,upgraded);set(Field.horseArgymaq,f(Field.zzCandidateUpgraded));approachEntry(Signal.eligible,0,0);
  const accept=out(Channel.accept,0)==1;control(Channel.zzAccept,accept?1:0);
  if(signal==Signal.zzStart&&stallion!=0&&phase!=1&&accept){action(29,64+i32(stallion)-1,1);control(Channel.zzNext,Signal.zzMounted);}
 }else if(signal==Signal.zzMounted){
  if(f(Field.zzNativeAccepted)==1){action(39,1,f(Field.zzSelectedYaw)-Math.PI,-.1);control(Channel.zzNext,Signal.zzStarted);control(Channel.zzCapture,2);}
 }else if(signal==Signal.zzStarted){
  if(herd>=0&&stallion!=0&&f(Field.zzMounted)==stallion&&phase!=1){
   phase=1;v_radius=0;v_round=1;clock=0;
s_lookT=f(Field.zzInitialLookT);
s_round=f(Field.zzInitialRound);
s_roundT=f(Field.zzInitialRoundT);
s_b=f(Field.zzInitialB);
s_bv=f(Field.zzInitialBv);
s_redT=f(Field.zzInitialRedT);
s_spinF=f(Field.zzInitialSpinF);
s_spinT=f(Field.zzInitialSpinT);
s_next=f(Field.zzInitialNext);
s_kind=f(Field.zzInitialKind);
s_dir=f(Field.zzInitialDir);
s_power=f(Field.zzInitialPower);
s_rearAt=f(Field.zzInitialRearAt);
s_shake=f(Field.zzInitialShake);
s_speed=f(Field.zzInitialSpeed);
s_rearDir=f(Field.zzInitialRearDir);
   clear();set(Field.r0,f(Field.zzR0));set(Field.r1,f(Field.zzR1));breakingEntry(Signal.start,0,0);s_kind=out(Channel.kind,s_kind);s_dir=out(Channel.dir,s_dir);
   action(27,16+i32(herd),1);action(37,1,1);action(38,1,1);control(Channel.zzPresent,1);
  }
 }else if(signal==Signal.zzFinishBond){
  action(23,1,0);action(34,16+i32(herd));action(35,64+i32(stallion)-1);if(bonded!=0)action(36,64+i32(bonded)-1);
  action(32,1,f(Field.zzAdoptX),f(Field.zzAdoptZ),f(Field.zzAdoptYaw),f(Field.zzAdoptUpgraded));control(Channel.zzUpgrade,f(Field.zzAdoptUpgraded));control(Channel.zzNext,Signal.zzBonded);
 }else if(signal==Signal.zzAdopt||signal==Signal.zzBonded){
  bonded=f(Field.zzAdopted);upgraded=f(Field.zzAdoptUpgraded);phase=2;
  if(signal==Signal.zzBonded){action(29,64+i32(bonded)-1,0);action(33,64+i32(bonded)-1,upgraded);}
 }else if(signal==Signal.zzInit){
  const saved=f(Field.zzSavedBond);
  if(saved>=0){action(32,1,f(Field.zzRestX),f(Field.zzRestZ),f(Field.zzRestYaw),saved);control(Channel.zzUpgrade,saved);control(Channel.zzNext,Signal.zzAdopt);}
 }else if(signal==Signal.zzForce){
  if(herd>=0&&stallion!=0){action(26,16+i32(herd),100);control(Channel.zzNext,Signal.zzStart);}
 }
 publish();
}
