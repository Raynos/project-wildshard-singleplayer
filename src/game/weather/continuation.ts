import type { LevelContext } from '@wildshard/engine/level/context';
import type { SimHost } from '@wildshard/engine/sim';
import { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { Wind } from '@wildshard/engine/world/steppeWind';
import { WeatherWorldSchema, WindStateSchema, type WeatherProgram } from '@wildshard/format/weatherProgram';
import { NativeWildEnvironment } from '../population/nativeManager';
import { nativePopulationOf } from '../riding/nativePopulation';
import { installWeatherReactions, weatherWorldLight, type nativeWeatherBundle, type WeatherReactions } from './reactions';
import type { NativeCombatFrame } from '../plugin/nativeItems';

/** A page borrows its existing system service; native composites retain their own snapshot/step adapter. */
export interface WeatherInstallation { readonly seed:number; readonly system?:LevelContext['system']; readonly state?:{readonly paused:boolean} }
/** Native world observations consumed by the shared weather installation. */
interface NativeWeatherWorld { program: ReturnType<typeof nativeWeatherBundle>; rows: unknown;
  clock: Pick<DayCycleClock,'sunElevation'>; env: NativeWildEnvironment;
  bake: { readonly trees: readonly (readonly [number,number,number])[]; readonly tops: readonly number[] } }
/** Install DATA weather on a native cadence or a declared page system. Without a cadence declaration the caller's
 * existing composite (weather + native lightning) drives update and saves the historic combined envelope. */
export function installWeatherContinuation(host: SimHost, rows: NativeWeatherWorld): { wind: Wind; storm: WeatherReactions };
export function installWeatherContinuation(host: SimHost | WeatherInstallation, rows: WeatherProgram, day: Pick<DayCycleClock,'phase'>, mode: string | undefined, frame?: NativeCombatFrame): WeatherContinuation;
export function installWeatherContinuation(host: SimHost | WeatherInstallation, rows: WeatherProgram | NativeWeatherWorld, day?: Pick<DayCycleClock,'phase'>, mode?: string, frame?: NativeCombatFrame): WeatherContinuation | { wind: Wind; storm: WeatherReactions } {
  if ('program' in rows) {
    if (!('level' in host)) throw new Error('Weather world requires its native host');
    const ports = rows;
    const worldRows = v.parse(WeatherWorldSchema,ports.rows), { env,clock,bake,program } = ports;
    if (!(env instanceof NativeWildEnvironment) || bake.trees.length !== bake.tops.length) throw new Error('Invalid native weather observations');
    const wind = new Wind({ value: 1 });
    const storm = installWeatherReactions(installWeatherContinuation(host,program.weather,{ phase: 0 },undefined),
      { ...program.reactions,points: bake.trees.map(([x,z],index) => [x,z,bake.tops[index] ?? 0]) },{ host });
    Object.assign(storm.inputs,{ calmSpeed: wind.speed,calmDir: wind.dir,calmGust: wind.gustiness,held: 0,crouched: 0,mounted: 0 });
    storm.on('strike',event => { const population = nativePopulationOf(host); if (population === undefined) throw new Error('Missing native weather population'); population.scare(event['x'] ?? 0,event['z'] ?? 0,worldRows.scareRadius); });
    storm.on('wind',event => { wind.setTarget(event['speed'] ?? wind.speed,event['dir'] ?? wind.dir,event['gustiness'],event['seconds']); });
    storm.on('hurt',event => { host.combat.hit({ source: 'env',sourceTags: worldRows.hit.tags,target: host.player.health,amount: host.events.ask(worldRows.hit.ask,event['damage'] ?? 0),
      point: host.player.position.clone(),dir: new Vector3(),cause: worldRows.hit.cause,toast: worldRows.hit.toast }); });
    const view = (): void => {
      env.light = weatherWorldLight(worldRows.light,clock.sunElevation,storm.stormActive); env.storm = storm.stormActive;
      env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1,wind.speed/worldRows.windReference);
    };
    const saved = v.strictObject({ wind: WindStateSchema,storm: v.unknown() });
    host.onStep(worldRows.step,dt => {
      wind.update(dt); const player = host.player.position;
      Object.assign(storm.inputs,{ px: player.x,py: player.y,pz: player.z,crouched: Number(env.playerCrouched),mounted: Number(env.playerMounted) });
      storm.update(dt); view();
    },{ snapshot: () => { const state = wind.snapshot(); return { wind: { ...state,target: { ...state.target } },storm: storm.snapshot() }; },restore: value => { const state = v.parse(saved,value); wind.restore(state.wind); storm.restore(state.storm); view(); } });
    view(); return { wind,storm };
  }
  if (day === undefined) throw new Error('Weather requires its day clock');
  const air=new WeatherContinuation(rows,{seed:'level' in host?host.level.seed:host.seed,mode:mode??'live'});
  if ('level' in host && rows.air!==undefined) {
    const step = rows.air.step;
    host.events.answer('weather.rain', request => request.id === step ? { ...request, rain: air.rain } : request, host.scope);
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

