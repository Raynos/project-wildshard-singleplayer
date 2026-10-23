// One group-tick locomotion plan. Native path/contact/taming slots stay live.
import { S,C,M,Read } from './herdBindings';
import * as core from '../sdk/as/wsV2';
let inputBase:usize=0,outputBase:usize=0,count:i32=0;
export enum P {
 kind=0,state=1,yaw=2,speed=3,turn=4,targetX=5,targetZ=6,pathEvery=7,
 blendX=8,blendZ=9,headUp=10,lookKind=11,lookX=12,lookZ=13,lookWeight=14,
 flags=15,memoryMask=16,gt=17,gyaw=18,gs=19,snT=20,pin=21,rear=22,sound=23,
}
// kind:0 skip,1 motion,2 steer,3 path+blend,4 direct path,5 original charge kernel.
// look:0 unchanged,1 current player,2 supplied XZ/current actor Y; weight -1=keep.
// flags:ordinary tail1,warn post2,display post4,beaten post8,pre-trample16,
// post-trample32,apply fresh actor speed modifier64,post-motion look256,
// original stallion prefix512 (clear headUp/pin/rear, look at player weight0).
// memoryMask:gt1,gyaw2,gs4,snT8,stamp=1 bit16,toss=1 bit32,pin64,rear128.
// Native clears toss for beaten-post; that is not the toss=1 mask bit.
@inline function s(k:i32):f64{assert(k>=0&&k<73);return load<f64>(outputBase+usize(k)*8);}
@inline function c(k:i32):f64{assert(k>=0&&k<40);return load<f64>(outputBase+usize(73+k)*8);}
@inline function m(i:i32,k:i32):f64{assert(i>=0&&i<count&&k>=0&&k<51);return load<f64>(inputBase+usize(i*51+k)*16+8);}
@inline function scratch(k:i32):i32{switch(k){case 0:return 2;case 1:return 3;case 2:return 11;case 3:return 12;case 4:return 13;case 5:return 14;case 6:return 27;case 7:return 35;case 8:return 36;case 9:return 37;case 10:return 38;case 11:return 44;case 12:return 52;case 13:return 53;case 14:return 67;case 15:return 68;case 16:return 70;case 17:return 71;case 18:return 5;case 19:return 7;case 20:return 8;case 21:return 23;case 22:return 24;case 23:return 31;default:unreachable();}return 0;}
@inline function w(i:i32,k:i32,v:f64):void{assert(i>=0&&i<16&&k>=0&&k<24&&Math.abs(v)<Infinity);store<f64>(outputBase+usize(scratch(k))*8,v);}
@inline function r(k:i32):f64{return load<f64>(outputBase+usize(scratch(k))*8);}
@inline function flags(i:i32,v:i32):void{w(i,P.flags,v);}
@inline function hypot(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
@inline function distance(a:i32,b:i32):f64{return Math.sqrt((m(a,M.x)-m(b,M.x))**2+(m(a,M.y)-m(b,M.y))**2+(m(a,M.z)-m(b,M.z))**2);}
@inline function role(k:i32):i32{const h=s(k);if(h==0)return -1;for(let i=0;i<count;i++)if(m(i,M.handle)==h)return i;unreachable();return -1;}
function move(i:i32,vx:f64,vz:f64,speed:f64,mode:i32):void{
 if(speed>.05&&hypot(vx,vz)>1e-3){w(i,P.kind,2);w(i,P.state,mode==3?3:1);w(i,P.yaw,Math.atan2(vx,vz));w(i,P.speed,speed);w(i,P.turn,mode==3?3:1.6);}
 else{w(i,P.kind,1);w(i,P.state,mode==0?0:2);w(i,P.yaw,m(i,M.yaw));w(i,P.turn,1.5);if(mode==0)w(i,P.lookWeight,m(i,M.aw)>.15?.6:0);}
}
function ordinary(i:i32):void{
 const mode=i32(s(S.mode)),x=m(i,M.x),z=m(i,M.z),ridden=role(S.ridden),lead=role(S.lead);
 const foal=m(i,M.foal)!=0,mother=i32(m(i,M.mother));
 let sx:f64=0,sz:f64=0,ax:f64=0,az:f64=0,n:i32=0;
 for(let j=0;j<Read.members();j++)if(j!=i&&m(j,M.alive)!=0&&j!=ridden){
  const dx=x-m(j,M.x),dz=z-m(j,M.z),d=hypot(dx,dz);
  if(d<2.5&&d>1e-3){const f=(2.5-d)/2.5;sx+=dx/d*f;sz+=dz/d*f;}
  if(d<8&&m(j,M.speed)>.5){ax+=Math.sin(m(j,M.yaw));az+=Math.cos(m(j,M.yaw));n++;}
 }
 const dx=s(S.cx)-x,dz=s(S.cz)-z,d=hypot(dx,dz),coh=d>12?Math.min(1,(d-12)/10):0;
 let vx:f64=0,vz:f64=0,speed:f64=0,head:f64=0,mask:i32=0,f:i32=1|64|256;
 switch(mode){
 case 0:case 1:{
  if(foal&&mother>=0&&m(mother,M.alive)!=0){const md=distance(i,mother);if(md>4){vx=m(mother,M.x)-x;vz=m(mother,M.z)-z;speed=md>10?c(C.trot):c(C.walk)*1.1;break;}}
  if(mode==1){
   let tx=s(S.spotX),tz=s(S.spotZ);
   if(i!=lead&&lead>=0&&m(lead,M.alive)!=0){tx=m(lead,M.x)-Math.sin(m(lead,M.yaw))*4;tz=m(lead,M.z)-Math.cos(m(lead,M.yaw))*4;}
   const td=hypot(tx-x,tz-z);
   if(i==lead||td>6||coh>0){
    const bx=sx*1.5+(n>0?ax/f64(n)*.4:0),bz=sz*1.5+(n>0?az/f64(n)*.4:0);
    speed=td>30?c(C.trot)*.8:c(C.walk);
    if(td>8){w(i,P.kind,3);w(i,P.state,1);w(i,P.targetX,tx);w(i,P.targetZ,tz);w(i,P.pathEvery,2);w(i,P.blendX,bx);w(i,P.blendZ,bz);w(i,P.speed,speed);w(i,P.turn,1.6);flags(i,f);return;}
    const yaw=Math.atan2(tx-x,tz-z);vx=Math.sin(yaw)+bx;vz=Math.cos(yaw)+bz;
   }break;
  }
  const gt=(m(i,M.gtPresent)!=0?m(i,M.gt):Read.random()*6)-c(C.dt);w(i,P.gt,gt);mask|=1;
  if(coh>0){vx=dx/d;vz=dz/d;speed=c(C.walk)*(.6+coh*.6);break;}
  if(hypot(sx,sz)>.35){vx=sx;vz=sz;speed=.8;break;}
  let gyaw=m(i,M.gyawPresent)!=0?m(i,M.gyaw):m(i,M.yaw),gs=m(i,M.gs);
  if(gt<=0){w(i,P.gt,4+Read.random()*10);gyaw=m(i,M.yaw)+(Read.random()-.5)*2;w(i,P.gyaw,gyaw);gs=1.2+Read.random()*1.5;w(i,P.gs,gs);mask|=2|4;}
  if(gs>0){w(i,P.gs,gs-c(C.dt));mask|=4;vx=Math.sin(gyaw);vz=Math.cos(gyaw);speed=.7;}break;
 }
 case 2:
  head=1;w(i,P.lookKind,1);w(i,P.lookWeight,1);f&=~256;
  if(foal&&mother>=0&&m(mother,M.alive)!=0&&distance(i,mother)>2.5){vx=m(mother,M.x)-x;vz=m(mother,M.z)-z;speed=c(C.trot)*.7;}break;
 case 3:
  vx=s(S.fleeX)+sx*.8+dx/(d!=0?d:1)*coh*.6;vz=s(S.fleeZ)+sz*.8+dz/(d!=0?d:1)*coh*.6;
  speed=c(C.gallop)*(s(S.stampeding)!=0?1.04:.96)*(.96+.08*((m(i,M.seed)*13)%1))*(foal?.85:1);
  if(s(S.fleeRun)>s(S.fleeLen)-20)speed=c(C.trot)*1.3;head=.3;if(s(S.stampeding)!=0)f|=16;break;
 case 4:
  head=1;if(s(S.modeT)<2.5){vx=s(S.fleeX);vz=s(S.fleeZ);speed=c(C.trot)*(1-s(S.modeT)/3);}
  w(i,P.lookKind,2);w(i,P.lookX,s(S.fleeFromX));w(i,P.lookZ,s(S.fleeFromZ));w(i,P.lookWeight,1);f&=~256;break;
 }
 move(i,vx,vz,speed,mode);w(i,P.headUp,head);w(i,P.memoryMask,mask);
 if((mode==0||mode==1)&&m(i,M.aw)>.2){w(i,P.lookKind,1);w(i,P.lookWeight,.7);}
 flags(i,f);
}
function stallion(i:i32):void{
 const state=i32(s(S.stallionState)),x=m(i,M.x),z=m(i,M.z),px=c(C.px),pz=c(C.pz),toP=Math.atan2(px-x,pz-z);
 let f:i32=512;
 switch(state){
 case 0:case 1:{
  const dx=px-s(S.cx),dz=pz-s(S.cz),raw=hypot(dx,dz),d=raw!=0?raw:1,out=Math.min(20,Math.max(10,d*.5));
  const tx=s(S.cx)+dx/d*out,tz=s(S.cz)+dz/d*out,gd=hypot(tx-x,tz-z);
  w(i,P.headUp,1);w(i,P.lookKind,1);w(i,P.lookWeight,1);
  if(gd>3){w(i,P.kind,4);w(i,P.state,1);w(i,P.targetX,tx);w(i,P.targetZ,tz);w(i,P.pathEvery,1.5);w(i,P.speed,gd>15?c(C.trot):c(C.walk));w(i,P.turn,1.8);}
  else{w(i,P.kind,1);w(i,P.state,2);w(i,P.yaw,toP);w(i,P.turn,1.2);}
  if(state==1){f|=2;const t=m(i,M.snT)-c(C.dt);w(i,P.snT,t);w(i,P.pin,.6);w(i,P.memoryMask,f64(8|64));
   if(t<=0){w(i,P.snT,2+Read.random()*2);w(i,P.memoryMask,f64(8|16|32|64));w(i,P.sound,c(C.snort));}}
  break;
 }
 case 2:
  w(i,P.kind,1);w(i,P.state,2);w(i,P.yaw,toP);w(i,P.turn,3);w(i,P.rear,s(S.sT)<1.6?1:0);w(i,P.pin,1);w(i,P.memoryMask,f64(64|128));w(i,P.lookKind,1);w(i,P.lookWeight,1);f|=4;
  if(s(S.sT)<.15)w(i,P.sound,c(C.neigh));break;
 case 3:
  // No frozen target, pose, hit result or contact operands. Original native
  // charge kernel reads/captures/rechecks these at each original 60Hz slot.
  w(i,P.kind,5);break;
 case 4:
  w(i,P.kind,2);w(i,P.state,3);w(i,P.yaw,toP+Math.PI+.6);w(i,P.speed,c(C.trot)*1.6);w(i,P.turn,3);break;
 case 5:{
  const tx=s(S.cx)-s(S.fleeX)*5+s(S.fleeZ)*6,tz=s(S.cz)-s(S.fleeZ)*5-s(S.fleeX)*6,ld=hypot(tx-x,tz-z);
  w(i,P.kind,2);w(i,P.state,3);w(i,P.yaw,Math.atan2(tx-x+s(S.fleeX)*10,tz-z+s(S.fleeZ)*10));w(i,P.speed,s(S.mode)==3?c(C.gallop)*(ld>6?1.08:.98):c(C.trot));w(i,P.turn,3);if(s(S.stampeding)!=0)f|=32;break;
 }
 case 6:w(i,P.kind,1);w(i,P.state,0);w(i,P.yaw,m(i,M.yaw));w(i,P.turn,1);f|=8;break;
 case 7:break;
 }
 flags(i,f);
}
export function planDrive(first:i32):void{
 // The entire fixed input/output span is checked once, rather than walking
 // the ABI directory again for every pair in the boid sum. No pointer survives
 // this synchronous projection and the host validates the complete bank.
 count=Read.members();assert(count>0&&core.count(6)==count*51&&core.count(3)==115);
 inputBase=core.row(6,0);outputBase=core.row(3,0);
 for(let i=0;i<count*51;i++){const at=inputBase+usize(i)*16;assert(load<i32>(at)==i+1&&load<i32>(at+4)==1);}
 const st=role(S.stallion),ridden=role(S.ridden);
 for(let i=first;i<Math.min(count,first+8);i++){
  for(let k=0;k<24;k++)w(i,k,0);w(i,P.lookWeight,-1);w(i,P.sound,-1);
  if(m(i,M.alive)!=0&&i!=ridden&&m(i,M.ridden)!=1){if(i==st)stallion(i);else ordinary(i);}
  for(let part=0;part<8;part++)core.pageOutput(200+part,i,r(part*3),r(part*3+1),r(part*3+2));
 }
}
