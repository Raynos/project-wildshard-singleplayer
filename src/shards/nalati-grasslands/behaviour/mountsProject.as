import {Signal} from './generated/nalatiMounts';
import {approach,breaking,riding} from './mounts';
import {tamingEntry} from './tamingCoordinator';
export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal>=Signal.zzAdopt)tamingEntry(signal);
 else if(signal==Signal.select||signal==Signal.approach||signal==Signal.event||signal==Signal.finish||signal==Signal.eligible)approach(signal,value,source);
 else if(signal==Signal.start||signal==Signal.step)breaking(signal,value,source);else riding(signal,value,source);
}
