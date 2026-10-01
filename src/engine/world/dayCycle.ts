import { Vector3 } from 'three';

export type DayPhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
export type TimePick = 'live' | 'midday' | 'golden' | 'sunset' | 'night';
export type LightPreset = 'dawn' | 'noon' | 'dusk' | 'night';
export type PhaseListener = (phase: DayPhase, prev: DayPhase) => void;
export interface ScheduleSeg { phase: DayPhase; from: number; to: number; minutes: number }
export interface DayKeys<K> {
  coordinate: 'phase' | 'elevation';
  frames: readonly (readonly [number, K])[];
  blend: (out: K, a: K, b: K, t: number) => void;
}
export interface DayCycleSpec<K = never> {
  schedule: readonly ScheduleSeg[];
  start: number;
  /** Uniform clocks retain phase arithmetic; scheduled clocks retain hour arithmetic. */
  units: 'phase' | 'hour';
  keys?: DayKeys<K>;
  sun: { maxElevation: number; azimuthOffset: number } | { path: (p: number, out: Vector3) => Vector3; moon: (p: number, out: Vector3) => Vector3 };
  fixed: Record<Exclude<TimePick, 'live'>, number>;
  presets: Record<LightPreset, number>;
  curves?: {
    night: (p: number) => number; dusk: (p: number) => number; dawn: (p: number) => number; lamps: (p: number) => number;
  };
  dayFraction?: number;
  /** Phase clocks historically pin once per frame; hour clocks also pause. */
  pauseOnPin?: boolean;
}
export type DayCycleClock = Pick<DayCycle, 'hour' | 'phase' | 'dayPhase' | 'night' | 'dusk' | 'dawn' | 'lamps' | 'body' | 'sunDir' | 'setTime' | 'set' | 'pin' | 'scale' | 'paused'>;

const wrap = (n: number, period: number): number => ((n % period) + period) % period;
export function phaseOfHour(h: number): DayPhase {
  const x = wrap(h, 24);
  return x >= 4.5 && x < 7 ? 'dawn' : x >= 7 && x < 16.5 ? 'day' : x >= 16.5 && x < 18 ? 'golden' : x >= 18 && x < 19.75 ? 'dusk' : 'night';
}
export function compassDir(azimuth: number, elevation: number, out = new Vector3()): Vector3 {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  return out.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}
export function smooth(e0: number, e1: number, x: number): number {
  if (x <= e0) return 0;
  if (x >= e1) return 1;
  const t = (x - e0) / (e1 - e0);
  return t * t * (3 - 2 * t);
}

/** One clock mechanism. Its schedule, paths, curves and look keys belong to content. */
export class DayCycle<K = never> {
  readonly spec: DayCycleSpec<K>;
  private value: number;
  private lastPhase: DayPhase;
  private listeners: { phase: DayPhase | null; fn: PhaseListener }[] = [];
  private held: { value: number; paused: boolean } | null = null;
  private readonly direction = new Vector3();
  scale = 1;
  paused = false;
  cycle: number;
  /** The backdrop waits for key decoding when a caller jumps the clock. */
  onSet: (() => Promise<void>) | null = null;

  constructor(spec: DayCycleSpec<K>) {
    if (spec.schedule.length === 0) throw new Error('DayCycle: empty schedule');
    this.spec = spec;
    this.value = wrap(spec.start, spec.units === 'phase' ? 1 : 24);
    this.cycle = spec.schedule.reduce((sum, seg) => sum + seg.minutes * 60, 0);
    this.lastPhase = this.dayPhase;
  }
  get phase(): number { return this.spec.units === 'phase' ? this.value : this.hour / 24; }
  set phase(p: number) { this.value = this.spec.units === 'phase' ? p : wrap(p * 24, 24); this.checkPhase(); }
  get hour(): number {
    if (this.spec.units === 'hour') return this.value;
    const day = this.spec.dayFraction ?? 20 / 24, p = this.value;
    return (p < day ? 6 + 12 * p / day : 18 + 12 * (p - day) / (1 - day)) % 24;
  }
  get dayPhase(): DayPhase { return this.spec.units === 'hour' ? this.segAt(this.hour).phase : phaseOfHour(this.hour); }
  get dayMinutes(): number { return this.cycle / 60; }
  get maxElevation(): number { return 'maxElevation' in this.spec.sun ? this.spec.sun.maxElevation : 0; }
  get azimuthOffset(): number { return 'azimuthOffset' in this.spec.sun ? this.spec.sun.azimuthOffset : 0; }
  get sunElevation(): number { return this.maxElevation * Math.sin(Math.PI * (this.hour - 6) / 12); }
  get sunAzimuth(): number { return 90 + (this.hour - 6) * 15 + this.azimuthOffset; }
  get moonElevation(): number { return 18 + 0.35 * Math.max(0, -this.sunElevation); }
  get moonAzimuth(): number { return this.sunAzimuth + 180; }
  sunAt(out: Vector3): Vector3 { return 'path' in this.spec.sun ? this.spec.sun.path(this.phase, out) : compassDir(this.sunAzimuth, this.sunElevation, out); }
  moonAt(out: Vector3): Vector3 { return 'path' in this.spec.sun ? this.spec.sun.moon(this.phase, out) : compassDir(this.moonAzimuth, this.moonElevation, out); }
  get body(): 'sun' | 'moon' { return this.spec.units === 'phase' ? this.phase < (this.spec.dayFraction ?? 20 / 24) ? 'sun' : 'moon' : this.sunElevation > -2 ? 'sun' : 'moon'; }
  get sunDir(): Vector3 { return this.body === 'sun' ? this.sunAt(this.direction) : this.moonAt(this.direction); }
  get night(): number { return this.spec.curves?.night(this.phase) ?? (this.sunElevation >= 6 ? 0 : this.sunElevation <= -10 ? 1 : (6 - this.sunElevation) / 16); }
  get dusk(): number { return this.spec.curves?.dusk(this.phase) ?? this.night; }
  get dawn(): number { return this.spec.curves?.dawn(this.phase) ?? (this.dayPhase === 'dawn' ? 1 : 0); }
  get lamps(): number { return this.spec.curves?.lamps(this.phase) ?? this.night; }
  get phaseProgress(): number {
    const s = this.segAt(this.hour), h = this.hour < s.from ? this.hour + 24 : this.hour;
    return (h - s.from) / (s.to - s.from);
  }
  update(dt: number): void {
    if (this.paused) return;
    if (this.spec.units === 'phase') this.value = (this.value + dt * this.scale / this.cycle) % 1;
    else if (dt > 0) {
      const seg = this.segAt(this.hour), rate = (seg.to - seg.from) / Math.max(1e-3, seg.minutes * 60);
      this.value = wrap(this.value + dt * this.scale * rate, 24);
    }
    this.checkPhase();
  }
  setTime(t: TimePick): void {
    this.paused = t !== 'live';
    if (t !== 'live') { this.value = this.spec.fixed[t]; this.checkPhase(); void this.onSet?.(); }
  }
  async set(to: number | DayPhase | 'noon' | 'midnight'): Promise<void> {
    const named: Record<DayPhase | 'noon' | 'midnight', number> = { dawn: 5.6, day: 10, noon: 12, golden: 17.1, dusk: 18.15, night: 22.5, midnight: 0 };
    this.value = wrap(typeof to === 'number' ? to : named[to], this.spec.units === 'phase' ? 1 : 24);
    this.checkPhase();
    await this.onSet?.();
  }
  pin(preset: LightPreset | null): void {
    if (preset === null) {
      if (this.held) { this.value = this.held.value; this.paused = this.held.paused; this.checkPhase(); }
      this.held = null;
      return;
    }
    this.held ??= { value: this.value, paused: this.paused };
    this.value = this.spec.presets[preset];
    if (this.spec.pauseOnPin) this.paused = true;
    this.checkPhase();
  }
  segment(at = this.spec.keys?.coordinate === 'elevation' ? this.sunElevation : this.phase): [readonly [number, K], readonly [number, K], number] {
    const keys = this.spec.keys;
    if (!keys || keys.frames.length < 2) throw new Error('DayCycle: keyframes missing');
    const frames = keys.frames, n = frames.length;
    let i = keys.coordinate === 'phase' ? n - 1 : 0;
    for (let k = 0; k < n; k++) { const e = frames[k]; if (e && e[0] <= at) i = k; }
    const a = frames[i], b = frames[(i + 1) % n];
    if (!a || !b) throw new Error('DayCycle: keyframes missing');
    if (keys.coordinate === 'elevation' && i === n - 1) return [a, a, 0];
    const pa = a[0], pb = keys.coordinate === 'phase' && b[0] <= pa ? b[0] + 1 : b[0], p = keys.coordinate === 'phase' && at < pa ? at + 1 : at;
    return [a, b, smooth(pa, pb, p)];
  }
  key(out: K): K { const [a, b, t] = this.segment(); this.spec.keys?.blend(out, a[1], b[1], t); return out; }
  onPhase(fn: PhaseListener): () => void { return this.on(null, fn); }
  onDawn(fn: PhaseListener): () => void { return this.on('dawn', fn); }
  onDay(fn: PhaseListener): () => void { return this.on('day', fn); }
  onGolden(fn: PhaseListener): () => void { return this.on('golden', fn); }
  onDusk(fn: PhaseListener): () => void { return this.on('dusk', fn); }
  onNight(fn: PhaseListener): () => void { return this.on('night', fn); }
  private on(phase: DayPhase | null, fn: PhaseListener): () => void {
    const listener = { phase, fn }; this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }
  private checkPhase(): void {
    const phase = this.dayPhase;
    if (phase === this.lastPhase) return;
    const prev = this.lastPhase; this.lastPhase = phase;
    for (const l of this.listeners.slice()) if (l.phase === null || l.phase === phase) l.fn(phase, prev);
  }
  private segAt(hour: number): ScheduleSeg {
    for (const s of this.spec.schedule) if ((hour >= s.from && hour < s.to) || (hour + 24 >= s.from && hour + 24 < s.to)) return s;
    const first = this.spec.schedule[0];
    if (!first) throw new Error('DayCycle: empty schedule');
    return first;
  }
}
