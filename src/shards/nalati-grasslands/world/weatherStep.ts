import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { installWeatherContinuation } from '@wildshard/game/plugin/weather';
import type { SimHost } from '@wildshard/engine/sim';
import { parseWeatherProgram, type WeatherProgram } from '@wildshard/format/weatherProgram';
import type { WildEnv } from '../creatures/env';
import { wildLight, type SunClock } from '../look/wildLight';
import type { Lightning, Exposed, LightningWorld, LightningPlayer, Strike, StormState } from './Lightning';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import * as v from 'valibot';

const weatherScripts=new WeakMap<WeatherProgram,unknown>();
/** Decode the admitted phase rows and reaction script as one weather owner. */
export function readWeatherProgram(input:unknown):WeatherProgram {
 const rows=v.parse(v.object({weather:v.unknown(),reactions:v.unknown()}),input),program=parseWeatherProgram(rows.weather);
 weatherScripts.set(program,rows.reactions);return program;
}

/**
 * The steppe weather's simulation rules, renderer-free (SF72): what the page's wiring (world/installWeather.ts, every frame)
 * and a renderer-free host (runtime/headless.ts, every fixed step) both run — the storm built on the level's seed, one frame
 * of its state machine with the Storm Titan's held storm and the wind it asks for, and what the creatures read from the
 * weather and the wind (creatures/env.ts `light`, `storm`, `wind`). The look, the effects, the HUD and the audio stay on the
 * page.
 */

/**
 * The storm's wind heading (Wind.dir convention: the way it blows, yaw-style): out of the NW toward the SE. Steppe storms
 * ride in from the north-west; it also keeps the shelf cloud off the late sun (WSW), as in storm-1.
 */
export const STORM_HEADING = Math.PI / 4;

/** The wind as the weather reads and steers it (the engine's steppe Wind, world/steppeWind.ts: the page's one, or a host's). */
export interface SteppeWindPort {
  readonly speed: number; readonly dir: number; readonly gustiness: number; readonly dirX: number; readonly dirZ: number;
  setTarget: (speed: number, dir: number, gustiness?: number, seconds?: number) => void;
}

/** The wind's calm (the prevailing wind when the weather was wired) and the speed the storm last asked of it (null: none). */
export interface StormWind { readonly calm: { readonly speed: number; readonly dir: number; readonly gust: number }; asked: number | null }
/** The calm of `wind` as it stands now, nothing asked yet. */
export function stormWind(wind: SteppeWindPort): StormWind { return { calm: { speed: wind.speed, dir: wind.dir, gust: wind.gustiness }, asked: null }; }

/**
 * One frame of the storm (after the page sets `weather.weather.hold` and steps its clock): the state machine; while the Storm Titan
 * holds it (`titanHeld`) the storm that called him rages on; then the wind — the gust front swings it round to the storm's
 * own heading (building and after keep the calm heading), and once the storm stops asking it eases back to the calm.
 */
export function stepStorm(weather: Lightning, ask: StormWind, wind: SteppeWindPort, dt: number, titanHeld: boolean): void {
  if (!weather.update(dt)) return;
  const action = weather.windDecision(ask, titanHeld);
  weather.weather.phaseT = action['phaseT'] ?? weather.weather.phaseT;
  ask.asked = (action['asked'] ?? -1) < 0 ? null : action['asked'] ?? null;
  if (action['speed'] !== undefined) wind.setTarget(action['speed'], action['dir'] ?? ask.calm.dir,
    action['gustiness'] ?? ask.calm.gust, action['seconds'] ?? 10);
}

/** What the creatures read from the hour and the storm: the light (dimmed by an active storm) and whether one is on. */
export function stormEnv(env: Pick<WildEnv, 'light' | 'storm'>, clock: SunClock, weather: Lightning): void {
  env.light = wildLight(clock, weather.stormActive);
  env.storm = weather.stormActive;
}

/** What the creatures read from the wind: the way the air moves (unit) and its strength 0..1 (10 m/s and up is 1). */
export function windEnv(env: Pick<WildEnv, 'wind'>, wind: SteppeWindPort): void {
  env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1, wind.speed / 10);
}

/** A yurt's footprint as the lightning reads it: its centre and radius (a step beside it, `r + 1.5` m, is shelter too). */
export interface YurtCircle { readonly x: number; readonly z: number; readonly r: number }
/** The yurts, from the POI colliders (Yurt.ts: two crossed squares of half-width 0.93 R per yurt). */
export function yurtsOf(colliders: readonly { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yTop: number; readonly yBottom: number }[]): YurtCircle[] {
  const out: YurtCircle[] = [];
  for (const c of colliders) {
    if (Math.abs(c.hw - c.hd) > 0.01 || c.hw < 2.2 || c.hw > 3.6 || c.yTop - c.yBottom < 2.5) continue;
    if (out.some((y) => Math.abs(y.x - c.x) < 0.1 && Math.abs(y.z - c.z) < 0.1)) continue;
    out.push({ x: c.x, z: c.z, r: c.hw / 0.93 });
  }
  return out;
}
/** Inside or right beside a yurt: no lightning reaches (x, z). */
export function yurtShelters(yurts: readonly YurtCircle[], x: number, z: number): boolean { return yurts.some((y) => (y.x - x) ** 2 + (y.z - z) ** 2 < (y.r + 1.5) ** 2); }

/**
 * The lightning's exposed trees around (x, z): every trunk of `near` (a forest's 16 m cell query, engine TreeGrid `nearby`,
 * in its order) within r, scored by its top (`top`), carrying `ref` (the page's live tree; a host passes none, so an armed
 * strike on a tree stays a saveable plain value).
 */
export function exposeTrees<T extends { readonly x: number; readonly z: number }>(near: readonly T[], top: (t: T) => number, ref: (t: T) => unknown, x: number, z: number, r: number, out: Exposed[]): void {
  for (const t of near) if ((t.x - x) ** 2 + (t.z - z) ** 2 <= r * r) out.push({ x: t.x, z: t.z, top: top(t), kind: 'tree', ref: ref(t) });
}

const STRIKE_KINDS: ReadonlySet<string> = new Set<Strike['kind']>(['tree', 'player', 'ground', 'thing']);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

type Fn<A extends unknown[]> = (...a: A) => void;

/** Nalati-only strike targeting and damage. Weather phases, ramps and cadence are admitted DATA. */
export class StormReactions {
  constructor(readonly weather:WeatherContinuation,private readonly world:LightningWorld,private readonly decisions:ReturnProgram) {}
  /** Existing look projection, borrowing the continuation without copying its values. */
  get overcast():number { return this.weather.overcast; }
  get rain():number { return this.weather.rain; }
  private get rng() { return this.weather.random; }
  get windSpeed():number|null { const value=this.weather.registers['windSpeed']??-1;return value<0?null:value; }
  get windGustiness():number { return this.weather.registers['windGustiness']??.6; }
  private get nextBolt():number { return this.weather.registers['nextBolt']??0; }
  private get nextGust():number { return this.weather.registers['nextGust']??0; }
  private get windTarget():number { return this.weather.registers['windTarget']??5; }
  get front(): number { return this.weather.n['front'] ?? 0; }
  get rainbow(): number { return this.weather.n['rainbow'] ?? 0; }
  /** 0 … 1 the lightning flash (decays in ~0.25 s) */
  get flash():number { return this.weather.registers['flash']??0; }
  set flash(value:number) { this.weather.registers['flash']=value; }
  /** the wind the storm asks for, m/s (null = leave the wind to itself) */

  /** in a storm, the player is the highest thing within 30 m */
  getLow = false;
  /** the bearing the storm comes FROM, radians atan2(z, x) in world space (the wiring sets it upwind) */
  stormFrom = 0;
  /** an armed strike (telegraphing) */
  private armed: (Strike & { t: number }) | null = null;
  get pending():(Strike & {t:number})|null { if(this.weather.registers['armed']!==1)this.armed=null;return this.armed; }
  private set pending(value:(Strike & {t:number})|null) { this.armed=value;this.weather.registers['armed']=Number(value!==null); }

  private getLowFor = 0;
  private getLowTick = .1;
  private readonly cand: Exposed[] = [];
  private readonly telegraphFns: Fn<[Strike]>[] = [];
  private readonly strikeFns: Fn<[Strike]>[] = [];
  private readonly flashFns: Fn<[number, number]>[] = [];
  private readonly hitFns: Fn<[number]>[] = [];

  /** gust front or storm proper — the AI's "a storm is on" */
  get stormActive(): boolean { return this.weather.state === 'gust' || this.weather.state === 'storm'; }
  /** seconds left in this phase */
  get phaseLeft(): number { return Math.max(0, this.weather.phaseLen - this.weather.phaseT); }
  /** seconds until the gust front hits (0 once it has) */
  get untilStorm(): number {
    if (this.weather.state === 'clear') return this.phaseLeft + (this.weather.profile.length['building']?.[0] ?? 0);
    if (this.weather.state === 'building') return this.phaseLeft;
    return 0;
  }

  /** Ten-Hz policy projection; native code applies only the returned wind command. */
  windDecision(ask: StormWind, titanHeld: boolean): Readonly<Record<string, number>> {
    return this.decisions.project('wind', { titanHeld: Number(titanHeld), storm: Number(this.weather.state === 'storm'),
      gust: Number(this.weather.state === 'gust'), building: Number(this.weather.state === 'building'), after: Number(this.weather.state === 'after'),
      phaseT: this.weather.phaseT, phaseLen: this.weather.phaseLen, asked: ask.asked ?? -1, calmSpeed: ask.calm.speed,
      calmDir: ask.calm.dir, calmGust: ask.calm.gust, windSpeed: this.windSpeed ?? -1, windGustiness: this.windGustiness });
  }

  onTelegraph(fn: Fn<[Strike]>): void { this.telegraphFns.push(fn); }
  onStrike(fn: Fn<[Strike]>): void { this.strikeFns.push(fn); }
  /** (distance m, world bearing atan2(z, x) of the flash seen from the player) */
  onFlash(fn: Fn<[number, number]>): void { this.flashFns.push(fn); }
  onPlayerHit(fn: Fn<[number]>): void { this.hitFns.push(fn); }

  /** The storm's continuation (StormState), exact; refuses an armed strike on a tree or a thing (a live reference). */
  snapshot(): StormState {
    const p = this.pending;
    if (p?.ref !== undefined) throw new Error('A storm with an armed strike on a tree or a thing cannot be saved');
    const n = this.weather.n;
    return { state: this.weather.state, phaseT: this.weather.phaseT, phaseLen: this.weather.phaseLen, mode: this.weather.mode, hold: this.weather.hold,
      n: { overcast: n.overcast, rain: n.rain, wet: n.wet, wind: n.wind, fog: n.fog, front: n['front'] ?? 0, rainbow: n['rainbow'] ?? 0 }, rng: this.rng.snapshot(),
      flash: this.flash, windSpeed: this.windSpeed, windGustiness: this.windGustiness, getLow: this.getLow, stormFrom: this.stormFrom,
      pending: p === null ? null : { x: p.x, y: p.y, z: p.z, kind: p.kind, t: p.t },
      nextBolt: this.nextBolt, nextGust: this.nextGust, windTarget: this.windTarget, getLowFor: this.getLowFor, getLowTick: this.getLowTick };
  }

  /** Put a saved continuation back exactly, silently (no phase event); refuses a malformed state before changing anything. */
  restore(saved: StormState): void {
    const { n, pending: p } = saved;
    const numbers = [saved.phaseT, saved.phaseLen, n.overcast, n.rain, n.wet, n.wind, n.fog, n.front, n.rainbow, saved.flash, saved.windGustiness, saved.stormFrom,
      saved.nextBolt, saved.nextGust, saved.windTarget, saved.getLowFor, saved.getLowTick];
    if (!this.weather.profile.states.includes(saved.state) || this.weather.profile.modes[saved.mode] === undefined || typeof saved.hold !== 'boolean' || typeof saved.getLow !== 'boolean'
      || !numbers.every(finite) || !(saved.windSpeed === null || finite(saved.windSpeed))
      || !(p === null || ([p.x, p.y, p.z, p.t].every(finite) && STRIKE_KINDS.has(p.kind)))) throw new RangeError('Invalid storm state');
    this.rng.restore(saved.rng);
    this.weather.state=saved.state;this.weather.phaseT=saved.phaseT;this.weather.phaseLen=saved.phaseLen;this.weather.mode=saved.mode;this.weather.hold=saved.hold;
    Object.assign(this.weather.n, n);
    this.flash = saved.flash; this.weather.registers['windSpeed']=saved.windSpeed??-1;this.weather.registers['windGustiness']=saved.windGustiness; this.getLow = saved.getLow; this.stormFrom = saved.stormFrom;
    this.pending = p === null ? null : { x: p.x, y: p.y, z: p.z, kind: p.kind, t: p.t };
    Object.assign(this.weather.registers,{nextBolt:saved.nextBolt,nextGust:saved.nextGust,windTarget:saved.windTarget}); this.getLowFor = saved.getLowFor; this.getLowTick = saved.getLowTick;
  }


  update(dt: number): boolean {
    if (dt <= 0) return false;
    this.weather.update(dt); this.getLowTick -= dt;
    if (this.getLowTick > 1e-9) return false;
    const elapsed = .1 - this.getLowTick; this.getLowTick = .1;
    const pending = this.pending;
    if (pending === null) this.weather.applyActions('lightning', elapsed);
    const action = this.decisions.project('tick', { dt: elapsed, armed: Number(pending !== null), pendingT: pending?.t ?? 0,
      ready: this.weather.registers['ready'] ?? 0, storm: Number(this.weather.state === 'storm'), gust: Number(this.weather.state === 'gust'), bearing: this.stormFrom }, this.rng);
    if (pending !== null) {
      pending.t = action['pendingT'] ?? pending.t;
      if (action['land'] === 1) { this.pending = null; this.land(pending); }
    } else if (action['arm'] === 1) this.arm();
    else if (action['distance'] !== undefined) {
      this.flash = Math.max(this.flash, action['flash'] ?? 0);
      for (const fn of this.flashFns) fn(action['distance'], action['bearing'] ?? this.stormFrom);
    }
    const pl = this.world.player(), candidates = this.exposed(pl.x, pl.z, 30);
    let low:Readonly<Record<string,number>>={};
    for(let at=0;at<Math.max(1,candidates.length);at++){
      const chunk=candidates.slice(at,at+1);
      low=this.decisions.project('low',{...this.playerFields(pl),dt:elapsed,lowFor:this.getLowFor,
        active:Number(this.stormActive),blocked:Number(low['low']===0),count:chunk.length},undefined,chunk);
    }
    this.getLow = low['low'] === 1; this.getLowFor = low['lowFor'] ?? 0;
    return true;
  }
  private playerFields(pl: LightningPlayer): Record<string, number> {
    return { px: pl.x, py: pl.y, pz: pl.z, crouched: Number(pl.crouched), mounted: Number(pl.mounted), sheltered: Number(pl.sheltered) };
  }
  private exposed(x: number, z: number, radius: number): Record<string, number>[] {
    this.cand.length = 0; this.world.exposed(x, z, radius, this.cand);
    return this.cand.map((e,index) => ({ x: e.x, z: e.z, top: e.top, kind: e.kind === 'tree' ? 1 : 2, index }));
  }
  private arm(): void {
    const pl = this.world.player(), fields = this.playerFields(pl);
    const cell = this.decisions.project('arm', { ...fields, lowFor: this.getLowFor }, this.rng);
    const cx = cell['x'] ?? pl.x, cz = cell['z'] ?? pl.z, radius = cell['radius'] ?? 35;
    const candidates=this.exposed(cx,cz,radius);
    let target=this.decisions.project('pick',{...fields,cx,cz,radius,count:0,scan:-1,first:1,bestX:0,bestY:0,bestZ:0,bestKind:0,bestIndex:-1,bestScore:0});
    const pick=(scan:number,chunk:readonly Readonly<Record<string,number>>[]):Readonly<Record<string,number>>=>this.decisions.project('pick',{
      ...fields,cx,cz,radius,scan,count:chunk.length,first:0,bestX:target['x']??0,bestY:target['y']??0,bestZ:target['z']??0,
      bestKind:target['kind']??0,bestIndex:target['index']??-1,bestScore:target['score']??0},undefined,chunk);
    for(let scan=0;scan<8;scan++)target=pick(scan,[]);
    for(let at=0;at<candidates.length;at++)target=pick(-1,candidates.slice(at,at+1));
    const kinds = ['ground', 'tree', 'thing', 'player'] as const, ref = this.cand[target['index'] ?? -1]?.ref;
    const strike: Strike & { t: number } = { x: target['x'] ?? cx, y: target['y'] ?? 0, z: target['z'] ?? cz, kind: kinds[target['kind'] ?? 0] ?? 'ground', t: 1.2, ...(ref === undefined ? {} : { ref }) };
    this.pending = strike; for (const fn of this.telegraphFns) fn(strike);
  }
  private land(strike: Strike): void {
    const hit = this.decisions.project('hit', { ...this.playerFields(this.world.player()), x: strike.x, y: strike.y, z: strike.z });
    this.flash = 1; for (const fn of this.strikeFns) fn(strike);
    for (const fn of this.flashFns) fn(hit['distance'] ?? 0, hit['bearing'] ?? 0);
    const damage = hit['damage'] ?? 0; if (damage > 0) for (const fn of this.hitFns) fn(damage);
  }
}

/** The storm on the level's seed, coming FROM the opposite of its heading. */
export function steppeStorm(seed: number, world: LightningWorld, program:WeatherProgram,host?:SimHost): Lightning {
  const decision=weatherScripts.get(program);if(decision===undefined)throw new Error('Weather reaction script was not admitted');
  const weather = new StormReactions(installWeatherContinuation(host??{seed},program,{phase:0},undefined),world,host===undefined?ReturnProgram.page(decision):ReturnProgram.native(host,decision));
  weather.stormFrom = Math.atan2(Math.cos(STORM_HEADING), Math.sin(STORM_HEADING));
  return weather;
}

