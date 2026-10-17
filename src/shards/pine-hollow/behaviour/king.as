// Arena, collision, lanes, rings, summons and rewards remain mechanics of the same retained body.
import { Actor, Move, Field, State, Do, Read } from './generated/pineKingDecision';
@inline function get(f:i32):f64{return Read.field(Actor.king,f);}
@inline function set(f:i32,v:f64):void{Do.field(Actor.king,f,v);}
@inline function mode(n:i32):void{State.mode=n;State.modeT=0;set(Field.mode,n);set(Field.modeT,0);}
@inline function request(n:i32):void{set(Field.request,n);}
@inline function pursue(p:i32):void {
 mode(p==2?9:3);const target=Read.nearestPlayer(Actor.king);if(target==0)return;
 Do.move(Actor.king,p==2?Move.lanes:p==1?Move.stalkFast:Move.stalk,target);
}
@inline export function onStart():void {
 State.mode=get(Field.mode);State.modeT=get(Field.modeT);State.strikeCd=get(Field.strikeCd);State.burstCd=get(Field.burstCd);State.summonCd=get(Field.summonCd);State.chain=get(Field.chain);
 const p=i32(get(Field.phase)),m=i32(State.mode);
 if(m==0||m==1){Do.move(Actor.king,Move.reset,Read.nearestPlayer(Actor.king));}
 else if(m==3||m==9)pursue(p);
}
@inline export function onMoveDone(move:i32,ok:bool):void{if(move==Move.reset)pursue(i32(get(Field.phase)));}
@inline export function onThreshold(index:i32):void {
 if(index<0||index>2)return;
 set(Field.phase,index);if(index==1){State.summonCd=1.2;set(Field.summonCd,1.2);}if(index==2){State.chain=0;set(Field.chain,0);}pursue(index);
}
@inline export function onTick(dt:f64):void {
 const p=i32(get(Field.phase)),m=i32(State.mode),target=Read.nearestPlayer(Actor.king);if(target==0)return;
 const time=State.modeT+dt,scd=Math.max(0,State.strikeCd-dt),bcd=Math.max(0,State.burstCd-dt),acd=Math.max(0,State.summonCd-dt);
 State.modeT=time;State.strikeCd=scd;State.burstCd=bcd;State.summonCd=acd;
 set(Field.modeT,time);set(Field.strikeCd,scd);set(Field.burstCd,bcd);set(Field.summonCd,acd);
 const d=Read.distance(Actor.king,target);
 if(m==3){
  if(p>0&&acd<=0&&get(Field.adds)<3){mode(8);Do.move(Actor.king,Move.faceCall,target);return;}
  if(d<7.1&&scd<=0){mode(4);Do.move(Actor.king,Move.face,target);return;}
  if(bcd<=0&&time>1){mode(5);Do.move(Actor.king,Move.face,target);return;}
  if(!Read.moving(Actor.king))Do.move(Actor.king,p==1?Move.stalkFast:Move.stalk,target);
 }else if(m==4&&time>=.9){request(1);State.strikeCd=5;set(Field.strikeCd,5);pursue(p);}
 else if(m==5&&time>=1){request(2);mode(6);Do.move(Actor.king,Move.faceCall,target);}
 else if(m==6&&get(Field.rings)==0){mode(7);Do.move(Actor.king,Move.faceOpen,target);}
 else if(m==7&&time>=(p==1?2.6:3.2)){State.burstCd=p==1?7.5:9;set(Field.burstCd,State.burstCd);pursue(p);}
 else if(m==8&&time>=1.6){request(3);State.summonCd=20;set(Field.summonCd,20);pursue(p);}
 else if(m==9){
  const lane=get(Field.lane);
  if(lane>0){State.wasLane=true;return;}
  if(State.wasLane){State.wasLane=false;State.modeT=i32(State.chain)%3==0?-1.5:.4;set(Field.modeT,State.modeT);return;}
  if(bcd<=0&&d<14){mode(5);Do.move(Actor.king,Move.face,target);return;}
  if(time>1.2){Do.stop(Actor.king);request(4);State.modeT=0;State.chain+=1;set(Field.modeT,0);set(Field.chain,State.chain);}
  else if(!Read.moving(Actor.king))Do.move(Actor.king,Move.lanes,target);
 }
}
@inline export function onStop():void {Do.stop(Actor.king);set(Field.fighting,0);mode(0);}
@inline export function onDeath(killer:i32):void {Do.stop(Actor.king);mode(2);}
