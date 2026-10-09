import { Rng, type RngState } from '@wildshard/engine/core/rng';
import { Weather as EngineWeather } from '@wildshard/engine/world/weather';
/**
 * Weather — the steppe storm as a seeded state machine (Nalati B10; docs/design/nalati/stealth-and-storms.md "Steppe
 * storms", the plan's Decisions: a storm every 20–30 min of play, lightning CAN hit the player — 60, GET LOW first).
 *
 *   clear (20–30 min) → building (90 s) → gust (20 s) → storm (2–3 min) → clearing (60 s) → after (3 min) → clear
 *
 * No rendering here: `Weather` owns the phase clock, the numbers every other system reads, and the lightning logic
 * (where it strikes, the telegraph, who gets hurt). `WeatherFX.ts` draws it; `src/shards/nalati-grasslands/weather.ts` wires it.
 *
 *   const weather = new Weather({ seed, world });      // `world`: terrain height, exposed things, the player (LightningWorld)
 *   weather.update(dt)                                  // every frame
 *   weather.state                                       // 'clear' | 'building' | 'gust' | 'storm' | 'clearing' | 'after'
 *   weather.stormActive                                 // gust front or storm proper (AI: herds skittish, wolves bolder)
 *   weather.overcast · rain · front · wet · rainbow · flash · windSpeed   // 0..1 (front 0..1.5, windSpeed m/s)
 *   weather.getLow                                      // the player is the highest thing within 30 m in the storm
 *   weather.phaseLeft · untilStorm                      // seconds (the HUD chip)
 *   weather.onPhase((phase, prev) => …)                 // every change
 *   weather.onTelegraph((s) => …)                       // 1.2 s before a strike: crackle + violet glow at s.x/y/z
 *   weather.onStrike((s) => …)                          // the bolt lands: s.x/y/z, s.kind ('tree' | 'player' | 'ground'), s.tree
 *   weather.onFlash((dist, dir) => …)                   // any lightning (strikes and in-cloud): the sky flash + thunder later
 *   weather.onPlayerHit((dmg) => …)                     // the player was within 4 m of a strike (60 damage)
 *   weather.force('storm')                              // dev `?weather=storm`: jump into a phase
 *   weather.hold = true                                 // a boss fight: no storm may start (one in progress runs out)
 *
 * The world the lightning reads (`LightningWorld`): it scores every exposed thing near a strike cell by its top's
 * height (+1.5 m for a mounted rider, +1 m on a ridge crest), and the highest one takes the bolt. Anything sheltered
 * (inside / beside a yurt) scores nothing.
 */
import { LEN, STORM_PHASES, steppeProfile, type SteppeNumbers, type StormPhase } from './weatherProfile';


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

export interface WeatherOpts {
  seed: number;
  world: LightningWorld;
  /** minutes of clear weather before the first storm (default 12–18) and between storms (default 20–30) */
  firstClear?: [number, number];
  clear?: [number, number];
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

const sm = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

type Fn<A extends unknown[]> = (...a: A) => void;

export class SteppeStorm extends EngineWeather<StormPhase, SteppeNumbers> {
  get front(): number { return this.n.front; }
  get rainbow(): number { return this.n.rainbow; }
  /** 0 … 1 the lightning flash (decays in ~0.25 s) */
  flash = 0;
  /** the wind the storm asks for, m/s (null = leave the wind to itself) */
  windSpeed: number | null = null;
  windGustiness = 0.6;
  /** in a storm, the player is the highest thing within 30 m */
  getLow = false;
  /** the bearing the storm comes FROM, radians atan2(z, x) in world space (the wiring sets it upwind) */
  stormFrom = 0;
  /** an armed strike (telegraphing) */
  pending: (Strike & { t: number }) | null = null;

  private readonly world: LightningWorld;
  private nextBolt = 0;
  private nextGust = 0;
  private windTarget = 5;
  private getLowFor = 0;
  private getLowTick = 0;
  private readonly cand: Exposed[] = [];
  private readonly telegraphFns: Fn<[Strike]>[] = [];
  private readonly strikeFns: Fn<[Strike]>[] = [];
  private readonly flashFns: Fn<[number, number]>[] = [];
  private readonly hitFns: Fn<[number]>[] = [];

  constructor(opts: WeatherOpts) {
    super(steppeProfile(opts), new Rng(opts.seed ^ 0x57a3));
    this.world = opts.world;
  }

  /** gust front or storm proper — the AI's "a storm is on" */
  get stormActive(): boolean { return this.state === 'gust' || this.state === 'storm'; }
  /** seconds left in this phase */
  override get phaseLeft(): number { return Math.max(0, this.phaseLen - this.phaseT); }
  /** seconds until the gust front hits (0 once it has) */
  get untilStorm(): number {
    if (this.state === 'clear') return this.phaseLeft + LEN.building[0];
    if (this.state === 'building') return this.phaseLeft;
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
    const n = this.n;
    return { state: this.state, phaseT: this.phaseT, phaseLen: this.phaseLen, mode: this.mode, hold: this.hold,
      n: { overcast: n.overcast, rain: n.rain, wet: n.wet, wind: n.wind, fog: n.fog, front: n.front, rainbow: n.rainbow }, rng: this.rng.snapshot(),
      flash: this.flash, windSpeed: this.windSpeed, windGustiness: this.windGustiness, getLow: this.getLow, stormFrom: this.stormFrom,
      pending: p === null ? null : { x: p.x, y: p.y, z: p.z, kind: p.kind, t: p.t },
      nextBolt: this.nextBolt, nextGust: this.nextGust, windTarget: this.windTarget, getLowFor: this.getLowFor, getLowTick: this.getLowTick };
  }

  /** Put a saved continuation back exactly, silently (no phase event); refuses a malformed state before changing anything. */
  restore(saved: StormState): void {
    const { n, pending: p } = saved;
    const numbers = [saved.phaseT, saved.phaseLen, n.overcast, n.rain, n.wet, n.wind, n.fog, n.front, n.rainbow, saved.flash, saved.windGustiness, saved.stormFrom,
      saved.nextBolt, saved.nextGust, saved.windTarget, saved.getLowFor, saved.getLowTick];
    if (!STORM_PHASES.includes(saved.state) || this.profile.modes[saved.mode] === undefined || typeof saved.hold !== 'boolean' || typeof saved.getLow !== 'boolean'
      || !numbers.every(finite) || !(saved.windSpeed === null || finite(saved.windSpeed))
      || !(p === null || ([p.x, p.y, p.z, p.t].every(finite) && STRIKE_KINDS.has(p.kind)))) throw new RangeError('Invalid storm state');
    this.rng.restore(saved.rng);
    this.state = saved.state; this.phaseT = saved.phaseT; this.phaseLen = saved.phaseLen; this.mode = saved.mode; this.hold = saved.hold;
    Object.assign(this.n, n);
    this.flash = saved.flash; this.windSpeed = saved.windSpeed; this.windGustiness = saved.windGustiness; this.getLow = saved.getLow; this.stormFrom = saved.stormFrom;
    this.pending = p === null ? null : { x: p.x, y: p.y, z: p.z, kind: p.kind, t: p.t };
    this.nextBolt = saved.nextBolt; this.nextGust = saved.nextGust; this.windTarget = saved.windTarget; this.getLowFor = saved.getLowFor; this.getLowTick = saved.getLowTick;
  }


  override update(dt: number): void {
    if (dt <= 0) return;
    super.update(dt);
    this.lightning(dt);
    this.getLowTick -= dt;
    if (this.getLowTick <= 0) { this.getLowTick = 0.25; this.getLow = this.checkGetLow(); }
    this.getLowFor = this.getLow ? this.getLowFor + dt : 0;
  }

  protected override entered(phase: StormPhase): void {
    this.nextBolt = phase === 'storm' ? this.rng.range(2, 5) : this.rng.range(6, 14);
    this.nextGust = 0;
    this.pending = null;
  }
  protected override afterForce(phase: StormPhase): void { this.nextBolt = phase === 'storm' ? 2.5 : 4; }

  /** every continuous number, from the phase and how far into it we are */
  protected override outputs(dt: number): void {
    super.outputs(dt, 0);
    const t=this.phaseT, u=this.phaseLen>0?t/this.phaseLen:0;
    let wind: number | null=null, gustiness=0.6;
    switch(this.state) {
      case 'building': wind=mix(7,12,sm(0,1,u));gustiness=0.7;break;
      case 'gust': wind=mix(14,18,sm(0,0.4,u));gustiness=0.95;break;
      case 'storm': gustiness=0.9;break;
      case 'clearing': wind=mix(12,6,sm(0,1,u));gustiness=0.7;break;
      case 'after': wind=mix(5,3.5,u);gustiness=0.5;break;
      case 'clear': break;
      default: break;
    }
    if (this.state === 'storm') {
      // the storm wind wanders 18–24 m/s, a new target every few seconds
      this.nextGust -= dt;
      if (this.nextGust <= 0) { this.nextGust = this.rng.range(3, 7); this.windTarget = this.rng.range(18, 24); }
      wind = this.windTarget;
    }
    this.windSpeed = wind; this.windGustiness = gustiness;
    this.flash = Math.max(0, this.flash - dt * 4.5);
  }

  private lightning(dt: number): void {
    // an armed strike lands after the telegraph
    const p = this.pending;
    if (p) {
      p.t -= dt;
      if (p.t <= 0) { this.pending = null; this.land(p); }
      return;
    }
    const s = this.state;
    if (s === 'clear' || s === 'after') return;
    this.nextBolt -= dt;
    if (this.nextBolt > 0) return;
    if (s === 'storm') {
      this.nextBolt = this.rng.range(6, 15);
      this.arm();
    } else {
      // building / gust / clearing: flicker in the cloud, far off on the storm's side (no bolt to the ground)
      this.nextBolt = s === 'gust' ? this.rng.range(4, 8) : this.rng.range(7, 16);
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
