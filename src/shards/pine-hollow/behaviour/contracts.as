import {Signal,Field,Channel,Read,Do} from './generated/pineContracts';
import {contractRandom} from './contractsRandom';
import {contractTag,contractElite,contractCounts,contractProgress,contractLoadedProgress,contractNear} from './contractsRules';
@inline function get(id:i32):f64{return Read.field(0,id);}
@inline function a(i:i32):f64{return get(Field.a00+i);}
@inline function b(i:i32):f64{return get(Field.b00+i);}
@inline function c(i:i32):f64{return get(Field.c00+i);}
@inline function count():i32{const size=i32(get(Field.count));assert(size>=0&&size<=4);return size;}
export function onSignal(signal:i32,_value:f64,_source:i32):void{
 if(signal==Signal.random){Do.channel(Channel.value,contractRandom(get(Field.serial),get(Field.salt)));return;}
 if(signal==Signal.tag){
  let found=false;
  for(let i=0;i<count();i++)if(contractTag(get(Field.kind),get(Field.variant),get(Field.label),a(i),b(i),c(i))){found=true;break;}
  Do.channel(Channel.value,found?1:0);return;
 }
 if(signal==Signal.elite){
  let index=-1;
  for(let i=0;i<count();i++)if(contractElite(get(Field.kind),get(Field.variant),a(i),b(i))){index=i;break;}
  Do.channel(Channel.index,index);return;
 }
 if(signal==Signal.count){Do.channel(Channel.value,contractCounts(i32(get(Field.match)),get(Field.target),get(Field.kind),get(Field.elite),get(Field.tagged)!=0,get(Field.excluded)!=0,get(Field.excludeElite)!=0,get(Field.rank),get(Field.targetRank),get(Field.knownRank)!=0,get(Field.below))?1:0);return;}
 if(signal==Signal.progress){const have=get(Field.have),next=contractProgress(have,get(Field.need),get(Field.accepted)!=0);Do.channel(Channel.have,next);Do.channel(Channel.moved,next!=have?1:0);return;}
 if(signal==Signal.loaded){Do.channel(Channel.have,contractLoadedProgress(get(Field.have),get(Field.need)));return;}
 if(signal==Signal.near){Do.channel(Channel.value,contractNear(get(Field.x),get(Field.y),get(Field.z),get(Field.px),get(Field.py),get(Field.pz),get(Field.radius))?1:0);return;}
 if(signal==Signal.draw){
  const first=get(Field.first),serial=get(Field.serial),salt=get(Field.salt);
  if(first>=0){Do.channel(Channel.index,first);Do.channel(Channel.band,-1);Do.channel(Channel.target,-1);return;}
  const random=contractRandom(serial,salt),target=contractRandom(serial,salt+101);
  for(let i=0;i<count();i++)if(random<a(i)){
   Do.channel(Channel.index,-1);Do.channel(Channel.band,i);Do.channel(Channel.target,Math.min(b(i)-1,Math.floor(target*b(i))));return;
  }
  Do.channel(Channel.index,-1);Do.channel(Channel.band,-1);Do.channel(Channel.target,-1);return;
 }
 if(signal==Signal.collision){
  let clash=false;
  for(let i=0;i<count();i++)if(a(i)==get(Field.candidate)){clash=true;break;}
  Do.channel(Channel.value,clash?1:0);return;
 }
 if(signal==Signal.drawFinish){
  if(get(Field.excluded)==0){Do.channel(Channel.retry,0);Do.channel(Channel.index,get(Field.candidate));return;}
  const salt=get(Field.salt)+1;
  Do.channel(Channel.retry,salt<get(Field.attempts)?1:0);Do.channel(Channel.salt,salt);
  Do.channel(Channel.index,get(Field.fallback));return;
 }
 if(signal==Signal.claim){
  if(get(Field.valid)==0||get(Field.have)<get(Field.need)){Do.channel(Channel.status,0);return;}
  const claimed=get(Field.claimed)+1,streak=get(Field.streak)+1;
  let milestone=-1;
  for(let i=0;i<count();i++)if(a(i)==claimed){milestone=i;break;}
  Do.channel(Channel.status,1);Do.channel(Channel.claimed,claimed);Do.channel(Channel.streak,streak);
  Do.channel(Channel.best,Math.max(get(Field.best),streak));Do.channel(Channel.next,get(Field.next)+1);Do.channel(Channel.milestone,milestone);return;
 }
 if(signal==Signal.tear){Do.channel(Channel.status,get(Field.valid));if(get(Field.valid)!=0){Do.channel(Channel.streak,0);Do.channel(Channel.next,get(Field.next)+1);}return;}
 if(signal==Signal.use){
  const value=get(Field.value),opened=get(Field.open)!=0,valid=get(Field.valid)!=0;
  let nextOpen=opened,operation=0,slot=-1.0;
  if(valid&&value==1)nextOpen=false;
  else if(valid&&value==0){if(!opened&&get(Field.pointValid)!=0&&contractNear(get(Field.x),get(Field.y),get(Field.z),get(Field.px),get(Field.py),get(Field.pz),get(Field.radius)))nextOpen=true;}
  else if(opened&&valid&&value==Math.floor(value)){
   if(value>=10&&value<=10+get(Field.slots)-1){operation=1;slot=value-10;}
   else if(value>=20&&value<=20+get(Field.slots)-1){operation=2;slot=value-20;}
  }
  Do.channel(Channel.open,nextOpen?1:0);Do.channel(Channel.operation,operation);Do.channel(Channel.slot,slot);return;
 }
 if(signal==Signal.restore){
  const size=i32(get(Field.count)),next=get(Field.next),slots=get(Field.slots),claimed=get(Field.claimed),best=get(Field.best);
  let valid=size==i32(slots)&&next>=slots&&best<=claimed&&get(Field.streak)<=best&&claimed<=next-slots;
  // The native owner lends one candidate at a time, against the same eight-row snapshot.
  const i=i32(get(Field.candidate)),serial=Read.field(i+1,Field.serial);
  if(i<0||i>=size||serial>=next||Read.field(i+1,Field.have)>Read.field(i+1,Field.need)||Read.field(i+1,Field.valid)==0)valid=false;
  if(i>0&&serial==Read.field(1,Field.serial))valid=false;
  if(i>1&&serial==Read.field(2,Field.serial))valid=false;
  if(i>2&&serial==Read.field(3,Field.serial))valid=false;
  if(i>3&&serial==Read.field(4,Field.serial))valid=false;
  if(i>4&&serial==Read.field(5,Field.serial))valid=false;
  if(i>5&&serial==Read.field(6,Field.serial))valid=false;
  if(i>6&&serial==Read.field(7,Field.serial))valid=false;
  Do.channel(Channel.value,valid?1:0);return;
 }
 if(signal==Signal.loadNext){Do.channel(Channel.next,Math.max(get(Field.next),get(Field.serial)+1));return;}
 unreachable();
}
