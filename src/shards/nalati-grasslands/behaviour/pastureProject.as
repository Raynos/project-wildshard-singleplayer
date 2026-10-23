import {onSignal as numericSignal} from './pastureWind';import {herdGroupStep} from './herdGroup';import {packGroupStep} from './pack';
import * as core from '../sdk/as/wsV2';
 export function onSignal(signal:i32,value:f64,source:i32):void{numericSignal(signal,value,source);}
 // profile ordinal (c.profile): 0 the herd (main), 1 the wolf pack
 export function groupStep():void{if(i32(core.parameter(2))==1)packGroupStep();else herdGroupStep();}
