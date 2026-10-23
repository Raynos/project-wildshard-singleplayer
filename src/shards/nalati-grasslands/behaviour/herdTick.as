// R10c original herd tick and public taming mutations. State is lent by the
// original HerdBrain; scratch continuation indices never enter its JSON save.
import {S,C,M,A,Read,Do} from './herdBindings';
@inline function s(key:i32):f64{return Read.state(key);}
@inline function w(key:i32,value:f64):void{Do.state(key,value);}
@inline function c(key:i32):f64{return Read.context(key);}
@inline function m(slot:i32,key:i32):f64{return Read.member(slot,key);}
@inline function role(key:i32):i32{return Read.referenceSlot(s(key));}
@inline function mem(slot:i32,key:i32,value:f64):void{Do.memory(slot,key,value);}
@inline function hypot(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
@inline function distance(a:i32,b:i32):f64{const dx=m(a,M.x)-m(b,M.x),dy=m(a,M.y)-m(b,M.y),dz=m(a,M.z)-m(b,M.z);return Math.sqrt(dx*dx+dy*dy+dz*dz);}
@inline function pause(pc:i32):void{Do.resume(pc);}
@inline function inBounds(x:f64,z:f64,margin:f64):bool{return x>=c(C.minX)+margin&&x<=c(C.maxX)-margin&&z>=c(C.minZ)+margin&&z<=c(C.maxZ)-margin;}
@inline function state(next:i32,after:i32):void{
 w(S.stateReturn,after);w(S.stateRequested,next);
 if(s(S.stallionState)==next){pause(after);return;}
 w(S.stallionState,next);w(S.sT,0);Do.native(A.onState,next);pause(130);
}
function flight(x:f64,z:f64,stampede:bool,after:i32):void{
 w(S.flightReturn,after);w(S.flightStampede,stampede?1:0);
 if(s(S.mode)==3&&(!stampede||s(S.stampeding)!=0)){pause(after);return;}
 const dx=s(S.cx)-x,dz=s(S.cz)-z,length=hypot(dx,dz),d=length!=0?length:1;
 w(S.fleeX,dx/d);w(S.fleeZ,dz/d);w(S.fleeFromX,x);w(S.fleeFromZ,z);w(S.fleeRun,0);
 w(S.fleeLen,c(C.flightMin)+Read.random()*(c(C.flightMax)-c(C.flightMin)));
 w(S.mode,3);w(S.modeT,0);w(S.stampeding,stampede?1:0);w(S.trust,Math.max(0,s(S.trust)-30));
 for(let i=0;i<Read.members();i++){mem(i,M.hitP,0);mem(i,M.aw,1);}
 if(s(S.stallionState)!=6&&s(S.stallionState)!=7){state(5,111);return;}
 pause(111);
}
function beginTick():void{
 assert(s(S.initialized)==1);
 if(s(S.groupTimePresent)!=0&&Math.abs(c(C.time)-s(S.groupTime))<1e-8){pause(0);return;}
 w(S.groupTimePresent,1);w(S.groupTime,c(C.time));
 const dt=c(C.dt);w(S.tickDt,dt);if(dt<=0){pause(0);return;}
 w(S.modeT,s(S.modeT)+dt);w(S.sT,s(S.sT)+dt);w(S.chargeCd,Math.max(0,s(S.chargeCd)-dt));w(S.knockCd,Math.max(0,s(S.knockCd)-dt));
 let x:f64=0,z:f64=0,n:i32=0;
 const stallion=role(S.stallion),ridden=role(S.ridden);
 for(let i=0;i<Read.members();i++)if(m(i,M.alive)!=0&&i!=stallion&&i!=ridden){x+=m(i,M.x);z+=m(i,M.z);n++;}
 const oldX=s(S.cx),oldZ=s(S.cz);if(n>0){w(S.cx,x/n);w(S.cz,z/n);}
 w(S.moved,hypot(s(S.cx)-oldX,s(S.cz)-oldZ));w(S.maxAw,0);w(S.bolt,0);w(S.senseSlot,0);pause(101);
}
function senseNext():void{
 let slot=i32(s(S.senseSlot));
 while(slot<Read.members()&&(m(slot,M.alive)==0||slot==role(S.ridden)))slot++;
 if(slot>=Read.members()){afterMembers();return;}
 w(S.senseSlot,slot);w(S.senseAw,m(slot,M.aw));w(S.senseRate,0);
 // lastHitT's absent -Infinity value is represented by an explicit validity
 // column. A finite zero remains a real hit time and is never a sentinel.
 if(m(slot,M.lastHitValid)!=0&&(m(slot,M.hitTPresent)==0||m(slot,M.hitTValid)==0||m(slot,M.lastHitSeconds)>m(slot,M.hitT))){
  mem(slot,M.hitT,m(slot,M.lastHitSeconds));w(S.senseAw,1);flight(c(C.px),c(C.pz),true,102);return;
 }
 senseStart();
}
function senseStart():void{
 const slot=i32(s(S.senseSlot));
 if(c(C.calm)!=0){finishSense();return;}
 const dx=c(C.px)-m(slot,M.x),dz=c(C.pz)-m(slot,M.z);w(S.senseDistance,hypot(dx,dz));
 w(S.senseBearing,Math.atan2(dx,dz));Do.native(A.visibility,slot);pause(103);
}
function afterVisibility():void{
 const slot=i32(s(S.senseSlot)),sight=(m(slot,M.grazing)==1?c(C.grazingSight):c(C.sight))*c(C.reply),d=s(S.senseDistance);
 const delta=s(S.senseBearing)-m(slot,M.yaw),angle=Math.atan2(Math.sin(delta),Math.cos(delta));
 if(d<sight&&Math.abs(angle)<c(C.cone))w(S.senseRate,Math.max(s(S.senseRate),.4*(2-d/sight)));
 Do.native(A.hearing,slot);pause(104);
}
function afterHearing():void{
 const slot=i32(s(S.senseSlot)),d=s(S.senseDistance),hear=c(C.reply);
 if(d<hear)w(S.senseRate,Math.max(s(S.senseRate),.5*(2-d/hear)));
 if(slot==role(S.stallion)&&d<40){Do.native(A.downwind,slot);pause(105);return;}
 afterSenses();
}
function afterSenses():void{
 Do.native(A.environmentMounted);pause(109);
}
function senseCalm():void{
 const slot=i32(s(S.senseSlot)),d=s(S.senseDistance);
 w(S.senseRate,s(S.senseRate)*(1-s(S.trust)/125));
 if(d<10&&s(S.trust)<60&&slot!=role(S.stallion)&&c(C.playerSpeed)>.5)w(S.bolt,1);
 finishSense();
}
function finishSense():void{
 const slot=i32(s(S.senseSlot)),dt=s(S.tickDt),rate=s(S.senseRate);
 let aw=rate>0?Math.min(1,s(S.senseAw)+rate*dt):Math.max(0,s(S.senseAw)-.12*dt);
 if(aw>=c(C.alertThreshold)&&m(slot,M.alarm)==0){
  mem(slot,M.alarm,1);
  for(let other=0;other<Read.members();other++)if(other!=slot&&m(other,M.alive)!=0&&distance(other,slot)<20)mem(other,M.alarmT,Math.max(m(other,M.alarmT),.2+Read.random()*.6));
 }
 if(aw<c(C.alertThreshold)*.5)mem(slot,M.alarm,0);
 const at=m(slot,M.alarmT);
 if(at>0){mem(slot,M.alarmT,at-dt);if(at-dt<=0)aw=Math.max(aw,c(C.alertThreshold));}
 mem(slot,M.aw,aw);
 if(slot!=role(S.stallion)){w(S.maxAw,Math.max(s(S.maxAw),aw));if(aw>=1)w(S.bolt,1);}
 w(S.senseSlot,slot+1);pause(101);
}
function afterMembers():void{
 const st=role(S.stallion);w(S.tickStallion,s(S.stallion));
 if(st>=0&&m(st,M.alive)!=0&&s(S.alertOwned)==0){
  const mode=s(S.stallionState),base=m(st,M.aw)*70+(mode==1?20:mode==2||mode==3?30:0);
  w(S.alert,s(S.alert)+(Math.min(100,Math.max(0,base))-s(S.alert))*Math.min(1,s(S.tickDt)*2));
 }
 Do.native(A.findThreat,s(S.cx),s(S.cz),45);pause(112);
}
function afterThreat():void{
 w(S.tickThreat,c(C.reply));
 if(c(C.reply)==0){pause(115);return;}
 const d=hypot(c(C.threatX)-s(S.cx),c(C.threatZ)-s(S.cz));
 if(d<25&&s(S.mode)!=3){flight(c(C.threatX),c(C.threatZ),false,113);return;}
 pause(113);
}
function threatCharge():void{
 const st=Read.referenceSlot(s(S.tickStallion)),mode=s(S.stallionState);
 if(st<0||m(st,M.alive)==0||mode==6||mode==7||mode==3){pause(115);return;}
 let threatened=false;
 for(let i=0;i<Read.members();i++)if(m(i,M.foal)!=0&&m(i,M.alive)!=0){const dx=m(i,M.x)-c(C.threatX),dy=m(i,M.y)-c(C.threatY),dz=m(i,M.z)-c(C.threatZ);if(Math.sqrt(dx*dx+dy*dy+dz*dz)<15)threatened=true;}
 const dx=m(st,M.x)-c(C.threatX),dy=m(st,M.y)-c(C.threatY),dz=m(st,M.z)-c(C.threatZ);
 if(threatened||Math.sqrt(dx*dx+dy*dy+dz*dz)<8){w(S.chargeTarget,s(S.tickThreat));state(3,115);return;}
 pause(115);
}
function modes():void{
 const mode=i32(s(S.mode));
 switch(mode){
  case 0:case 1:
   if(s(S.bolt)!=0){flight(c(C.px),c(C.pz),false,120);return;}
   if(s(S.maxAw)>=c(C.alertThreshold)){w(S.mode,2);w(S.modeT,0);pause(120);return;}
   w(S.spotT,s(S.spotT)-s(S.tickDt));
   if(s(S.spotT)<=0){pickStart(116);return;}pause(116);return;
  case 2:
   if(s(S.bolt)!=0){flight(c(C.px),c(C.pz),false,120);return;}
   if(s(S.maxAw)<c(C.alertThreshold)*.6&&s(S.modeT)>3){w(S.mode,0);w(S.modeT,0);}pause(120);return;
  case 3:w(S.fleeRun,s(S.fleeRun)+s(S.moved));w(S.bendIndex,0);pause(150);return;
  case 4:
   if(s(S.modeT)>7){w(S.mode,0);w(S.modeT,0);pickStart(117);return;}pause(120);return;
 }
}
function pickStart(after:i32):void{
 w(S.pickReturn,after);const lead=role(S.lead),slot=lead>=0?lead:0;
 w(S.pickHandle,m(slot,M.handle));w(S.pickIndex,0);pause(140);
}
function pickAttempt():void{
 const slot=Read.referenceSlot(s(S.pickHandle)),angle=Read.contextRandom()*Math.PI*2,r=30+Read.contextRandom()*30;
 w(S.pickX,m(slot,M.x)+Math.cos(angle)*r);w(S.pickZ,m(slot,M.z)+Math.sin(angle)*r);
 if(!inBounds(s(S.pickX),s(S.pickZ),35)){pickAgain();return;}Do.native(A.normal,s(S.pickX),s(S.pickZ));pause(142);
}
function pickAgain():void{
 w(S.pickIndex,s(S.pickIndex)+1);
 if(s(S.pickIndex)<16){pause(140);return;}
 w(S.spotT,60+Read.contextRandom()*60);pause(i32(s(S.pickReturn)));
}
function bendAttempt():void{
 if(s(S.bendIndex)>=6){pause(153);return;}
 w(S.pickX,s(S.cx)+s(S.fleeX)*30);w(S.pickZ,s(S.cz)+s(S.fleeZ)*30);
 if(!inBounds(s(S.pickX),s(S.pickZ),28)){bendAgain();return;}Do.native(A.normal,s(S.pickX),s(S.pickZ));pause(152);
}
function bendAgain():void{
 const toCentre=Math.atan2(-s(S.cx),-s(S.cz)),current=Math.atan2(s(S.fleeX),s(S.fleeZ)),difference=toCentre-current;
 const delta=Math.atan2(Math.sin(difference),Math.cos(difference)),sign=delta==0?1:delta>0?1:-1,next=current+sign*.35;
 w(S.fleeX,Math.sin(next));w(S.fleeZ,Math.cos(next));w(S.bendIndex,s(S.bendIndex)+1);pause(150);
}
function stallion():void{
 const previous=Read.referenceSlot(s(S.tickStallion));if(previous<0||m(previous,M.alive)==0){pause(0);return;}
 const st=role(S.stallion);w(S.stallionTick,s(S.stallion));if(st<0||s(S.stallionState)==7){pause(0);return;}
 if(s(S.stallionState)==3&&s(S.sT)>4.5){w(S.chargeCd,5);w(S.chargeTarget,0);state(4,121);return;}
 pause(121);
}
function stallionHealth():void{
 const st=Read.referenceSlot(s(S.stallionTick));
 if(s(S.beaten)==0&&m(st,M.hp)<m(st,M.maxHp)*.25){
  w(S.beaten,1);w(S.beatenT,90);w(S.beatenHandle,m(st,M.handle));state(6,122);return;
 }
 pause(124);
}
function stallionModes():void{
 const st=Read.referenceSlot(s(S.stallionTick));if(s(S.stallionState)==6){
  w(S.beatenT,s(S.beatenT)-s(S.tickDt));
  if(s(S.beatenT)<=0){w(S.beaten,0);Do.native(A.health,m(st,M.handle),Math.max(m(st,M.hp),m(st,M.maxHp)*.3));pause(125);return;}
  pause(0);return;
 }
 if(s(S.mode)==3){if(s(S.stallionState)!=3){state(5,0);return;}pause(0);return;}
 const dx=m(st,M.x)-c(C.px),dy=m(st,M.y)-c(C.py),dz=m(st,M.z)-c(C.pz);
 w(S.standingDistance,Math.sqrt(dx*dx+dy*dy+dz*dz));
 Do.native(A.environmentCrouched);pause(126);
}
function standingModes():void{
 const st=Read.referenceSlot(s(S.stallionTick)),d=s(S.standingDistance),mode=i32(s(S.stallionState));
 switch(mode){
  case 0:case 5:
   if(d<30&&m(st,M.aw)>.25){state(1,0);return;}if(mode==5){state(0,0);return;}break;
  case 1:
   if(d>36){state(0,0);return;}if(d<20&&c(C.reply)==0&&s(S.sT)>1.2){state(2,0);return;}break;
  case 2:
   if(s(S.sT)>2.2){
    if(d<10&&s(S.trust)<20&&s(S.chargeCd)<=0){w(S.chargeTarget,0);state(3,0);return;}
    if(d<20&&s(S.trust)>=20){flight(c(C.px),c(C.pz),false,0);return;}
    state(d<30?1:0,0);return;
   }break;
  case 4:if(s(S.sT)>2.2){state(0,0);return;}break;
 }
 pause(0);
}
/** signal 1 tick; 2 initialize; 3 stampede; 4 leadAway; 5 addTrust;
 * 6 setRidden; 7 adopt; 8 release; 9 disturb. Input handles are native loans. */
export function run(signal:i32,pc:i32):void{
 if(pc==0){
  if(signal==1){beginTick();return;}
  if(signal==2){assert(s(S.initialized)==0);w(S.spotT,20+Read.random()*40);w(S.initialized,1);pause(0);return;}
  if(signal==3||signal==4){flight(c(C.argX),c(C.argZ),signal==3,0);return;}
  if(signal==5){w(S.trust,Math.min(100,Math.max(0,s(S.trust)+c(C.argument))));pause(0);return;}
  if(signal==6){
   const old=role(S.ridden),handle=c(C.argHandle);if(old>=0)mem(old,M.ridden,0);w(S.ridden,handle);
   if(handle!=0){const slot=Read.referenceSlot(handle);mem(slot,M.ridden,1);if(handle==s(S.stallion)){state(7,0);return;}}
   else if(s(S.stallionState)==7){state(0,0);return;}pause(0);return;
  }
  if(signal==7){Do.native(A.appendMember,c(C.argHandle));pause(160);return;}
  if(signal==8){const old=role(S.stallion);if(old>=0)mem(old,M.ridden,1);w(S.stallion,0);w(S.alertOwned,0);pause(0);return;}
  if(signal==9){
   let near:f64=Infinity;for(let i=0;i<Read.members();i++)if(m(i,M.alive)!=0)near=Math.min(near,hypot(m(i,M.x)-c(C.argX),m(i,M.z)-c(C.argZ)));
   if(near<15){flight(c(C.argX),c(C.argZ),true,0);return;}
   if(near<40)for(let i=0;i<Read.members();i++)mem(i,M.aw,Math.max(m(i,M.aw),c(C.alertThreshold)));
   pause(0);return;
  }
  unreachable();return;
 }
 switch(pc){
  case 101:senseNext();return;
  case 102:senseStart();return;
  case 103:afterVisibility();return;
  case 104:afterHearing();return;
  case 105:if(c(C.reply)!=0)w(S.senseRate,Math.max(s(S.senseRate),.3*(2-s(S.senseDistance)/40)));afterSenses();return;
  case 106:finishSense();return;
  case 107:afterSenses();return;
  case 108:senseCalm();return;
  case 109:if(c(C.reply)!=0&&c(C.playerSpeed)>10&&s(S.senseDistance)<8){flight(c(C.px),c(C.pz),true,108);return;}senseCalm();return;
  case 110:afterMembers();return;
  case 111:Do.native(A.onFlight,s(S.flightStampede));pause(114);return;
  case 114:if(s(S.flightStampede)!=0){Do.native(A.event,c(C.stampede),s(S.cx),s(S.cz));pause(i32(s(S.flightReturn)));return;}pause(i32(s(S.flightReturn)));return;
  case 112:afterThreat();return;
  case 113:threatCharge();return;
  case 115:modes();return;
  case 116:{const lead=role(S.lead);if(lead>=0&&m(lead,M.alive)!=0)w(S.mode,hypot(s(S.spotX)-m(lead,M.x),s(S.spotZ)-m(lead,M.z))>6?1:0);pause(120);return;}
  case 117:for(let i=0;i<Read.members();i++)mem(i,M.aw,Math.min(m(i,M.aw),.2));if(s(S.stallionState)==5){state(0,120);return;}pause(120);return;
  case 120:stallion();return;
  case 121:stallionHealth();return;
  case 122:Do.native(A.onBeaten,s(S.beatenHandle));pause(123);return;
  case 123:{const st=Read.referenceSlot(s(S.beatenHandle));Do.native(A.event,c(C.stallionBeaten),m(st,M.x),m(st,M.z));pause(124);return;}
  case 124:stallionModes();return;
  case 125:state(0,0);return;
  case 126:standingModes();return;
  case 130:{const st=role(S.stallion);if(s(S.stateRequested)==2&&st>=0){Do.native(A.event,c(C.stallionDisplay),m(st,M.x),m(st,M.z));pause(131);return;}pause(i32(s(S.stateReturn)));return;}
  case 131:pause(i32(s(S.stateReturn)));return;
  case 140:pickAttempt();return;
  case 142:if(c(C.reply)<.85||hypot(s(S.pickX)-c(C.px),s(S.pickZ)-c(C.pz))<40){pickAgain();return;}w(S.spotX,s(S.pickX));w(S.spotZ,s(S.pickZ));w(S.spotT,60+Read.contextRandom()*60);pause(i32(s(S.pickReturn)));return;
  case 150:bendAttempt();return;
  case 152:if(c(C.reply)>.72){pause(153);return;}bendAgain();return;
  case 153:if(s(S.fleeRun)>s(S.fleeLen)||s(S.modeT)>16){w(S.mode,4);w(S.modeT,0);w(S.stampeding,0);}pause(120);return;
  case 160:w(S.stallion,c(C.argHandle));state(0,0);return;
 }
 unreachable();
}
