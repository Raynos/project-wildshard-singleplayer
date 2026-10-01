import type { Rng } from '../core/rng';
import type { Scope } from '../app/scope';
import type { DayCycleClock } from './dayCycle';

export interface WeatherNumbers { overcast: number; rain: number; wet: number; wind: number; fog: number }
export interface WeatherFrame<S extends string, N extends WeatherNumbers> {
  state: S; mode: string; t: number; length: number; u: number; dt: number; prev: N; clockPhase: number;
}
export interface WeatherProfile<S extends string = string, N extends WeatherNumbers = WeatherNumbers> {
  states: readonly S[];
  next: Record<S, S>;
  length: Record<S, readonly [number, number]>;
  firstLength?: Partial<Record<S, readonly [number, number]>>;
  soak: number; dry: number;
  initial: () => N;
  numbers: (frame: WeatherFrame<S, N>) => N;
  modes: Record<string, { hold?: S; at?: number; dry?: boolean } | 'none'>;
  /** Existing state machines differ on fixed-length RNG draws and held-phase time. */
  sampleFixed?: boolean;
  holdPolicy?: 'all' | 'first';
  tickHeld?: boolean;
  zeroOutputs?: boolean;
  forceWet?: (state: S, t: number, prev: number) => number;
  forceHold?: boolean;
  forceAt?: number;
  fog?: (clock: DayCycleClock) => number;
}

/** Shared seeded transition loop; content supplies the continuous numbers and hold policy. */
export class Weather<S extends string = string, N extends WeatherNumbers = WeatherNumbers> {
  readonly profile: WeatherProfile<S, N>;
  protected readonly rng: Rng;
  state: S;
  phaseT = 0;
  phaseLen: number;
  mode = 'live';
  hold = false;
  readonly n: N;
  private phaseFns: ((phase: S, prev: S) => void)[] = [];

  constructor(profile: WeatherProfile<S, N>, rng: Rng) {
    this.profile = profile; this.rng = rng;
    const first = profile.states[0];
    if (first === undefined) throw new Error('Weather: empty profile');
    this.state = first; this.n = profile.initial();
    this.phaseLen = this.sample(profile.firstLength?.[first] ?? profile.length[first]);
  }
  get overcast(): number { return this.n.overcast; }
  get rain(): number { return this.n.rain; }
  get wet(): number { return this.n.wet; }
  set wet(n: number) { this.n.wet = n; }
  get wind(): number { return this.n.wind; }
  get fog(): number { return this.n.fog; }
  get phaseLeft(): number { return Math.max(0, this.phaseLen - this.phaseT); }
  onPhase(fn: (phase: S, prev: S) => void, scope?: Scope): () => void {
    this.phaseFns.push(fn);
    const off = (): void => { this.phaseFns = this.phaseFns.filter((f) => f !== fn); };
    scope?.onDispose(off);
    return off;
  }
  setMode(mode: string, at?: number): void {
    const pick = this.profile.modes[mode];
    if (pick === undefined) throw new Error(`Weather: unknown mode ${mode}`);
    this.mode = mode;
    if (pick === 'none') { this.hold = false; return; }
    if (pick.hold !== undefined) {
      if (pick.dry) { this.enter(pick.hold); this.hold = true; this.n.wet = 0; this.outputs(0, 0); }
      else this.force(pick.hold, at ?? pick.at ?? this.profile.forceAt ?? 0);
    }
  }
  force(state: S, at = this.profile.forceAt ?? 0): void {
    this.enter(state);
    this.phaseT = this.phaseLen * Math.min(0.999, Math.max(0, at));
    if (this.profile.forceHold) this.hold = true;
    this.n.wet = this.profile.forceWet?.(state, this.phaseT, this.n.wet) ?? this.n.wet;
    this.afterForce(state);
    this.outputs(0, 0);
  }
  update(dt: number, clock: DayCycleClock | number | null = null): void {
    const phase = typeof clock === 'number' ? clock : clock?.phase ?? 0;
    if (dt <= 0) { if (this.profile.zeroOutputs) this.outputs(0, phase); return; }
    const held = this.hold && (this.profile.holdPolicy !== 'first' || this.state === this.profile.states[0]);
    if (!held || this.profile.tickHeld) this.phaseT += dt;
    if (!held && this.phaseT >= this.phaseLen) this.enter(this.profile.next[this.state]);
    this.outputs(dt, phase);
  }
  protected enter(state: S): void {
    const prev = this.state;
    this.state = state; this.phaseT = 0;
    this.phaseLen = this.sample(this.profile.length[state]);
    this.entered(state);
    if (prev !== state) for (const fn of this.phaseFns.slice()) fn(state, prev);
  }
  protected entered(_state: S): void { /* shard event work happens before phase listeners, after the length draw */ }
  protected afterForce(_state: S): void { /* lightning may reset its next bolt before continuous outputs */ }
  protected outputs(dt: number, phase: number): void {
    Object.assign(this.n, this.profile.numbers({ state: this.state, mode: this.mode, t: this.phaseT, length: this.phaseLen, u: this.phaseLen > 0 ? this.phaseT / this.phaseLen : 0, dt, prev: this.n, clockPhase: phase }));
  }
  private sample(range: readonly [number, number]): number { return range[0] === range[1] && !this.profile.sampleFixed ? range[0] : this.rng.range(range[0], range[1]); }
}
