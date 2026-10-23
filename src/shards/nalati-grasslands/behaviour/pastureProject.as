import {onSignal as numericSignal} from './pastureWind';import {herdGroupStep} from './herdGroup';
 export function onSignal(signal:i32,value:f64,source:i32):void{numericSignal(signal,value,source);}
 export function groupStep():void{herdGroupStep();}