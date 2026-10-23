import {onSignal as numericSignal} from './pastureWind';import {herdGroupStep} from './herdGroup';import * as core from '../sdk/as/wsV2';import {init,tick,drive} from './pack';
 export function onSignal(signal:i32,value:f64,source:i32):void{numericSignal(signal,value,source);}
 export function groupStep():void{if(core.parameter(2)==1){const s=i32(core.parameter(0));if(s==1)init();else if(s==2)tick();else if(s<19)drive(s-3,false);else drive(s-19,true);}else herdGroupStep();}
