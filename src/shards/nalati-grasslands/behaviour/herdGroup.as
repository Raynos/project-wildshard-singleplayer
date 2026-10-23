// One group decision at the original tick. Pure continuation edges stay in
// this invocation; actual native operations still return to their same slot.
import * as core from '../sdk/as/wsV2';
import * as bank from '../sdk/as/groupBankV2.herd';
import {planDrive} from './herdDrive';
import {run} from './herdTick';
import {S} from './herdBindings';
export function herdGroupStep():void {
 const signal=i32(core.parameter(0));let resume=i32(bank.value(S.continuation));
 if(signal==1||signal==2&&resume==170){planDrive();bank.write(S.continuation,0);return;}
 for(let edge=0;edge<512;edge++){
  run(signal-1,resume);resume=i32(bank.value(S.continuation));
  if(resume==0){if(signal==2)bank.write(S.continuation,170);return;}
  if(core.count(10)>0)return;
 }
 unreachable();
}
