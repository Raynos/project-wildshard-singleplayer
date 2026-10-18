import { Signal, Field, Channel, Read, List, Do } from './generated/nalatiAdmission';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// Synchronous spawn events only. The native owner retains bodies, clocks and
// both original random streams; no simulation tick calls this guest.
@inline export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.spot) {
    const angle=(Math.PI*2)*Read.random(),radius=Math.sqrt(Read.random())*get(Field.radius);
    if(Read.radial(angle,radius)!=2)unreachable();
    Do.channel(Channel.x,get(Field.x)+List.at(1));Do.channel(Channel.z,get(Field.z)+List.at(0));
  } else if(signal==Signal.accept) {
    Do.channel(Channel.accept,Math.abs(get(Field.x))<=235&&Math.abs(get(Field.z))<=235&&get(Field.normal)>=.78
      &&get(Field.height)>=get(Field.water)+.3&&get(Field.wet)==0&&get(Field.clash)==0?1:0);
  } else if(signal==Signal.begin) {
    Do.channel(Channel.attempts,40);
  } else if(signal==Signal.yaw) {
    Do.channel(Channel.yaw,(Math.PI*2)*Read.random());
  } else if(signal==Signal.packPlan) {
    Do.channel(Channel.radius,8);
  } else if(signal==Signal.dogPlan) {
    Do.channel(Channel.x,get(Field.x)+14);Do.channel(Channel.z,get(Field.z));Do.channel(Channel.radius,4);
  } else if(signal==Signal.herdStart) {
    Do.channel(Channel.start,Math.floor(Read.random()*get(Field.coats)));
    Do.channel(Channel.count,get(Field.mares)+get(Field.foals)+get(Field.stallion));
  } else if(signal==Signal.herdMember) {
    const index=get(Field.index),mares=get(Field.mares),foals=get(Field.foals),coats=get(Field.coats);
    if(index<mares) {
      Do.channel(Channel.variant,(get(Field.start)+index)%coats);Do.channel(Channel.radius,11);Do.channel(Channel.place,0);
    } else if(index<mares+foals) {
      const foal=index-mares;
      Do.channel(Channel.variant,coats+foal%2);Do.channel(Channel.radius,3);Do.channel(Channel.place,1);
      Do.channel(Channel.mother,foal%Math.max(1,mares));
    } else {
      Do.channel(Channel.variant,coats+2);Do.channel(Channel.radius,4);Do.channel(Channel.place,2);
      Do.channel(Channel.x,16);Do.channel(Channel.z,4);Do.channel(Channel.yaw,0);
    }
  } else if(signal==Signal.foal) {
    Do.channel(Channel.x,-2+4*Read.random());Do.channel(Channel.z,-2+4*Read.random());
  } else if(signal==Signal.pack) {
    Do.channel(Channel.accept,(get(Field.elite)!=0||get(Field.packs)<2)&&get(Field.groups)<8
      &&get(Field.variants)==(get(Field.elite)!=0?5:3)&&get(Field.bodies)+get(Field.variants)<=64?1:0);
  } else if(signal==Signal.bond) {
    Do.channel(Channel.accept,get(Field.bonds)==0&&Math.abs(get(Field.x))<=250&&Math.abs(get(Field.z))<=250?1:0);
    Do.channel(Channel.scale,get(Field.elite)!=0?1.3:0);
  }
}
