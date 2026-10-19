import { Signal } from './generated/nalatiTitanCombined';
import { attackEntry } from './titan';
import { fireEntry } from './titanFire';
import { rulesEntry } from './titanRules';
@inline export function attack(signal:i32,value:f64,source:i32):void{attackEntry(signal,value,source);}
@inline export function fire(signal:i32,value:f64,source:i32):void{fireEntry(signal,value,source);}
@inline export function rules(signal:i32,value:f64,source:i32):void{rulesEntry(signal,value,source);}
@inline export function onSignal(signal:i32,value:f64,source:i32):void{
 if(signal==Signal.spear||signal==Signal.rider||signal==Signal.chain||signal==Signal.chainLand)attack(signal,value,source);
 else if(signal==Signal.ignite||signal==Signal.fire||signal==Signal.fireContact)fire(signal,value,source);
 else rules(signal,value,source);
}
