export enum S{alert=0,alertOwned=1,aliX=2,aliZ=3,beaten=4,beatenHandle=5,beatenT=6,bendIndex=7,bolt=8,chargeCd=9,chargeTarget=10,contactDistance=11,contactReference=12,contactX=13,contactZ=14,cx=15,cz=16,fleeFromX=17,fleeFromZ=18,fleeLen=19,fleeRun=20,fleeX=21,fleeZ=22,flightReturn=23,flightStampede=24,groupTime=25,groupTimePresent=26,headUp=27,initialized=28,knockCd=29,lead=30,maxAw=31,mode=32,modeT=33,moved=34,passCommitted=35,pathNext=36,pathSpeed=37,pathTurn=38,pickHandle=39,pickIndex=40,pickReturn=41,pickX=42,pickZ=43,planSpeed=44,ridden=45,sT=46,senseAw=47,senseBearing=48,senseDistance=49,senseRate=50,senseSlot=51,sepX=52,sepZ=53,spotT=54,spotX=55,spotZ=56,stallion=57,stallionState=58,stallionTick=59,stampeding=60,standingDistance=61,stateRequested=62,stateReturn=63,tickDt=64,tickStallion=65,tickThreat=66,trampleNext=67,trampleTarget=68,trust=69,vx=70,vz=71,continuation=72}
export enum C{alertThreshold=0,argHandle=1,argX=2,argZ=3,argument=4,calm=5,charge=6,cone=7,dt=8,flightMax=9,flightMin=10,gallop=11,grazingSight=12,maxX=13,maxZ=14,minX=15,minZ=16,neigh=17,packDrivenOff=18,playerSpeed=19,px=20,py=21,pz=22,reply=23,sight=24,snort=25,squeal=26,stallionBeaten=27,stallionDisplay=28,stampede=29,targetAlive=30,targetHandle=31,targetX=32,targetZ=33,threatX=34,threatY=35,threatZ=36,time=37,trot=38,walk=39}
export enum M{alarm=0,alarmT=1,alive=2,aw=3,contactAlive=4,contactX=5,contactY=6,contactZ=7,foal=8,grazing=9,gs=10,gt=11,gtPresent=12,gyaw=13,gyawPresent=14,handle=15,headUp=16,hitP=17,hitT=18,hitTPresent=19,hitTValid=20,hp=21,kick=22,kicks=23,lastHitSeconds=24,lastHitValid=25,maxHp=26,mother=27,pin=28,rear=29,reply=30,ridden=31,scale=32,seed=33,snT=34,speed=35,speedMod=36,stamp=37,targetAlive=38,targetHandle=39,targetX=40,targetY=41,targetZ=42,threatX=43,threatY=44,threatZ=45,toss=46,x=47,y=48,yaw=49,z=50}
export enum A{actorState=1,appendMember=2,chargeContact=3,confine=4,damage=5,downwind=6,environmentCrouched=7,environmentMounted=8,event=9,findThreat=10,health=11,hearing=12,hurt=13,knock=14,look=15,lookWeight=16,motion=17,normal=18,onBeaten=19,onFlight=20,onState=21,passThrough=22,pathYaw=23,scarePack=24,sound=25,stagger=26,steer=27,visibility=28}
export const SLOT:i32=113;export const BODY:i32=114;

import * as core from '../sdk/as/wsV2';
import * as bank from '../sdk/as/groupBankV2.herd';
import * as slots from '../sdk/as/groupStepV2.herd';
export class Read{
 @noInline static state(key:i32):f64{return bank.value(key);}
 @noInline static context(key:i32):f64{
  if(key==C.reply)return slots.member(0,M.reply);
  if(key==C.targetHandle)return slots.member(0,M.targetHandle);
  if(key==C.targetAlive)return slots.member(0,M.targetAlive);
  if(key==C.targetX)return slots.member(0,M.targetAlive)==0?bank.value(73+C.px):slots.member(0,M.targetX);
  if(key==C.targetZ)return slots.member(0,M.targetAlive)==0?bank.value(73+C.pz):slots.member(0,M.targetZ);
  if(key==C.threatX)return slots.member(0,M.threatX);
  if(key==C.threatY)return slots.member(0,M.threatY);
  if(key==C.threatZ)return slots.member(0,M.threatZ);
  return bank.value(73+key);
 }
 @noInline static member(slot:i32,key:i32):f64{return slots.member(slot,key);}
 @noInline static members():i32{return slots.memberCount();}
 @noInline static referenceSlot(handle:f64):i32{if(handle==0)return -1;for(let i=0;i<slots.memberCount();i++)if(slots.member(i,M.handle)==handle)return i;unreachable();return -1;}
 @noInline static random():f64{return core.random(1);}
 @noInline static contextRandom():f64{return core.random(2);}
}
export class Do{
 @noInline static state(key:i32,value:f64):void{bank.write(key,value);}
 @noInline static memory(slot:i32,key:i32,value:f64):void{core.pageOutput(100+key,slot,value);}
 @noInline static native(action:i32,a:f64=0,b:f64=0,c:f64=0,d:f64=0):void{core.pageOutput(action,a,b,c,d);}
 @noInline static resume(next:i32):void{bank.write(S.continuation,next);}
}
