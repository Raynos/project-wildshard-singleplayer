import { lead } from './stag';
import { Signal, Field, Channel, Read, Do } from './generated/pineLife';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// The page owns objects and frame poses; this guest owns the forest's rules.
@inline export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.lead) { lead(); } else if(signal==Signal.arrival) {
    const draw=Math.max(0,Math.min(1,get(Field.draw)));
    Do.channel(Channel.arrival,get(Field.now)+(get(Field.minimum)+draw*(get(Field.maximum)-get(Field.minimum)))*get(Field.scale));
  } else if(signal==Signal.carcass) {
    if(get(Field.present)==0) {Do.channel(Channel.remove,1);return;}
    const site=get(Field.site),now=get(Field.now),harvest=get(Field.harvest);
    if(site==-1&&now>=get(Field.arrival))Do.channel(Channel.gather,get(Field.distance)>get(Field.reach)?-2:1);
    const left=site==-2||(site>=0&&get(Field.visit)==3);
    if(harvest>=0) {
      Do.channel(Channel.dim,1);
      if(left||now-harvest>get(Field.giveUp)){Do.channel(Channel.fade,1);Do.channel(Channel.remove,1);}
    } else if(left&&now-get(Field.kill)>900)Do.channel(Channel.remove,1);
  } else if(signal==Signal.shelterScore) {
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
  } else if(signal==Signal.guide) {
    Do.channel(Channel.eligible,get(Field.night)<.5&&get(Field.combat)==0?1:0);
  }
}
