import type { DayClockRow, DayClockSegment } from '@wildshard/format/dayCycle';
import { compassDir as dirFrom, DayCycle, type DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import * as THREE from 'three';
import { dayLookPresets, type DayLookPreset, type DayLookRow, type DayLookSchema } from './dayLookPresets';

/**
 * A keyed day / night clock as data (SHARD-PLATFORM W2 C2; Pine Hollow's keyed sky and Driftwood's faceted day): a shard's
 * row of keyed light presets, keyframes over the phase, the sun's and moon's arcs and the night / dusk / dawn / fade curves
 * becomes the engine's `DayCycleSpec` (the presets blended between neighbouring keyframes) and the curves, renderer-free,
 * so a headless host steps the same clock the page draws. Nothing here knows a shard or what its presets hold.
 *
 *   phase 0..1 over the cycle: [0, dayFraction) is the day (sunrise at 0, sunset at dayFraction), the rest the night
 *   the sun: compass azimuth `rise` + `sweep` × s by day, `noon` degrees up halfway; by night `nightRise` + `nightSweep` × s,
 *            `nadir` degrees down at the night's middle (its glow leads the dawn)
 *   the moon: azimuth `rise` + `sweep` × s over the night, elevation `base` + `arc` × sin(π s)
 *   the night: `eve` (by day only, × its height), then up over `rise` and down over `fall` (absolute phases)
 *   the light's fade: the sun's by its height (`fade.sunY`), the moon's in and out by phase
 *
 * A backdrop then starts the clock where the URL or Settings ▸ Time of day put it (`./daySky` runDayClock) and turns the scene's
 * key lights with it (`driveDayLight`).
 */

type Range = readonly [number, number];
/** A clock's curves (the engine's DayCycleSpec curves). */
export type DayCurves = NonNullable<DayCycleSpec['curves']>;

/** A keyed day clock's row: the shard's own row type extends this. */
export interface DayClockStyle<S extends DayLookSchema> {
  /** the day's share of the cycle (sunset's phase) */
  readonly dayFraction: number;
  /** the start phase when nothing pins one */
  readonly start: number;
  readonly schedule: readonly DayClockSegment[];
  /** Settings ▸ Time of day's picks → the phase they park the clock at */
  readonly fixed: DayClockRow['fixed'];
  /** the engine's named light presets → phase */
  readonly namedPhases: DayClockRow['presets'];
  /** `?tod=` names → phase (a number always works) */
  readonly phases?: Readonly<Record<string, number>>;
  readonly presets: Readonly<Record<string, DayLookRow<S>>>;
  /** keyframes over the phase (sorted; wraps 1 → 0): a phase and the preset it holds */
  readonly frames: readonly (readonly [number, string])[];
  readonly sun: { readonly rise: number; readonly sweep: number; readonly noon: number; readonly nightRise: number; readonly nightSweep: number; readonly nadir: number };
  readonly moon: { readonly rise: number; readonly sweep: number; readonly base: number; readonly arc: number };
  readonly night: { readonly eve?: { readonly span: Range; readonly height: number }; readonly rise: Range; readonly fall: Range };
  readonly fade: { readonly sunY: Range; readonly moonIn: Range; readonly moonOut: Range };
  /** the dusk curve from the sun's height (1 → 0 over these heights, never under the night); without it, `duskOf` */
  readonly dusk?: Range;
  /** the dawn curve: its phase and the distance window it fades over (none: 0) */
  readonly dawn?: { readonly at: number; readonly width: Range };
}

/** What a preset adds to the curves: its dusk level (eased between keyframes), its lamps (over the night). */
export interface DayClockReads<S extends DayLookSchema> {
  readonly duskOf?: (p: DayLookPreset<S>) => number;
  readonly lampsOf?: (p: DayLookPreset<S>) => number;
}

/** A keyed day clock: the engine spec, the live presets, the bodies' paths and the curves. */
export interface DayClock<S extends DayLookSchema, T extends DayClockStyle<S> = DayClockStyle<S>> {
  readonly style: T;
  readonly spec: DayCycleSpec<DayLookPreset<S>> & { readonly curves: DayCurves };
  /** the live presets by name, one object each (the keyframes share them) */
  readonly presets: Readonly<Record<string, DayLookPreset<S>>>;
  /** a preset's copy (its own colours) */
  readonly clone: (p: DayLookPreset<S>) => DayLookPreset<S>;
  readonly sunAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  readonly moonAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  /** 0 at day … 1 at full night */
  readonly nightAt: (p: number) => number;
  readonly dawnAt: (p: number) => number;
  /** the light body's fade at phase p: the sun's by its height `sun` by day, the moon's swap in and out by night */
  readonly fadeAt: (p: number, sun: THREE.Vector3) => number;
}

const smooth = THREE.MathUtils.smoothstep;

/** The clock a row declares, its presets of `schema`. */
export function dayClock<S extends DayLookSchema, T extends DayClockStyle<S>>(schema: S, style: T, reads: DayClockReads<S> = {}): DayClock<S, T> {
  const kit = dayLookPresets(schema), DAY = style.dayFraction, { sun, moon, night, fade } = style;
  const presets: Record<string, DayLookPreset<S>> = {};
  for (const [name, row] of Object.entries(style.presets)) presets[name] = kit.live(row);
  const frames: (readonly [number, DayLookPreset<S>])[] = style.frames.map(([phase, name]) => {
    const preset = presets[name];
    if (preset === undefined) throw new Error(`day clock: no preset ${name}`);
    return [phase, preset] as const;
  });
  const first = frames[0]?.[1];
  if (first === undefined) throw new Error('day clock: no keyframes');
  const sunAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    if (p < DAY) { const s = p / DAY; return dirFrom(sun.rise + sun.sweep * s, Math.sin(Math.PI * s) * sun.noon, out); }
    const s = (p - DAY) / (1 - DAY); return dirFrom(sun.nightRise + sun.nightSweep * s, -Math.sin(Math.PI * s) * sun.nadir, out);
  };
  const moonAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
    return dirFrom(moon.rise + moon.sweep * s, moon.base + Math.sin(Math.PI * s) * moon.arc, out);
  };
  const eve = night.eve;
  const nightAt = (p: number): number => {
    if (eve !== undefined && p < DAY) return p > eve.span[0] ? smooth(p, eve.span[0], eve.span[1]) * eve.height : 0;
    return smooth(p, night.rise[0], night.rise[1]) * (1 - smooth(p, night.fall[0], night.fall[1]));
  };
  const dawn = style.dawn;
  const dawnAt = (p: number): number => {
    if (dawn === undefined) return 0;
    const d = Math.min(Math.abs(p - dawn.at), Math.abs(p - 1 - dawn.at));
    return 1 - smooth(d, dawn.width[0], dawn.width[1]);
  };
  const fadeAt = (p: number, s: THREE.Vector3): number => (p < DAY ? smooth(s.y, fade.sunY[0], fade.sunY[1])
    : smooth(p, fade.moonIn[0], fade.moonIn[1]) * (1 - smooth(p, fade.moonOut[0], fade.moonOut[1])));
  const base: DayCycleSpec<DayLookPreset<S>> = {
    units: 'phase', start: style.start, dayFraction: DAY, schedule: style.schedule,
    keys: { coordinate: 'phase', frames, blend: kit.lerp }, sun: { path: sunAt, moon: moonAt },
    fixed: style.fixed, presets: style.namedPhases,
  };
  // dusk: the sun's height, or the presets' dusk eased between keyframes
  const duskSun = new THREE.Vector3(), duskScratch = kit.clone(first), { duskOf, lampsOf } = reads, duskRow = style.dusk;
  const dusk = (p: number): number => {
    if (duskRow !== undefined) return Math.max(nightAt(p), 1 - smooth(sunAt(p, duskSun).y, duskRow[0], duskRow[1]));
    if (duskOf === undefined) return 0;
    let i = 0;
    while (i < frames.length - 2 && (frames[i + 1]?.[0] ?? 1) <= p) i++;
    const a = frames[i], b = frames[i + 1];
    if (a && b) kit.lerp(duskScratch, a[1], b[1], smooth(p, a[0], b[0]));
    return duskOf(duskScratch);
  };
  // lamps: the presets' lamps (keyed like the light) over the night
  const lampClock = new DayCycle(base), lampScratch = kit.clone(first);
  const lamps = (p: number): number => {
    if (lampsOf === undefined) return nightAt(p);
    lampClock.phase = p; lampClock.key(lampScratch);
    return Math.max(lampsOf(lampScratch), nightAt(p));
  };
  const spec: DayClock<S, T>['spec'] = { ...base, curves: { night: nightAt, dusk, dawn: dawnAt, lamps } };
  return { style, spec, presets, clone: kit.clone, sunAt, moonAt, nightAt, dawnAt, fadeAt };
}

