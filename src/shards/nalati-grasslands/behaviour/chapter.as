import { Signal, Field, Channel, Read, Do, Params } from './generated/nalatiKokpar';

@inline function get(field:i32):f64 { return Read.field(0,field); }
// Process four table entries per loop charge in the shared stateless module.
@inline function elite(i:i32):i32 {
  if(i>=i32(Params.elites))return 0;
  const killed=get(Field.elite0+i)>0;
  if(killed)Do.channel(Channel.qElite0+i,1);
  return killed||get(Field.felled0+i)!=0?1:0;
}
@inline function feather(i:i32,count:i32):void {
  if(i<i32(Params.feathers)&&i<count&&get(Field.feather0+i)==0) {
    Do.channel(Channel.qFeather0+i,1);Do.channel(Channel.qNotice0+i,1);
  }
}
// Story choices only; the original hosts retain records, actors and presentation.
@inline export function chapterSignal(signal:i32):bool {
  if(signal==Signal.carving) {
    if(get(Field.clueStep)!=0) for(let i:i32=0;i<32;i++) {
      if(i>=i32(Params.clues))break;
      if(get(Field.clue0+i)==0) { Do.channel(Channel.qClue0+i,1);break; }
    }
    return true;
  }
  if(signal==Signal.quest) {
    const argymaq=get(Field.argymaq)!=0;
    if(get(Field.bonded)!=0)Do.channel(Channel.qBonded,1);
    if(argymaq)Do.channel(Channel.qArgymaq,1);
    if(get(Field.inside)!=0)Do.channel(Channel.qInside,1);
    if(get(Field.king)!=0)Do.channel(Channel.qKing,1);
    if(get(Field.tied)!=0)Do.channel(Channel.qTied,1);
    if(get(Field.titan)!=0)Do.channel(Channel.qTitan,1);
    return true;
  }
  if(signal!=Signal.feathers)return false;
  let count:i32=0;
  for(let i:i32=0;i<32;i+=4) {
    if(i>=i32(Params.elites))break;
    count+=elite(i)+elite(i+1)+elite(i+2)+elite(i+3);
  }
  for(let i:i32=0;i<32;i+=4) {
    if(i>=i32(Params.feathers))break;
    feather(i,count);feather(i+1,count);feather(i+2,count);feather(i+3,count);
  }
  return true;
}
