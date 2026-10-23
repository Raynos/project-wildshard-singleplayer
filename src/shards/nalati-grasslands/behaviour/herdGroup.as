// The existing pasture executable calls this only for its declared herd
// profile. Each signal is one original native method, with synchronous native
// barriers resumed before that method returns. This source owns no clock/save.
import * as core from '../sdk/as/wsV2';
import * as bank from '../sdk/as/groupBankV2.herd';
import {drive} from './herdDrive';
import {run} from './herdTick';
import {S, SLOT, BODY} from './herdBindings';
export function herdGroupStep():void {
 const signal=i32(core.parameter(0)),resume=i32(bank.value(S.continuation));
 if(signal==1)drive(i32(bank.value(SLOT)),bank.value(BODY)!=0,resume);
 else run(signal-1,resume);
}
