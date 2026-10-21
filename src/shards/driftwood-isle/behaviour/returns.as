import { Signal, Field, Channel, Read, List, Do } from './generated/driftwoodReturns';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// Event-only projections. Queue clocks, identities and bodies remain host-owned.
@inline export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.practice) {
    const dead=get(Field.dead)+(get(Field.alive)==0?get(Field.dt):0);
    Do.channel(Channel.dead,dead);
    Do.channel(Channel.action,get(Field.alive)!=0||dead<get(Field.delay)||get(Field.distance)<get(Field.away)?0:get(Field.hidden)!=0?2:1);
  } else if(signal==Signal.schedule) {
    Do.channel(Channel.due,get(Field.now)+get(Field.minimum)+(get(Field.maximum)-get(Field.minimum))*get(Field.draw));
  } else if(signal==Signal.eligible) {
    const dx=get(Field.x)-get(Field.playerX),dz=get(Field.z)-get(Field.playerZ),away=get(Field.away);
    Do.channel(Channel.eligible,get(Field.now)>=get(Field.due)&&(get(Field.nocturnal)==0||get(Field.night)>=.5)&&dx*dx+dz*dz>=away*away?1:0);
  } else if(signal==Signal.perchScore) {
    let best:f64=0,index:i32=-1;
    const count=i32(get(Field.candidates));
    for(let i:i32=0;i<count;i++) {
      const site=i+1,score=Read.field(site,Field.awayDistance)*.5-Read.field(site,Field.distance)*.3-Read.field(site,Field.occupied)*30+Read.random()*3;
      if(!isFinite(score))unreachable();
      if(index<0||score>best){best=score;index=i;}
    }
    Do.channel(Channel.index,index);Do.channel(Channel.score,best);
  } else if(signal==Signal.perchHeight) {
    Do.channel(Channel.perchH,Math.max(.5,get(Field.y)-get(Field.ground)+.05));
  } else if(signal==Signal.place) {
    const homeX=get(Field.x),homeZ=get(Field.z),fixed=get(Field.fixed)!=0,water=get(Field.water);
    let x=homeX,z=homeZ;
    if(!fixed) for(let k:i32=0;k<6;k++) {
      const angle=Read.random()*Math.PI*2,radius=1+Read.random()*4;
      if(Read.radial(angle,radius)!=2)unreachable();
      const tx=homeX+List.at(1),tz=homeZ+List.at(0);
      if(Read.groundHeight(tx,tz)!=1)unreachable();
      if(List.at(0)>water+.15){x=tx;z=tz;break;}
    }
    // Preserve the old final land query, including fixed (deck) placements.
    if(Read.groundHeight(x,z)!=1)unreachable();
    Do.channel(Channel.retry,!fixed&&List.at(0)<=water+.15?get(Field.now)+60:0);
    Do.channel(Channel.x,x);Do.channel(Channel.z,z);
  }
}
