/**
 * Weather — the steppe storm as a seeded state machine (Nalati B10; docs/design/nalati/stealth-and-storms.md "Steppe
 * storms", the plan's Decisions: a storm every 20–30 min of play, lightning CAN hit the player — 60, GET LOW first).
 *
 *   clear (20–30 min) → building (90 s) → gust (20 s) → storm (2–3 min) → clearing (60 s) → after (3 min) → clear
 *
 * No rendering here: `Weather` owns the phase clock, the numbers every other system reads, and the lightning logic
 * (where it strikes, the telegraph, who gets hurt). `WeatherFX.ts` draws it; `src/nalati/weather.ts` wires it.
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
import { Rng } from '../core/rng';

export type StormPhase = 'clear' | 'building' | 'gust' | 'storm' | 'clearing' | 'after';
export const STORM_PHASES: readonly StormPhase[] = ['clear', 'building', 'gust', 'storm', 'clearing', 'after'];

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

const LEN: Record<StormPhase, [number, number]> = {
  clear: [20 * 60, 30 * 60], building: [90, 90], gust: [20, 20], storm: [120, 180], clearing: [60, 60], after: [180, 180],
};
const TELEGRAPH = 1.2;
const STRIKE_DAMAGE = 60;
const STRIKE_RADIUS = 4;
const PLAYER_BODY = 1.75, PLAYER_CROUCHED = 1.05, MOUNT_BONUS = 1.5;
/** metres: ground within 30 m this close under the player's head shelters them from GET LOW */
const LOW_MARGIN = 1.2;

const sm = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

type Fn<A extends unknown[]> = (...a: A) => void;

export class Weather {
  state: StormPhase = 'clear';
  /** seconds into the phase / the phase's length */
  phaseT = 0;
  phaseLen: number;
  /** a boss fight in progress: the clear phase will not end */
  hold = false;

  // ── the outputs (recomputed every update) ──
  /** 0 clear … 1 full storm deck overhead */
  overcast = 0;
  /** 0 … 1 heavy rain */
  rain = 0;
  /** the shelf cloud's advance: 0 on the horizon … 1 overhead … 1.5 its back edge gone past */
  front = 0;
  /** 0 … 1 soaked ground (lags the rain, lingers through the after) */
  wet = 0;
  /** 0 … 1 the rainbow's strength (the after, sun up) */
  rainbow = 0;
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

  private readonly rng: Rng;
  private readonly world: LightningWorld;
  private readonly clearRange: [number, number];
  private nextBolt = 0;
  private nextGust = 0;
  private windTarget = 5;
  private getLowFor = 0;
  private getLowTick = 0;
  private readonly cand: Exposed[] = [];
  private readonly phaseFns: Fn<[StormPhase, StormPhase]>[] = [];
  private readonly telegraphFns: Fn<[Strike]>[] = [];
  private readonly strikeFns: Fn<[Strike]>[] = [];
  private readonly flashFns: Fn<[number, number]>[] = [];
  private readonly hitFns: Fn<[number]>[] = [];

  constructor(opts: WeatherOpts) {
    this.rng = new Rng(opts.seed ^ 0x57a3);
    this.world = opts.world;
    this.clearRange = opts.clear ?? [20, 30];
    const first = opts.firstClear ?? [12, 18];
    this.phaseLen = this.rng.range(first[0], first[1]) * 60;
  }

  /** gust front or storm proper — the AI's "a storm is on" */
  get stormActive(): boolean { return this.state === 'gust' || this.state === 'storm'; }
  /** seconds left in this phase */
  get phaseLeft(): number { return Math.max(0, this.phaseLen - this.phaseT); }
  /** seconds until the gust front hits (0 once it has) */
  get untilStorm(): number {
    if (this.state === 'clear') return this.phaseLeft + LEN.building[0];
    if (this.state === 'building') return this.phaseLeft;
    return 0;
  }

  onPhase(fn: Fn<[StormPhase, StormPhase]>): void { this.phaseFns.push(fn); }
  onTelegraph(fn: Fn<[Strike]>): void { this.telegraphFns.push(fn); }
  onStrike(fn: Fn<[Strike]>): void { this.strikeFns.push(fn); }
  /** (distance m, world bearing atan2(z, x) of the flash seen from the player) */
  onFlash(fn: Fn<[number, number]>): void { this.flashFns.push(fn); }
  onPlayerHit(fn: Fn<[number]>): void { this.hitFns.push(fn); }

  /** jump into a phase (dev switch). `at` = 0..1 how far into it. */
  force(phase: StormPhase, at = 0): void {
    this.enter(phase);
    this.phaseT = this.phaseLen * Math.min(0.999, Math.max(0, at));
    // the ground is already as wet as it would be by now
    this.wet = phase === 'storm' ? Math.max(this.wet, sm(0, 40, this.phaseT)) : phase === 'clearing' || phase === 'after' ? 1 : this.wet;
    this.nextBolt = phase === 'storm' ? 2.5 : 4;
    this.outputs(0);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.phaseT += dt;
    if (this.phaseT >= this.phaseLen && !(this.state === 'clear' && this.hold)) {
      const i = STORM_PHASES.indexOf(this.state);
      this.enter(STORM_PHASES[(i + 1) % STORM_PHASES.length] ?? 'clear');
    }
    this.outputs(dt);
    this.lightning(dt);
    this.getLowTick -= dt;
    if (this.getLowTick <= 0) { this.getLowTick = 0.25; this.getLow = this.checkGetLow(); }
    this.getLowFor = this.getLow ? this.getLowFor + dt : 0;
  }

  private enter(phase: StormPhase): void {
    const prev = this.state;
    this.state = phase;
    this.phaseT = 0;
    const [a, b] = phase === 'clear' ? [this.clearRange[0] * 60, this.clearRange[1] * 60] : LEN[phase];
    this.phaseLen = a === b ? a : this.rng.range(a, b);
    this.nextBolt = phase === 'storm' ? this.rng.range(2, 5) : this.rng.range(6, 14);
    this.nextGust = 0;
    this.pending = null;
    if (prev !== phase) for (const f of this.phaseFns) f(phase, prev);
  }

  /** every continuous number, from the phase and how far into it we are */
  private outputs(dt: number): void {
    const t = this.phaseT, L = this.phaseLen, u = L > 0 ? t / L : 0;
    let front = 0, overcast = 0, rain = 0, rainbow = 0;
    let wind: number | null = null, gustiness = 0.6;
    switch (this.state) {
      case 'clear': break;
      case 'building':
        front = mix(0, 0.55, sm(0, 1, u));
        overcast = 0.35 * sm(0.35, 1, u);
        wind = mix(7, 12, sm(0, 1, u)); gustiness = 0.7;
        break;
      case 'gust':
        front = mix(0.55, 1, sm(0, 1, u));
        overcast = mix(0.35, 0.88, sm(0, 0.8, u));
        rain = 0.35 * sm(0.45, 1, u);
        wind = mix(14, 18, sm(0, 0.4, u)); gustiness = 0.95;
        break;
      case 'storm':
        front = 1;
        overcast = mix(0.88, 1, sm(0, 10, t));
        rain = mix(0.35, 1, sm(0, 15, t)) * mix(1, 0.8, sm(0.85, 1, u));
        wind = null; gustiness = 0.9; // varied below
        break;
      case 'clearing':
        front = mix(1, 1.5, sm(0, 1, u));
        overcast = mix(1, 0.2, sm(0, 1, u));
        rain = 0.8 * (1 - sm(0, 0.8, u));
        wind = mix(12, 6, sm(0, 1, u)); gustiness = 0.7;
        break;
      case 'after':
        front = 1.5;
        overcast = 0.2 * (1 - sm(0, 0.5, u));
        rainbow = sm(0, 0.08, u) * (1 - sm(0.75, 1, u));
        wind = mix(5, 3.5, u); gustiness = 0.5;
        break;
      default: break;
    }
    if (this.state === 'storm') {
      // the storm wind wanders 18–24 m/s, a new target every few seconds
      this.nextGust -= dt;
      if (this.nextGust <= 0) { this.nextGust = this.rng.range(3, 7); this.windTarget = this.rng.range(18, 24); }
      wind = this.windTarget;
    }
    this.front = front; this.overcast = overcast; this.rain = rain; this.rainbow = rainbow;
    this.windSpeed = wind; this.windGustiness = gustiness;
    // wet: soaks up with the rain, holds through the clearing, dries through the after and the first minute of clear
    if (this.state === 'storm' || this.state === 'gust') this.wet = Math.min(1, this.wet + dt * rain / 30);
    else if (this.state === 'clearing') this.wet = Math.max(this.wet, 0.9);
    else if (this.state === 'after') this.wet = Math.min(this.wet, 1 - 0.4 * sm(0.3, 1, u));
    else this.wet = Math.max(0, this.wet - dt / 90);
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
