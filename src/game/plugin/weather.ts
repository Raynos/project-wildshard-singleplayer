import { EasedFields } from '@wildshard/engine/world/easedFields';
import { parseEasedFields } from '@wildshard/format/easedFields';
import { boundQuestState } from '../quest/boundState';
import { sceneScalar } from '../shardfile/sceneInputs';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import type { ShardContext } from './context';

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

const weatherFields = new Map<string, EasedFields>();
/** Client-only weather targets read an existing quest's flag book. Load/enter snaps; play eases. */
export function installWeatherFields(ctx: ShardContext, input: unknown, quest: string): void {
  const fields = new EasedFields(parseEasedFields(input));
  if (fields.rows.fields.some(row => !ctx.product.shardfile.state.shared.some(field => field.name === row.field && field.privacy === 'host' && field.type === 'f64')))
    throw new Error('Weather presentation requires declared host fields');
  if (ctx.scope.disposed) throw new Error('Weather presentation left during admission');
  const flags = boundQuestState(ctx.scope, quest).flags;
  const publish = (): void => { for (const row of fields.rows.fields) sceneScalar(ctx.product.slug, row.field).value = fields.value(row.field); };
  const snap = (): void => { fields.step(0, flags.all, true); publish(); };
  weatherFields.set(ctx.product.slug, fields);
  ctx.debug.expose('weatherFields', fields);
  ctx.scope.onDispose(() => { if (weatherFields.get(ctx.product.slug) === fields) weatherFields.delete(ctx.product.slug); });
  installEnteredRuntimeService(ctx, scope => { snap(); scope.onDispose(() => {
    for (const row of fields.rows.fields) sceneScalar(ctx.product.slug, row.field).value = row.else;
  }); });
  ctx.system({ id: 'game.weather.fields', phase: 'update', run: dt => { fields.step(dt, flags.all); publish(); } });
}
/** Capture tooling settles the admitted table against real quest facts; no field or target is supplied by a shard. */
export function settleWeatherFields(slug: string, flags: readonly string[]): void {
  const fields = weatherFields.get(slug); if (fields === undefined) throw new Error('Weather fields are not installed');
  fields.step(0, flags, true);
  for (const row of fields.rows.fields) sceneScalar(slug, row.field).value = fields.value(row.field);
}
