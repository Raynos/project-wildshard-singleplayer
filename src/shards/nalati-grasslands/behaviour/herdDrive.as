// R10c importable herd law. The wrapper supplies profile-local numeric bindings.
// Native operations are detached intents. Query/native barriers resume at the
// SAME original member slot; no guest import or delayed continuation is used.
import { S, C, M, A, Read, Do } from './herdBindings';
@inline function s(key:i32):f64{return Read.state(key);}
@inline function w(key:i32,value:f64):void{Do.state(key,value);}
@inline function m(slot:i32,key:i32):f64{return Read.member(slot,key);}
@inline function c(key:i32):f64{return Read.context(key);}
@inline function role(key:i32):i32{return Read.referenceSlot(s(key));}
@inline function memory(slot:i32,key:i32,value:f64):void{Do.memory(slot,key,value);}
@inline function hypot(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
@inline function distance(a:i32,b:i32):f64{
  const dx=m(a,M.x)-m(b,M.x),dy=m(a,M.y)-m(b,M.y),dz=m(a,M.z)-m(b,M.z);
  return Math.sqrt(dx*dx+dy*dy+dz*dz);
}
// Tail 1 follows steering/motion, tail 2 follows stallion steering, and tail 3
// follows the confine barrier. These are per-call scratch, not saved state.
@inline function pause(next:i32):void{Do.resume(next);}
@inline function steering(slot:i32,yaw:f64,speed:f64,turn:f64,next:i32):void{
  Do.native(A.steer,slot,yaw,speed,turn);pause(next);
}
@inline function path(slot:i32,x:f64,z:f64,every:f64,speed:f64,turn:f64,next:i32):void{
  w(S.pathSpeed,speed);w(S.pathTurn,turn);w(S.pathNext,next);
  Do.native(A.pathYaw,slot,x,z,every);pause(10);
}
@inline function motion(slot:i32,yaw:f64,speed:f64,turn:f64,next:i32):void{
  Do.native(A.motion,slot,yaw,speed,turn);pause(next);
}
@inline function ordinaryTail(slot:i32):void{
  const mode=i32(s(S.mode));
  if((mode==0||mode==1)&&m(slot,M.aw)>.2){Do.native(A.look,slot,c(C.px),c(C.py),c(C.pz));Do.native(A.lookWeight,slot,.7);}
  memory(slot,M.headUp,s(S.headUp));Do.native(A.confine,slot);pause(0);
}
@inline function stallionTail(slot:i32):void{Do.native(A.confine,slot);pause(0);}

/** One horse's original AI/body drive. The caller first captures this horse and
 * the current ordered roster. It must not precompute drives for later horses. */
export function drive(slot:i32,body:bool,resume:i32):void{
  if(resume==1){ordinaryTail(slot);return;}
  if(resume==2){stallionTail(slot);return;}
  if(resume==10){steering(slot,c(C.reply),s(S.pathSpeed),s(S.pathTurn),i32(s(S.pathNext)));return;}
  if(resume==11){ordinaryAfterTrample(slot);return;}
  if(resume==12){stallionAfterTrample(slot);return;}
  if(resume==20){driveStallion(slot);return;}
  if(resume==21){afterPassThrough(slot);return;}
  if(resume==46){const through=c(C.reply)==0&&((s(S.stampeding)!=0&&s(S.mode)==3)||s(S.passCommitted)!=0);Do.native(A.passThrough,slot,through?1:0);pause(21);return;}
  if(resume==47){if(c(C.reply)==0){memory(slot,M.hitP,1);w(S.knockCd,1.2);Do.native(A.hurt,slot,30);pause(40);return;}trampleFind(slot);return;}
  if(resume==22){finishDrift(slot,c(C.reply));return;}
  if(resume==23){afterMotion(slot);return;}
  if(resume==24){afterGuardMotion(slot);return;}
  if(resume==25){afterDisplayMotion(slot);return;}
  if(resume==26){afterChargeMotion(slot);return;}
  if(resume==27){afterLeadMotion(slot);return;}
  if(resume==28){afterBeatenMotion(slot);return;}
  if(resume>=30&&resume<=36){chargeResume(slot,resume);return;}
  if(resume>=40&&resume<=45){trampleResume(slot,resume);return;}
  assert(s(S.initialized)==1);
  const stallion=role(S.stallion),state=i32(s(S.stallionState)),mode=i32(s(S.mode));
  const committed=slot==stallion&&state==3;
  if(body!=committed||slot==role(S.ridden)||m(slot,M.ridden)==1){pause(0);return;}
  w(S.passCommitted,committed?1:0);
  // The original environment getter runs before pass-through, after the
  // committed/body gate. It may reenter; committed remains the old local.
  Do.native(A.environmentMounted);pause(46);
}
export function afterPassThrough(slot:i32):void{
  if(slot==role(S.stallion)){driveStallion(slot);return;}
  const mode=i32(s(S.mode)),px=m(slot,M.x),pz=m(slot,M.z);
  const foal=m(slot,M.foal)!=0,mother=i32(m(slot,M.mother));
  let sepX:f64=0,sepZ:f64=0,aliX:f64=0,aliZ:f64=0,nAli:i32=0;
  for(let other=0;other<Read.members();other++){
    if(other==slot||m(other,M.alive)==0||other==role(S.ridden))continue;
    const ox=px-m(other,M.x),oz=pz-m(other,M.z),d=hypot(ox,oz);
    if(d<2.5&&d>1e-3){const f=(2.5-d)/2.5;sepX+=ox/d*f;sepZ+=oz/d*f;}
    if(d<8&&m(other,M.speed)>.5){aliX+=Math.sin(m(other,M.yaw));aliZ+=Math.cos(m(other,M.yaw));nAli++;}
  }
  const cdx=s(S.cx)-px,cdz=s(S.cz)-pz,cd=hypot(cdx,cdz),coh=cd>12?Math.min(1,(cd-12)/10):0;
  let vx:f64=0,vz:f64=0,speed:f64=0,headUp:f64=0;
  switch(mode){
    case 0:case 1:{
      if(foal&&mother>=0&&m(mother,M.alive)!=0){
        const md=distance(slot,mother);
        if(md>4){vx=m(mother,M.x)-px;vz=m(mother,M.z)-pz;speed=md>10?c(C.trot):c(C.walk)*1.1;break;}
      }
      if(mode==1){
        const lead=role(S.lead);let tx=s(S.spotX),tz=s(S.spotZ);
        if(slot!=lead&&lead>=0&&m(lead,M.alive)!=0){tx=m(lead,M.x)-Math.sin(m(lead,M.yaw))*4;tz=m(lead,M.z)-Math.cos(m(lead,M.yaw))*4;}
        const td=hypot(tx-px,tz-pz);
        if(slot==lead||td>6||coh>0){
          // The route result is a native synchronous barrier. Stash only the
          // numeric boid terms already observed before that original call.
          w(S.sepX,sepX);w(S.sepZ,sepZ);w(S.aliX,nAli>0?aliX/f64(nAli)*.4:0);w(S.aliZ,nAli>0?aliZ/f64(nAli)*.4:0);
          w(S.planSpeed,td>30?c(C.trot)*.8:c(C.walk));w(S.headUp,0);
          if(td>8){Do.native(A.pathYaw,slot,tx,tz,2);pause(22);return;}
          finishDrift(slot,Math.atan2(tx-px,tz-pz));return;
        }break;
      }
      // Presence is explicit: reading an absent gt consumes one shared draw;
      // a present zero does not. gt/gs updates remain before native motion.
      const gt=(m(slot,M.gtPresent)!=0?m(slot,M.gt):Read.random()*6)-c(C.dt);memory(slot,M.gt,gt);
      if(coh>0){vx=cdx/cd;vz=cdz/cd;speed=c(C.walk)*(.6+coh*.6);break;}
      if(hypot(sepX,sepZ)>.35){vx=sepX;vz=sepZ;speed=.8;break;}
      let gyaw=m(slot,M.gyawPresent)!=0?m(slot,M.gyaw):m(slot,M.yaw),gs=m(slot,M.gs);
      if(gt<=0){memory(slot,M.gt,4+Read.random()*10);gyaw=m(slot,M.yaw)+(Read.random()-.5)*2;memory(slot,M.gyaw,gyaw);gs=1.2+Read.random()*1.5;memory(slot,M.gs,gs);}
      if(gs>0){memory(slot,M.gs,gs-c(C.dt));vx=Math.sin(gyaw);vz=Math.cos(gyaw);speed=.7;}break;
    }
    case 2:
      headUp=1;Do.native(A.look,slot,c(C.px),c(C.py),c(C.pz));Do.native(A.lookWeight,slot,1);
      if(foal&&mother>=0&&m(mother,M.alive)!=0&&distance(slot,mother)>2.5){vx=m(mother,M.x)-px;vz=m(mother,M.z)-pz;speed=c(C.trot)*.7;}break;
    case 3:{
      vx=s(S.fleeX)+sepX*.8+cdx/(cd!=0?cd:1)*coh*.6;vz=s(S.fleeZ)+sepZ*.8+cdz/(cd!=0?cd:1)*coh*.6;
      speed=c(C.gallop)*(s(S.stampeding)!=0?1.04:.96)*(.96+.08*((m(slot,M.seed)*13)%1))*(foal?.85:1);
      if(s(S.fleeRun)>s(S.fleeLen)-20)speed=c(C.trot)*1.3;headUp=.3;
      if(s(S.stampeding)!=0&&m(slot,M.speed)>6){w(S.vx,vx);w(S.vz,vz);w(S.planSpeed,speed);w(S.headUp,headUp);trample(slot,11);return;}break;
    }
    case 4:
      headUp=1;if(s(S.modeT)<2.5){vx=s(S.fleeX);vz=s(S.fleeZ);speed=c(C.trot)*(1-s(S.modeT)/3);}
      Do.native(A.look,slot,s(S.fleeFromX),m(slot,M.y),s(S.fleeFromZ));Do.native(A.lookWeight,slot,1);break;
  }
  w(S.headUp,headUp);ordinaryMotion(slot,vx,vz,speed);
}
export function finishDrift(slot:i32,yaw:f64):void{
  const vx=Math.sin(yaw)+s(S.sepX)*1.5+s(S.aliX),vz=Math.cos(yaw)+s(S.sepZ)*1.5+s(S.aliZ);
  ordinaryMotion(slot,vx,vz,s(S.planSpeed));
}
function ordinaryAfterTrample(slot:i32):void{ordinaryMotion(slot,s(S.vx),s(S.vz),s(S.planSpeed));}
function ordinaryMotion(slot:i32,vx:f64,vz:f64,speed:f64):void{
  const mode=i32(s(S.mode));
  if(speed>.05&&hypot(vx,vz)>1e-3){Do.native(A.actorState,slot,mode==3?3:1);steering(slot,Math.atan2(vx,vz),speed*m(slot,M.speedMod),mode==3?3:1.6,1);}
  else{Do.native(A.actorState,slot,mode==0?0:2);motion(slot,m(slot,M.yaw),0,1.5,23);}
}
export function afterMotion(slot:i32):void{
  if(s(S.mode)==0)Do.native(A.lookWeight,slot,m(slot,M.aw)>.15?.6:0);
  ordinaryTail(slot);
}
function stallionAfterTrample(slot:i32):void{stallionTail(slot);}

/** Guard movement is selected by the guest; pathing/contact services remain
 * native barriers and no callback is evaluated inside this module. */
function driveStallion(slot:i32):void{
  const state=i32(s(S.stallionState)),px=c(C.px),py=c(C.py),pz=c(C.pz),x=m(slot,M.x),z=m(slot,M.z),toP=Math.atan2(px-x,pz-z);
  memory(slot,M.headUp,0);memory(slot,M.pin,0);memory(slot,M.rear,0);Do.native(A.look,slot,px,py,pz);Do.native(A.lookWeight,slot,0);
  switch(state){
    case 0:case 1:{
      const tx=px-s(S.cx),tz=pz-s(S.cz),raw=hypot(tx,tz),td=raw!=0?raw:1,out=Math.min(20,Math.max(10,td*.5));
      const gx=s(S.cx)+tx/td*out,gz=s(S.cz)+tz/td*out,gd=hypot(gx-x,gz-z);
      memory(slot,M.headUp,1);Do.native(A.lookWeight,slot,1);
      if(gd>3){Do.native(A.actorState,slot,1);path(slot,gx,gz,1.5,gd>15?c(C.trot):c(C.walk),1.8,24);}
      else{Do.native(A.actorState,slot,2);motion(slot,toP,0,1.2,24);}return;
    }
    case 2:
      Do.native(A.actorState,slot,2);motion(slot,toP,0,3,25);return;
    case 3:{
      // Native target references can be cross-group. Resolve its current live
      // position at this slot, after the on-state/adoption barrier has returned.
      const tx=c(C.targetX)-x,tz=c(C.targetZ)-z,td=hypot(tx,tz);
      w(S.contactX,tx);w(S.contactZ,tz);w(S.contactDistance,td);w(S.contactReference,c(C.targetHandle));
      Do.native(A.actorState,slot,4);memory(slot,M.pin,1);
      if(td>6)path(slot,c(C.targetX),c(C.targetZ),.5,c(C.charge)*m(slot,M.speedMod),4.5,26);
      else steering(slot,Math.atan2(tx,tz),c(C.charge)*m(slot,M.speedMod),4.5,26);return;
    }
    case 4:Do.native(A.actorState,slot,3);steering(slot,toP+Math.PI+.6,c(C.trot)*1.6,3,2);return;
    case 5:{
      const lx=s(S.cx)-s(S.fleeX)*5+s(S.fleeZ)*6,lz=s(S.cz)-s(S.fleeZ)*5-s(S.fleeX)*6,ld=hypot(lx-x,lz-z);
      Do.native(A.actorState,slot,3);const speed=s(S.mode)==3?c(C.gallop)*(ld>6?1.08:.98):c(C.trot);
      steering(slot,Math.atan2(lx-x+s(S.fleeX)*10,lz-z+s(S.fleeZ)*10),speed,3,27);return;
    }
    case 6:Do.native(A.actorState,slot,0);motion(slot,m(slot,M.yaw),0,1,28);return;
    case 7:stallionTail(slot);return;
  }
  stallionTail(slot);
}
export function afterGuardMotion(slot:i32):void{
  if(s(S.stallionState)==1){
    memory(slot,M.pin,.6);const snT=m(slot,M.snT)-c(C.dt);memory(slot,M.snT,snT);
    if(snT<=0){memory(slot,M.snT,2+Read.random()*2);memory(slot,M.stamp,1);memory(slot,M.toss,1);Do.native(A.sound,slot,c(C.snort));}
  }stallionTail(slot);
}
export function afterDisplayMotion(slot:i32):void{
  memory(slot,M.rear,s(S.sT)<1.6?1:0);memory(slot,M.pin,1);Do.native(A.lookWeight,slot,1);
  if(s(S.sT)<.15)Do.native(A.sound,slot,c(C.neigh));stallionTail(slot);
}
export function afterChargeMotion(slot:i32):void{
  if(s(S.contactDistance)>=1.9*m(slot,M.scale)){stallionTail(slot);return;}
  const x=s(S.contactX),z=s(S.contactZ),length=hypot(x,z),denominator=length!=0?length:1;
  w(S.contactX,x/denominator);w(S.contactZ,z/denominator);
  if(s(S.contactReference)!=0&&m(0,M.contactAlive)!=0){
    Do.native(A.damage,s(S.contactReference),25,s(S.contactX),s(S.contactZ));pause(30);return;
  }
  if(s(S.knockCd)<=0){Do.native(A.chargeContact,slot,1.9*m(slot,M.scale));pause(35);return;}
  chargeFinish(slot);
}
function chargeFinish(slot:i32):void{
  memory(slot,M.kick,1);Do.native(A.sound,slot,c(C.squeal));pause(33);
}
function chargeResume(slot:i32,pc:i32):void{
  if(pc==30){Do.native(A.stagger,s(S.contactReference),s(S.contactX),s(S.contactZ),1);pause(31);return;}
  if(pc==31){
    const kicks=m(slot,M.kicks)+1;memory(slot,M.kicks,kicks);
    if(kicks>=2){Do.native(A.scarePack,s(S.contactReference),40);pause(32);return;}
    chargeFinish(slot);return;
  }
  if(pc==32){
    if(c(C.reply)!=0){Do.native(A.event,c(C.packDrivenOff),m(0,M.contactX),m(0,M.contactZ));pause(36);return;}
    chargeFinish(slot);return;
  }
  if(pc==36){memory(slot,M.kicks,0);chargeFinish(slot);return;}
  if(pc==35){w(S.knockCd,1.5);Do.native(A.knock,s(S.contactX),s(S.contactZ),1);pause(34);return;}
  if(pc==34){chargeFinish(slot);return;}
  if(pc==33){
    w(S.chargeCd,5);w(S.chargeTarget,0);
    if(s(S.stallionState)!=4){w(S.stallionState,4);w(S.sT,0);Do.native(A.onState,4);pause(2);return;}
    stallionTail(slot);return;
  }
}
function trample(slot:i32,after:i32):void{
  w(S.trampleNext,after);
  const dx=m(slot,M.x)-c(C.px),dy=m(slot,M.y)-c(C.py),dz=m(slot,M.z)-c(C.pz);
  if(m(slot,M.hitP)==0&&s(S.knockCd)<=0&&Math.sqrt(dx*dx+dy*dy+dz*dz)<1.7*m(slot,M.scale)){
    Do.native(A.environmentMounted);pause(47);return;
  }
  trampleFind(slot);
}
function trampleFind(slot:i32):void{Do.native(A.findThreat,m(slot,M.x),m(slot,M.z),1.8);pause(42);}
function trampleResume(slot:i32,pc:i32):void{
  if(pc==40){Do.native(A.knock,Math.sin(m(slot,M.yaw)),Math.cos(m(slot,M.yaw)),1);pause(41);return;}
  if(pc==41){trampleFind(slot);return;}
  if(pc==42){
    const handle=c(C.reply);
    if(handle!=0){w(S.trampleTarget,handle);w(S.contactX,Math.sin(m(slot,M.yaw)));w(S.contactZ,Math.cos(m(slot,M.yaw)));Do.native(A.damage,handle,30,s(S.contactX),s(S.contactZ));pause(43);return;}
    finishTrample(slot);return;
  }
  if(pc==43){Do.native(A.stagger,s(S.trampleTarget),s(S.contactX),s(S.contactZ),1);pause(44);return;}
  if(pc==44){finishTrample(slot);return;}
}
export function afterLeadMotion(slot:i32):void{
  if(s(S.stampeding)!=0&&m(slot,M.speed)>6){trample(slot,12);return;}stallionTail(slot);
}
export function afterBeatenMotion(slot:i32):void{memory(slot,M.headUp,0);memory(slot,M.toss,0);stallionTail(slot);}

function finishTrample(slot:i32):void{if(s(S.trampleNext)==11)ordinaryAfterTrample(slot);else stallionAfterTrample(slot);}
