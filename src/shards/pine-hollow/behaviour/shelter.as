import { Signal, Field, Channel, Read, Do } from './generated/pineShelter';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// Stateless projections: the host keeps the original herd references and v1 continuation.
export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.shelterScore) {
    let best:f64=0,index:i32=-1;
    const count=i32(get(Field.candidates)),heightBias=get(Field.heightBias),coverBias=get(Field.coverBias);
    for(let i:i32=0;i<count;i++) {
      const site=i+1,score=-(Read.field(site,Field.distance)-heightBias*Read.field(site,Field.height)-coverBias*Read.field(site,Field.cover));
      if(!isFinite(score))unreachable();
      if(index<0||score>best){best=score;index=i;}
    }
    Do.channel(Channel.index,index);Do.channel(Channel.score,best);
  } else if(signal==Signal.shelterPlace) {
    const d=get(Field.distance),r=get(Field.radius)+get(Field.clear);
    Do.channel(Channel.x,get(Field.x)+(get(Field.homeX)-get(Field.x))/d*r);
    Do.channel(Channel.z,get(Field.z)+(get(Field.homeZ)-get(Field.z))/d*r);
  } else if(signal==Signal.shelterStep) {
    const present=get(Field.present)!=0,rain=get(Field.rain),wet=rain>get(Field.wet);
    let hold=get(Field.hold),keep=present;
    if(wet){hold=get(Field.homeHold);keep=true;}
    else if(present&&rain<get(Field.dry)){hold-=get(Field.dt);keep=hold>0;}
    Do.channel(Channel.create,wet&&!present?1:0);Do.channel(Channel.keep,keep?1:0);
    Do.channel(Channel.apply,wet?1:0);Do.channel(Channel.hold,Math.max(0,hold));
  } else if(signal==Signal.shelterGoal) {
    if(get(Field.present)==0){Do.channel(Channel.accept,0);return;}
    if(get(Field.rain)>get(Field.wet)) {
      if(get(Field.spot)==0){Do.channel(Channel.accept,0);return;}
      Do.channel(Channel.x,get(Field.spotX));Do.channel(Channel.z,get(Field.spotZ));Do.channel(Channel.r,get(Field.spotR));
    } else {
      Do.channel(Channel.x,get(Field.homeX));Do.channel(Channel.z,get(Field.homeZ));Do.channel(Channel.r,get(Field.homeR));
    }
    Do.channel(Channel.accept,1);
  }
}
