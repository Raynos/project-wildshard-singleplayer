import { Signal } from './generated/nalatiMounts';
import { approachEntry } from './tamingApproach';
import { breakingEntry } from './tamingBreak';
import { ridingEntry } from './riding';
@inline export function approach(signal:i32,value:f64,source:i32):void{approachEntry(signal,value,source);}
@inline export function breaking(signal:i32,value:f64,source:i32):void{breakingEntry(signal,value,source);}
@inline export function riding(signal:i32,value:f64,source:i32):void{ridingEntry(signal,value,source);}
@inline export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal==Signal.select||signal==Signal.approach||signal==Signal.event||signal==Signal.finish||signal==Signal.eligible)approach(signal,value,source);
 else if(signal==Signal.start||signal==Signal.step)breaking(signal,value,source);else riding(signal,value,source);
}
