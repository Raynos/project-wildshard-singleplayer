import { fireEntry } from './titanFire';
import { Signal } from './generated/nalatiPastureWind';
import { windEntry } from './titanWind';
import { pastureEntry } from './pasture';
@inline export function wind(signal:i32,value:f64,source:i32):void{windEntry(signal,value,source);}
@inline export function pasture(signal:i32,value:f64,source:i32):void{pastureEntry(signal,value,source);}
@inline export function onSignal(signal:i32,value:f64,source:i32):void{if(signal==Signal.whirl)wind(signal,value,source);else if(signal==Signal.fieldClock||signal==Signal.fieldIgnite||signal==Signal.ignite||signal==Signal.fire||signal==Signal.fieldContact||signal==Signal.fireContact)fireEntry(signal,value,source);else pasture(signal,value,source);}
