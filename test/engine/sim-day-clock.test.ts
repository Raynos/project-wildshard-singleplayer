// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DayCycle, type DayCycleSpec, type DayPhase, type LightPreset, type ScheduleSeg, type TimePick } from '../../src/engine/world/dayCycle';
import { checkDayClockState, clockDayPhase, stepDayClock } from '../../src/engine/sim/dayClock';
import { createSimHost, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { FIXED_STEP } from '../../src/engine/core/fixedStep';
import { Rng } from '../../src/engine/core/rng';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { PINE_DAY } from '../../src/shards/pine-hollow/look/dayKeys';
import { steppeClock, NALATI_DAY } from '../../src/shards/nalati-grasslands/look/dayKeys';
import { DRIFTWOOD_DAY } from '../../src/shards/driftwood-isle/look/dayKeys';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

// ── The oracle: the page's DayCycle arithmetic exactly as it shipped before SF72 moved its law into sim/dayClock.ts
// (world/dayCycle.ts at 07b9e9eff), frozen here and driven against today's DayCycle on one recorded tape per shipping
// clock. Every query and every phase event must agree bit for bit (Object.is).
const wrap = (n: number, period: number): number => ((n % period) + period) % period;
function oraclePhaseOfHour(h: number): DayPhase {
  const x = wrap(h, 24);
  return x >= 4.5 && x < 7 ? 'dawn' : x >= 7 && x < 16.5 ? 'day' : x >= 16.5 && x < 18 ? 'golden' : x >= 18 && x < 19.75 ? 'dusk' : 'night';
}
function oracleCompass(azimuth: number, elevation: number, out: Vector3): Vector3 {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  return out.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}
class OracleDayCycle<K> {
  value: number; lastPhase: DayPhase; held: { value: number; paused: boolean } | null = null;
  readonly direction = new Vector3(); scale = 1; paused = false; cycle: number;
  readonly log: string[] = [];
  constructor(readonly spec: DayCycleSpec<K>) {
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
  get dayPhase(): DayPhase { return this.spec.units === 'hour' ? this.segAt(this.hour).phase : oraclePhaseOfHour(this.hour); }
  get maxElevation(): number { return 'maxElevation' in this.spec.sun ? this.spec.sun.maxElevation : 0; }
  get azimuthOffset(): number { return 'azimuthOffset' in this.spec.sun ? this.spec.sun.azimuthOffset : 0; }
  get sunElevation(): number { return this.maxElevation * Math.sin(Math.PI * (this.hour - 6) / 12); }
  get sunAzimuth(): number { return 90 + (this.hour - 6) * 15 + this.azimuthOffset; }
  get moonElevation(): number { return 18 + 0.35 * Math.max(0, -this.sunElevation); }
  get moonAzimuth(): number { return this.sunAzimuth + 180; }
  sunAt(out: Vector3): Vector3 { return 'path' in this.spec.sun ? this.spec.sun.path(this.phase, out) : oracleCompass(this.sunAzimuth, this.sunElevation, out); }
  moonAt(out: Vector3): Vector3 { return 'path' in this.spec.sun ? this.spec.sun.moon(this.phase, out) : oracleCompass(this.moonAzimuth, this.moonElevation, out); }
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
  setTime(t: TimePick): void { this.paused = t !== 'live'; if (t !== 'live') { this.value = this.spec.fixed[t]; this.checkPhase(); } }
  set(to: number): void { this.value = wrap(to, this.spec.units === 'phase' ? 1 : 24); this.checkPhase(); }
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
  private checkPhase(): void {
    const phase = this.dayPhase;
    if (phase === this.lastPhase) return;
    this.log.push(`${this.lastPhase}>${phase}`); this.lastPhase = phase;
  }
  private segAt(hour: number): ScheduleSeg {
    for (const s of this.spec.schedule) if ((hour >= s.from && hour < s.to) || (hour + 24 >= s.from && hour + 24 < s.to)) return s;
    const first = this.spec.schedule[0];
    if (!first) throw new Error('DayCycle: empty schedule');
    return first;
  }
}

type Keys = 'phase' | 'hour' | 'dayPhase' | 'night' | 'dusk' | 'dawn' | 'lamps' | 'body' | 'sunDir' | 'sunElevation' | 'sunAzimuth' | 'moonElevation' | 'moonAzimuth'
  | 'phaseProgress' | 'paused' | 'scale' | 'update' | 'setTime' | 'pin';
/** A clock as the tape drives it (no content key type): today's DayCycle or the frozen one. */
type Clock = Pick<DayCycle, Keys> & { set: (to: number) => unknown };
type Oracle = Pick<OracleDayCycle<never>, Keys | 'set' | 'value' | 'held' | 'cycle' | 'lastPhase' | 'log'>;
type Page = Pick<DayCycle, Keys | 'set' | 'snapshot' | 'onPhase'>;
const pair = <K>(spec: () => DayCycleSpec<K>): { oracle: Oracle; page: Page } => ({ oracle: new OracleDayCycle(spec()), page: new DayCycle(spec()) });
const read = (c: Clock): unknown[] => {
  const d = c.sunDir;
  return [c.phase, c.hour, c.dayPhase, c.night, c.dusk, c.dawn, c.lamps, c.body, d.x, d.y, d.z, c.sunElevation, c.sunAzimuth, c.moonElevation, c.moonAzimuth, c.phaseProgress, c.paused, c.scale];
};
const TIMES: readonly TimePick[] = ['live', 'midday', 'golden', 'sunset', 'night'];
const PRESETS: readonly (LightPreset | null)[] = ['dawn', 'noon', 'dusk', 'night', null, null];
/** One recorded tape: mostly frames (60 / 30 / 120 Hz, hitches, zero), with speed, pause, jumps, Time of day and pins. */
function drive(rng: Rng, clocks: readonly Clock[], frames: number): number {
  let compared = 0;
  const pick = <T>(list: readonly T[]): T => { const v = list[rng.int(0, list.length - 1)]; if (v === undefined) throw new Error('tape'); return v; };
  for (let f = 0; f < frames; f++) {
    const op = rng.next();
    if (op < 0.9) { const dt = pick([1 / 60, 1 / 60, 1 / 30, 1 / 120, 0, rng.range(0, 0.1), 2.5]); for (const c of clocks) c.update(dt); }
    else if (op < 0.93) { const s = pick([1, 0.5, 40, 300, 1200]); for (const c of clocks) c.scale = s; }
    else if (op < 0.94) { const p = !clocks[0]?.paused; for (const c of clocks) c.paused = p; }
    else if (op < 0.95) { const p = rng.next(); for (const c of clocks) c.phase = p; }
    else if (op < 0.96) { const to = rng.range(-3, 30); for (const c of clocks) void c.set(to); }
    else if (op < 0.98) { const t = pick(TIMES); for (const c of clocks) c.setTime(t); }
    else { const p = pick(PRESETS); for (const c of clocks) c.pin(p); }
    const [first, ...rest] = clocks.map(read);
    for (const row of rest) row.forEach((value, i) => { if (!Object.is(value, first?.[i])) throw new Error(`frame ${String(f)} field ${String(i)}: ${String(value)} vs ${String(first?.[i])}`); });
    compared++;
  }
  return compared;
}
const SPECS: readonly [string, () => { oracle: Oracle; page: Page }][] = [
  ['Pine Hollow (phase, path sun, curves)', () => pair(() => ({ ...PINE_DAY }))],
  ['Driftwood Isle (phase, path sun, curves)', () => pair(() => ({ ...DRIFTWOOD_DAY }))],
  ['Nalati (hour, schedule, elevation keys)', () => pair(() => steppeClock().spec)],
  ['Nalati pinned-pause (hour, pauseOnPin)', () => pair(() => ({ ...NALATI_DAY, start: 3.2, pauseOnPin: true }))],
];

describe('the day clock law (sim/dayClock.ts) is the page clock bit for bit', () => {
  it.each(SPECS)('%s: today\'s DayCycle matches the frozen pre-SF72 clock on a 3 x 6000-frame tape', (_name, make) => {
    for (const seed of [11, 435, 9001]) {
      const { oracle, page } = make(), events: string[] = [];
      page.onPhase((phase, prev) => { events.push(`${prev}>${phase}`); });
      expect(drive(new Rng(seed), [oracle, page], 6000)).toBe(6000);
      expect(events).toEqual(oracle.log);
      expect(events.length).toBeGreaterThan(20);
      expect(page.snapshot()).toEqual({ value: oracle.value, paused: oracle.paused, scale: oracle.scale, cycle: oracle.cycle, held: oracle.held, last: oracle.lastPhase });
    }
  });
  it('steps and names exactly as the clock does, and refuses a corrupt state', () => {
    const law = steppeClock().spec;
    expect(stepDayClock(law, 17.9, 0, 1, 1)).toBe(17.9); // an hour clock ignores a zero step
    expect(clockDayPhase(law, 18.2)).toBe('dusk');
    expect(clockDayPhase(PINE_DAY, 0.85)).toBe('dusk');
    const ok = new DayCycle(PINE_DAY).snapshot();
    expect(checkDayClockState(ok)).toBe(ok);
    expect(() => checkDayClockState({ ...ok, value: Number.NaN })).toThrow(/day clock/u);
    expect(() => checkDayClockState({ ...ok, cycle: 0 })).toThrow(/day clock/u);
  });
  it('restores exactly: no listener fires on restore, and the restored clock hears the same next transitions', () => {
    const a = steppeClock({ start: 17.95 }); a.scale = 30;
    for (let f = 0; f < 50; f++) a.update(1 / 60);
    a.pin('noon');
    const b = steppeClock(), heard: string[] = [], heardA: string[] = [];
    b.onPhase((p) => { heard.push(p); }); b.restore(a.snapshot());
    expect(heard).toEqual([]);
    a.onPhase((p) => { heardA.push(p); });
    a.pin(null); b.pin(null);
    for (let f = 0; f < 4000; f++) { a.update(1 / 60); b.update(1 / 60); expect(read(b)).toEqual(read(a)); }
    expect(heard).toEqual(heardA);
    expect(heard.slice(0, 2)).toEqual(['dusk', 'night']); // the unpin returns to dusk, then night falls
  });
});

describe('SimHost steps the page day clock', () => {
  let rapier: Rapier;
  beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
  const level: SimLevel = { ...SIM_LEVEL, id: 'sim-day', entities: [], quests: [] };
  const nearDusk: SimLevel = { ...level, day: { start: 17.9 } };

  it('a host without a clock has no day field and the level keeps its exact bytes', () => {
    const host = createSimHost(level, { rapier });
    host.step();
    expect(host.dayClock).toBeUndefined();
    expect('day' in snapshotSimHost(host)).toBe(false);
    expect(JSON.stringify(level)).toBe(JSON.stringify({ ...SIM_LEVEL, id: 'sim-day', entities: [], quests: [] }));
    expect(() => { host.restoreDayClock(steppeClock().snapshot()); }).toThrow(/day clock/u);
    host.dispose();
  });

  it('advances one fixed step a tick from the level start, exactly as the page clock stepped at 60 Hz, and fires dusk', () => {
    const host = createSimHost(nearDusk, { rapier });
    const clock = host.useDayClock(steppeClock()), page = steppeClock({ start: 17.9 }), heard: string[] = [];
    expect(clock.hour).toBe(17.9); expect(clock.dayPhase).toBe('golden');
    clock.onDusk(() => { heard.push(`dusk@${String(host.state.tick)}`); });
    let seen: string | undefined;
    host.onStep('reader', (_dt, h) => { seen ??= h.dayClock?.dayPhase === 'dusk' ? `dusk@${String(h.state.tick)}` : undefined; });
    let pageDusk = -1;
    for (let t = 1; t <= 800; t++) {
      host.step(); page.update(FIXED_STEP);
      expect(clock.snapshot()).toEqual(page.snapshot());
      if (pageDusk < 0 && page.dayPhase === 'dusk') pageDusk = t;
    }
    // golden runs 1.5 h over 3 min: 0.1 h is 12 s (tick 720, 721 by the float sum); the step callbacks see it that tick
    expect(pageDusk).toBeGreaterThanOrEqual(720); expect(pageDusk).toBeLessThanOrEqual(721);
    expect(heard).toEqual([`dusk@${String(pageDusk)}`]); expect(seen).toBe(`dusk@${String(pageDusk)}`);
    expect(host.dayClock?.night).toBeGreaterThan(0);
    expect(() => host.useDayClock(steppeClock())).toThrow(/once/u);
    host.dispose();
  });

  it('a phase clock (Pine Hollow) starts where the level says, in its own units', () => {
    const host = createSimHost({ ...level, day: { start: 0.82 } }, { rapier });
    const clock = host.useDayClock(new DayCycle(PINE_DAY));
    expect(clock.snapshot()).toEqual(new DayCycle({ ...PINE_DAY, start: 0.82 }).snapshot()); // as the page sky started there
    expect(clock.dayPhase).toBe('golden');
    for (let t = 0; t < 60 * 30; t++) host.step(); // 30 s of a 24-minute day: past 18:00
    expect(clock.dayPhase).toBe('dusk');
    host.dispose();
  });

  it.each([5, 700, 1500])('snapshots at tick %i and restores the exact clock continuation', (checkpoint) => {
    const install = (host: SimHost): void => { host.useDayClock(steppeClock()).scale = 2; };
    const original = createSimHost(nearDusk, { rapier }); install(original);
    for (let t = 0; t < checkpoint; t++) original.step();
    const saved = snapshotSimHost(original);
    expect(saved.day?.last).toBe(original.dayClock?.dayPhase);
    const restored = restoreSimHost(nearDusk, { rapier }, decodeSimSnapshot(serializeSimSnapshot(saved)), install);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    const heard: string[][] = [[], []];
    original.dayClock?.onPhase((p) => { heard[0]?.push(`${p}@${String(original.state.tick)}`); });
    restored.dayClock?.onPhase((p) => { heard[1]?.push(`${p}@${String(restored.state.tick)}`); });
    for (let t = checkpoint; t < 3000; t++) { original.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    expect(heard[1]).toEqual(heard[0]);
    expect(() => restoreSimHost(nearDusk, { rapier }, saved)).toThrow(/day clock/u);
    original.dispose(); restored.dispose();
  });
});
