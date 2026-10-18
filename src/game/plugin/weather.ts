import type { LevelContext } from '@wildshard/engine/level/context';
import type { SimHost } from '@wildshard/engine/sim';
import type { WeatherProgram } from '@wildshard/format/weatherProgram';
import { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { NativeCombatFrame } from './nativeItems';

const nativeWeather = new WeakMap<SimHost, Map<string, WeatherContinuation>>();
/** Read the concrete native weather authority by its admitted cadence id. */
export function nativeWeatherContinuation(host: SimHost, id: string): WeatherContinuation {
  const air = nativeWeather.get(host)?.get(id); if (air === undefined) throw new Error(`Missing native weather: ${id}`); return air;
}

/** A page borrows its existing system service; native composites retain their own snapshot/step adapter. */
export interface WeatherInstallation { readonly seed:number; readonly system?:LevelContext['system']; readonly state?:{readonly paused:boolean} }
/** Install DATA weather on a native cadence or a declared page system. Without a cadence declaration the caller's
 * existing composite (weather + native lightning) drives update and saves the historic combined envelope. */
export function installWeatherContinuation(host:SimHost|WeatherInstallation,rows:WeatherProgram,day:Pick<DayCycleClock,'phase'>,mode:string|undefined,frame?:NativeCombatFrame):WeatherContinuation {
  const air=new WeatherContinuation(rows,{seed:'level' in host?host.level.seed:host.seed,mode:mode??'live'});
  if ('level' in host && rows.air!==undefined) {
    const step = rows.air.step;
    const services = nativeWeather.get(host) ?? new Map<string, WeatherContinuation>();
    if (services.has(step)) throw new Error('Duplicate native weather');
    services.set(step, air); nativeWeather.set(host, services);
    host.scope.onDispose(() => { services.delete(step); });
    const gust=air.gust;if(gust===null)throw new Error('Missing declared weather wind clock');
    if(frame!==undefined)frame.wind={clock:gust.current,field:rows.air.field,base:rows.air.base,scale:rows.air.scale};
    host.onStep(rows.air.step,dt=>{air.step(dt,day.phase);if(frame!==undefined)frame.rain=air.rain;},{
      snapshot:()=>air.captureContinuation(),restore:value=>{air.prepareContinuationRestore(value)();},
    });
  } else if ('system' in host) {
    const page=rows.page;if(page===undefined)throw new Error('Missing declared page weather system');
    host.system({...page,phase:'update',run:dt=>{if(!host.state?.paused)air.update(dt,day.phase);}});
  }
  return air;
}
