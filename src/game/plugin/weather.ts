import type { SimHost } from '@wildshard/engine/sim';
import type { WeatherProgram } from '@wildshard/format/weatherProgram';
import { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { NativeCombatFrame } from './nativeItems';

/** Install one admitted weather/wind continuation at its declared native step, borrowing the authoritative day clock. */
export function installWeatherContinuation(host:SimHost,rows:WeatherProgram,day:Pick<DayCycleClock,'phase'>,mode:string|undefined,frame?:NativeCombatFrame):WeatherContinuation {
  const air=new WeatherContinuation(rows,{seed:host.level.seed,mode:mode??'live'});
  if(rows.air===undefined||air.gust===null)throw new Error('Missing declared weather wind clock');
  if(frame!==undefined)frame.wind={clock:air.gust.current,field:rows.air.field,base:rows.air.base,scale:rows.air.scale};
  host.onStep(rows.air.step,dt=>{air.step(dt,day.phase);if(frame!==undefined)frame.rain=air.rain;},{
    snapshot:()=>air.captureContinuation(),restore:value=>{air.prepareContinuationRestore(value)();},
  });
  return air;
}
