import type { RngState } from '@wildshard/engine/core/rng';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';

export type StormPhase = string;
interface SteppeNumbers { overcast:number;rain:number;wet:number;wind:number;fog:number;front:number;rainbow:number }


/** something tall the lightning may pick (a spruce, a balbal, a yurt's crown) */
export interface Exposed { x: number; z: number; top: number; kind: 'tree' | 'thing'; ref?: unknown }

export interface LightningPlayer {
  x: number; y: number; z: number;
  crouched: boolean; mounted: boolean;
  /** inside / right beside a yurt: no rain, no lightning */
  sheltered: boolean;
}

export interface LightningWorld {
  heightAt: (x: number, z: number) => number;
  /** push every exposed thing within r of (x, z) into `out` (don't clear it) */
  exposed: (x: number, z: number, r: number, out: Exposed[]) => void;
  player: () => LightningPlayer;
}

export interface Strike {
  x: number; y: number; z: number;
  kind: 'tree' | 'player' | 'ground' | 'thing';
  /** the tree / thing that took it (Exposed.ref) */
  ref?: unknown;
}

/**
 * The storm's whole continuation as plain values (SF72: a renderer-free host saves it in its snapshot): the phase clock,
 * the mode and hold, the continuous numbers, its own random stream, the flash, the wind it asks for, GET LOW, an armed strike
 * (one that took a tree or a thing has a live reference and cannot be saved) and the lightning's countdowns.
 */
export interface StormState {
  state: StormPhase; phaseT: number; phaseLen: number; mode: string; hold: boolean;
  n: SteppeNumbers; rng: RngState;
  flash: number; windSpeed: number | null; windGustiness: number; getLow: boolean; stormFrom: number;
  pending: { x: number; y: number; z: number; kind: Strike['kind']; t: number } | null;
  nextBolt: number; nextGust: number; windTarget: number; getLowFor: number; getLowTick: number;
}
const STRIKE_KINDS: ReadonlySet<string> = new Set<Strike['kind']>(['tree', 'player', 'ground', 'thing']);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const TELEGRAPH = 1.2;
const STRIKE_DAMAGE = 60;
const STRIKE_RADIUS = 4;
const PLAYER_BODY = 1.75, PLAYER_CROUCHED = 1.05, MOUNT_BONUS = 1.5;
/** metres: ground within 30 m this close under the player's head shelters them from GET LOW */
const LOW_MARGIN = 1.2;

type Fn<A extends unknown[]> = (...a: A) => void;

/** Nalati-only strike targeting and damage. Weather phases, ramps and cadence are admitted DATA. */
export class Lightning {
  constructor(readonly weather:WeatherContinuation,private readonly world:LightningWorld) {}
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
  private getLowTick = 0;
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


  update(dt: number): void {
    if (dt <= 0) return;
    this.weather.update(dt);
    this.lightning(dt);
    this.getLowTick -= dt;
    if (this.getLowTick <= 0) { this.getLowTick = 0.25; this.getLow = this.checkGetLow(); }
    this.getLowFor = this.getLow ? this.getLowFor + dt : 0;
  }

  private lightning(dt: number): void {
    // an armed strike lands after the telegraph
    const p = this.pending;
    if (p) {
      p.t -= dt;
      if (p.t <= 0) { this.pending = null; this.land(p); }
      return;
    }
    const s = this.weather.state;
    this.weather.applyActions('lightning',dt);
    if (!this.weather.registers['ready']) return;
    if (s === 'storm') {
      this.arm();
    } else {
      // building / gust / clearing: flicker in the cloud, far off on the storm's side (no bolt to the ground)
      const dist = s === 'gust' ? this.rng.range(500, 1200) : this.rng.range(1200, 3000);
      this.flash = Math.max(this.flash, s === 'gust' ? 0.55 : 0.3);
      for (const f of this.flashFns) f(dist, this.stormFrom + this.rng.range(-0.6, 0.6));
    }
  }

  /** pick the strike cell and the highest exposed thing in it, then telegraph */
  private arm(): void {
    const w = this.world, pl = w.player();
    // the player standing proud draws the storm: after a few seconds of GET LOW, a strike may come for them
    const hunt = this.getLowFor > 3 && this.rng.next() < 0.45;
    let cx: number, cz: number, r: number;
    if (hunt) { cx = pl.x; cz = pl.z; r = 30; }
    else {
      const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(40, 230);
      cx = pl.x + Math.cos(a) * d; cz = pl.z + Math.sin(a) * d; r = 35;
    }
    const best = this.highestNear(cx, cz, r, pl);
    const telegraph: Strike & { t: number } = { ...best, t: TELEGRAPH };
    this.pending = telegraph;
    for (const f of this.telegraphFns) f(telegraph);
  }

  /** the highest scoring exposed thing (or ground point, or the player) around (cx, cz) */
  private highestNear(cx: number, cz: number, r: number, pl: LightningPlayer): Strike {
    const w = this.world;
    let best: Strike = { x: cx, y: w.heightAt(cx, cz), z: cz, kind: 'ground' };
    let bestScore = best.y + this.ridge(cx, cz);
    // the ground: a coarse ring of samples (the crest of a knoll wins)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = cx + Math.cos(a) * r * 0.6, z = cz + Math.sin(a) * r * 0.6;
      const y = w.heightAt(x, z), sc = y + this.ridge(x, z);
      if (sc > bestScore) { bestScore = sc; best = { x, y, z, kind: 'ground' }; }
    }
    const c = this.cand; c.length = 0;
    w.exposed(cx, cz, r, c);
    for (const e of c) {
      const sc = e.top + this.ridge(e.x, e.z);
      if (sc > bestScore) { bestScore = sc; best = { x: e.x, y: e.top, z: e.z, kind: e.kind, ref: e.ref }; }
    }
    if (!pl.sheltered && Math.hypot(pl.x - cx, pl.z - cz) <= r) {
      const top = this.playerTop(pl), sc = top + this.ridge(pl.x, pl.z);
      if (sc > bestScore) best = { x: pl.x, y: top, z: pl.z, kind: 'player' };
    }
    return best;
  }

  private playerTop(pl: LightningPlayer): number { return pl.y + (pl.crouched ? PLAYER_CROUCHED : PLAYER_BODY) + (pl.mounted ? MOUNT_BONUS : 0); }

  /** +1 m on a ridge crest / knoll top: the point stands > 1.5 m over the ground 12 m around */
  private ridge(x: number, z: number): number {
    const w = this.world, y = w.heightAt(x, z);
    let m = 0;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; m += w.heightAt(x + Math.cos(a) * 12, z + Math.sin(a) * 12); }
    return y - m / 4 > 1.5 ? 1 : 0;
  }

  private land(s: Strike): void {
    const pl = this.world.player();
    this.flash = 1;
    const d = Math.hypot(s.x - pl.x, s.z - pl.z);
    for (const f of this.strikeFns) f(s);
    for (const f of this.flashFns) f(d, Math.atan2(s.z - pl.z, s.x - pl.x));
    if (!pl.sheltered && d <= STRIKE_RADIUS && Math.abs(s.y - pl.y) < 6) for (const f of this.hitFns) f(STRIKE_DAMAGE);
  }

  /**
   * GET LOW: in the gust front / storm, nothing within 30 m stands near the player's head — no ground within
   * `LOW_MARGIN` of it, no tree / stone above it. Standing on open ground trips it; crouching clears it on the flat
   * (1.05 < 1.2) but not on a kurgan or a ridge; a rider always trips it.
   */
  private checkGetLow(): boolean {
    if (!this.stormActive) return false;
    const w = this.world, pl = w.player();
    if (pl.sheltered) return false;
    const top = this.playerTop(pl) + this.ridge(pl.x, pl.z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (const d of [12, 30]) {
        const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        if (w.heightAt(x, z) + LOW_MARGIN >= top) return false;
      }
    }
    const c = this.cand; c.length = 0;
    w.exposed(pl.x, pl.z, 30, c);
    for (const e of c) if (e.top > top) return false;
    return true;
  }
}
