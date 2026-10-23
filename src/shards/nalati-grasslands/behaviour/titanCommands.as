// Same-call effects at the original native barriers; no clock or stored state.
import {onSignal as project} from './titanClockFrame';
import {Signal,Field,Channel,Read,Do} from './generated/nalatiTitanCombined';
export function onSignal(signal:i32,value:f64,source:i32):void{
  if(signal==Signal.zzzzIgnite)Do.ignite(1,Read.field(0,Field.x),Read.field(0,Field.z));
  else if(signal==Signal.zzzzDismount)Do.dismount(1,true);
  else if(signal==Signal.zzzzIntroClock){
    const t=Read.field(0,Field.t),old=Read.field(0,Field.zzzzIntroT),tick=old<0||t-old>=.1-1e-9;
    Do.channel(Channel.zzzzIntroT,tick?t:old);Do.channel(Channel.zzzzIntroTick,tick?1:0);
  }else project(signal,value,source);
}
