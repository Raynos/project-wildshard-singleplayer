import { EasedFields } from '@wildshard/engine/world/easedFields';
import { parseEasedFields } from '@wildshard/format/easedFields';
import { boundQuestState } from '../quest/boundState';
import { sceneScalar } from '../shardfile/sceneInputs';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import type { ShardContext } from './context';

import type { LevelContext } from '@wildshard/engine/level/context';
import type { SimHost } from '@wildshard/engine/sim';
import { parseWeatherProgram, parseWeatherReactions, WeatherWorldSchema, WindStateSchema, type WeatherProgram, type WeatherReactionRows } from '@wildshard/format/weatherProgram';
import { Wind } from '@wildshard/engine/world/steppeWind';
import { Vector3 } from 'three';
import { NativeWildEnvironment } from '../population/nativeManager';
import { nativePopulationOf } from '../riding/nativePopulation';
import { TreeGrid } from '@wildshard/engine/world/forest/placement';
import type { WeatherHUD } from '@wildshard/engine/ui/HUD';
import type { Scope } from '@wildshard/engine/app/scope';
import { ReturnProgram } from '../population/returnProgram';
import * as v from 'valibot';
import { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { NativeCombatFrame } from './nativeItems';
import type { Player } from '@wildshard/engine/player/Player';

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

const ReactionsSaved = v.strictObject({ version: v.literal(1), weather: v.unknown(), registers: v.record(v.string(), v.pipe(v.number(), v.finite())),
  elapsed: v.pipe(v.number(), v.finite(), v.minValue(0)) });
/** Fields of one reaction event, reused per event id (copy what you keep). */
export type WeatherReactionEvent = Readonly<Record<string, number>>;
/**
 * A weather continuation's reactions (G474; rows `WeatherReactionRows`): its decisions at the rows' cadence through one
 * admitted return program, its events to subscribers and its whole continuation (the phase loop, its stream and every
 * register) as one plain snapshot. Page and renderer-free hosts drive the same rows; callers supply only numbers
 * (`inputs`: the player's `px py pz` and anything a step observes as `input.*`) and receive only numbered events.
 */
export class WeatherReactions {
  /** the caller's numbers for this frame, read by `input.*` sources (`sheltered` is the rows' shelter at `px pz`, or `covered`) */
  readonly inputs: Record<string, number> = { px: 0, py: 0, pz: 0, covered: 0, sheltered: 0 };
  private elapsed = 0;
  private readonly grid = new TreeGrid<{ x: number; z: number; r: number; top: number; index: number }>();
  private readonly listeners = new Map<string, ((event: WeatherReactionEvent) => void)[]>();
  private readonly events = new Map<string, Record<string, number>>();
  constructor(readonly weather: WeatherContinuation, readonly rows: WeatherReactionRows, private readonly program: ReturnProgram) {
    rows.points.forEach(([x, z, top], index) => { this.grid.add({ x, z, r: 0, top, index }); });
    for (const emit of rows.steps.flatMap(step => step.emit)) {
      const event = this.events.get(emit.event) ?? { age: 1e6 }; this.events.set(emit.event, event);
      for (const [field] of emit.fields) event[field] = 0;
    }
  }
  /** a state the rows call active (a storm is on) */
  get stormActive(): boolean { return this.rows.active.includes(this.weather.state); }
  get flash(): number { return this.weather.registers[this.rows.flash] ?? 0; }
  set flash(value: number) { this.weather.registers[this.rows.flash] = value; }
  register(name: string): number { return this.weather.registers[name] ?? 0; }
  /** An event's last fields and its `age` (seconds since it was raised; 1e6 before the first), for presentation rows. */
  record(event: string): WeatherReactionEvent { const record = this.events.get(event); if (record === undefined) throw new Error(`Undeclared weather reaction: ${event}`); return record; }
  /** Raise a declared event from outside the rows (a scripted bolt): its record and its subscribers, as a step would. */
  raise(event: string, fields: Readonly<Record<string, number>>): void {
    const record = this.events.get(event); if (record === undefined) throw new Error(`Undeclared weather reaction: ${event}`);
    for (const [field, value] of Object.entries(fields)) { if (!Object.hasOwn(record, field) || field === 'age' || !Number.isFinite(value)) throw new Error(`Invalid weather reaction field: ${field}`); record[field] = value; }
    record['age'] = 0; for (const fn of (this.listeners.get(event)?.slice()??[])) fn(record);
  }
  private hudKey = '';
  /** The HUD's chip and GET LOW (rows `hud`) when they changed since the last call, else null; `quiet` holds GET LOW off. */
  hud(wind: number, quiet: boolean): WeatherHUD | null {
    const rows = this.rows.hud, w = this.weather; if (rows === undefined) return null;
    const row = rows.chips.find(chip => chip.state === w.state && (chip.within === undefined || w.phaseLeft <= chip.within)), left = Math.max(0, Math.ceil(w.phaseLeft));
    const fill = (text: string): string => text.replaceAll('{left}', `${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`).replaceAll('{wind}', String(Math.round(wind)));
    const detail: WeatherHUD = { chip: row === undefined ? null : { title: fill(row.title), sub: fill(rows.sub), tone: row.tone }, getLow: this.register(rows.low) === 1 && !quiet };
    const key = `${detail.chip?.title ?? ''}|${detail.chip?.sub ?? ''}|${String(detail.getLow)}`;
    if (key === this.hudKey) return null;
    this.hudKey = key; return detail;
  }
  on(event: string, fn: (event: WeatherReactionEvent) => void): () => void {
    const list=this.listeners.get(event)??[];list.push(fn);this.listeners.set(event,list);let active=true;
    return ()=>{if(!active)return;active=false;const index=list.indexOf(fn);if(index!==-1)list.splice(index,1);if(list.length===0&&this.listeners.get(event)===list)this.listeners.delete(event);};
  }
  /** One frame: the phase loop, then (at the rows' cadence) the actions and the steps in order. True on a decision tick. */
  update(dt: number): boolean {
    if (dt <= 0) return false;
    this.weather.update(dt); this.elapsed += dt;
    for (const record of this.events.values()) record['age'] = Math.min(1e6, (record['age'] ?? 0) + dt);
    if (this.elapsed + 1e-9 < 1 / this.rows.hz) return false;
    const step = this.elapsed, { actions, shelter } = this.rows, x = this.inputs['px'] ?? 0, z = this.inputs['pz'] ?? 0;
    this.elapsed = 0;
    this.inputs['sheltered'] = Number((this.inputs['covered'] ?? 0) > 0 || shelter.circles.some(([cx, cz, r]) => (cx - x) ** 2 + (cz - z) ** 2 < (r + shelter.margin) ** 2));
    if (actions !== undefined && !(actions.unless !== undefined && this.register(actions.unless) !== 0)) this.weather.applyActions(actions.event, step);
    for (const row of this.rows.steps) if (row.when === undefined || this.read(row.when, step, {}) !== 0) this.run(row, step);
    return true;
  }
  private read(ref: string | number, dt: number, output: Readonly<Record<string, number>>): number {
    if (typeof ref === 'number') return ref;
    const [kind, key = ''] = ref.split('.'), w = this.weather;
    const value = kind === 'dt' ? dt : kind === 'phaseT' ? w.phaseT : kind === 'phaseLen' ? w.phaseLen : kind === 'state' ? Number(w.state === key)
      : kind === 'register' ? w.registers[key] : kind === 'input' ? this.inputs[key] : output[key];
    if (value === undefined || !Number.isFinite(value)) throw new Error(`Missing weather reaction source: ${ref}`);
    return value;
  }
  private run(row: WeatherReactionRows['steps'][number], dt: number): void {
    const observed = Object.fromEntries(row.observe.map(([field, ref]) => [field, this.read(ref, dt, {})]));
    const probe = row.probe, candidates: Record<string, number>[] = [];
    if (probe !== undefined) {
      const x = this.read(probe.x, dt, {}), z = this.read(probe.z, dt, {}), r = this.read(probe.radius, dt, {});
      for (const t of this.grid.nearby(x, z, r)) if ((t.x - x) ** 2 + (t.z - z) ** 2 <= r * r) candidates.push({ x: t.x, z: t.z, top: t.top, index: t.index });
      candidates.sort((a, b) => ((a['x'] ?? 0) - x) ** 2 + ((a['z'] ?? 0) - z) ** 2 - (((b['x'] ?? 0) - x) ** 2 + ((b['z'] ?? 0) - z) ** 2) || (a['index'] ?? 0) - (b['index'] ?? 0));
      candidates.length = Math.min(candidates.length, 8); observed['count'] = candidates.length;
    }
    const output = this.program.project(row.signal, observed, row.random ? this.weather.random : undefined, candidates);
    for (const [channel, target] of row.write) {
      const value = output[channel]; if (value === undefined) continue;
      if (target === 'phaseT') this.weather.phaseT = value; else this.weather.registers[target.slice(9)] = value;
    }
    for (const emit of row.emit) {
      if (output[emit.when] === undefined) continue;
      const event = this.events.get(emit.event); if (event === undefined) throw new Error(`Undeclared weather reaction: ${emit.event}`);
      for (const [field, ref] of emit.fields) event[field] = this.read(ref, dt, output);
      event['age'] = 0; for (const fn of (this.listeners.get(emit.event)?.slice()??[])) fn(event);
    }
  }
  /** The whole continuation as plain values. */
  snapshot(): { version: 1; weather: ReturnType<WeatherContinuation['captureWeather']>; registers: Record<string, number>; elapsed: number } { return { version: 1, weather: this.weather.captureWeather(), registers: { ...this.weather.registers }, elapsed: this.elapsed }; }
  /** Put a snapshot back silently; refuses a foreign one before changing anything. */
  restore(value: unknown): void {
    const saved = v.parse(ReactionsSaved, value), keys = Object.keys(this.weather.registers);
    if (keys.length !== Object.keys(saved.registers).length || !keys.every(key => Object.hasOwn(saved.registers, key))) throw new RangeError('Incompatible weather reactions');
    const weather = this.weather.prepareWeatherRestore(saved.weather);
    weather(); Object.assign(this.weather.registers, saved.registers); this.elapsed = saved.elapsed;
  }
}
/** Reactions on a page (its scope owns the program) or a renderer-free host (one admitted instance per host scope). */
export function installWeatherReactions(air: WeatherContinuation, rows: WeatherReactionRows, owner: { readonly host: SimHost } | { readonly scope: Scope }): WeatherReactions {
  return new WeatherReactions(air, rows, 'host' in owner ? ReturnProgram.native(owner.host, { script: rows.script, bytes: rows.bytes }) : ReturnProgram.page({ script: rows.script, bytes: rows.bytes }, owner.scope));
}

/** Admit a phase program and its reaction guest as one data-only native bundle. */
export function nativeWeatherBundle(input: unknown): { weather: WeatherProgram; reactions: WeatherReactionRows } {
  const data = v.parse(v.object({ weather: v.unknown(),reactions: v.unknown() }),input), weather = parseWeatherProgram(data.weather);
  return { weather,reactions: parseWeatherReactions(data.reactions,weather) };
}
/** Client-only intake of the same damage policy used by native weather. The
 * entered lifetime owns its subscription; no content damage callback binds. */
export function bindPageWeatherHit(ctx:ShardContext,player:Player,storm:WeatherReactions,input:unknown):void{
  const rows=v.parse(WeatherWorldSchema,input);
  installEnteredRuntimeService(ctx,scope=>{scope.onDispose(storm.on('hurt',event=>{
    const target=ctx.app.player;if(target===null)return;
    ctx.app.combat.hit({source:'env',sourceTags:rows.hit.tags,target,amount:ctx.app.events.ask(rows.hit.ask,event['damage']??0),point:player.position.clone(),dir:new Vector3(),cause:rows.hit.cause,toast:rows.hit.toast});
  }));});
}
/** G474 fixed-step weather observes concrete world owners and routes its effects
 * through the native population/combat authorities, never content callbacks. */
export function installNativeWeatherWorld(host: SimHost, ports: { program: ReturnType<typeof nativeWeatherBundle>; rows: unknown;
  clock: Pick<DayCycleClock,'sunElevation'>; env: NativeWildEnvironment;
  bake: { readonly trees: readonly (readonly [number,number,number])[]; readonly tops: readonly number[]; readonly yurts: readonly (readonly [number,number,number])[] } }): { wind: Wind; storm: WeatherReactions } {
  const rows = v.parse(WeatherWorldSchema,ports.rows), { env,clock,bake,program } = ports;
  if (!(env instanceof NativeWildEnvironment) || bake.trees.length !== bake.tops.length) throw new Error('Invalid native weather observations');
  const wind = new Wind({ value: 1 });
  const storm = installWeatherReactions(installWeatherContinuation(host,program.weather,{ phase: 0 },undefined),
    { ...program.reactions,points: bake.trees.map(([x,z],index) => [x,z,bake.tops[index] ?? 0]),shelter: { ...program.reactions.shelter,circles: bake.yurts.map(([x,z,r]) => [x,z,r]) } },{ host });
  Object.assign(storm.inputs,{ calmSpeed: wind.speed,calmDir: wind.dir,calmGust: wind.gustiness,titanHeld: 0,crouched: 0,mounted: 0 });
  storm.on('strike',event => { const population = nativePopulationOf(host); if (population === undefined) throw new Error('Missing native weather population'); population.scare(event['x'] ?? 0,event['z'] ?? 0,rows.scareRadius); });
  storm.on('wind',event => { wind.setTarget(event['speed'] ?? wind.speed,event['dir'] ?? wind.dir,event['gustiness'],event['seconds']); });
  storm.on('hurt',event => { host.combat.hit({ source: 'env',sourceTags: rows.hit.tags,target: host.player.health,amount: host.events.ask(rows.hit.ask,event['damage'] ?? 0),
    point: host.player.position.clone(),dir: new Vector3(),cause: rows.hit.cause,toast: rows.hit.toast }); });
  const view = (): void => {
    let light = rows.light.base;
    for (const [from,to,scale] of rows.light.ramps) { const t = Math.min(1,Math.max(0,(clock.sunElevation-from)/(to-from))); light += scale*(t*t*(3-2*t)); }
    env.light = Math.min(light,storm.stormActive ? rows.light.storm : 1); env.storm = storm.stormActive;
    env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1,wind.speed/rows.windReference);
  };
  const saved = v.strictObject({ wind: WindStateSchema,storm: v.unknown() });
  host.onStep(rows.step,dt => {
    wind.update(dt); const player = host.player.position;
    Object.assign(storm.inputs,{ px: player.x,py: player.y,pz: player.z,crouched: Number(env.playerCrouched),mounted: Number(env.playerMounted) });
    storm.update(dt); view();
  },{ snapshot: () => { const state = wind.snapshot(); return { wind: { ...state,target: { ...state.target } },storm: storm.snapshot() }; },restore: value => { const state = v.parse(saved,value); wind.restore(state.wind); storm.restore(state.storm); view(); } });
  view(); return { wind,storm };
}
