import { Signal, Field, Channel, Read, Do, Params } from './generated/nalatiKokpar';

@inline function get(field:i32):f64 { return Read.field(0,field); }
// Story choices only; the original hosts retain records, actors and presentation.
@inline export function chapterSignal(signal:i32):bool {
  if(signal==Signal.carving) {
    if(get(Field.clueStep)!=0) for(let i:i32=0;i<i32(Params.clues);i++) {
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
  let count:i32=0,i:i32=0;
  if(Params.elites>0)do {
    const killed=get(Field.elite0+i)>0;
    if(killed)Do.channel(Channel.qElite0+i,1);
    if(killed||get(Field.felled0+i)!=0)count++;
    i++;
  }while(i<i32(Params.elites));
  i=0;
  if(Params.feathers>0)do {
    if(i<count&&get(Field.feather0+i)==0) { Do.channel(Channel.qFeather0+i,1); Do.channel(Channel.qNotice0+i,1); }
    i++;
  }while(i<i32(Params.feathers));
  return true;
}
