/**
 * A faceted sky's day / night clock as a look-family system (SHARD-PLATFORM M3, look-family rows): the clock spec, the sun's
 * and moon's arcs, the night curve and the keyed light presets are one data row (`FacetedDayStyle`), renderer-free, so a
 * headless host steps the same clock the page draws (`facetedDay`). Nothing here knows a shard.
 *
 * - **presets** light the scene per keyframe: the sky dome + cumulus palette, the sun's colour and intensity, the hemisphere
 *   fill, the toon light's shade lift, rim and fog ramp, the fog's sun in-scatter, the disc, the cloud shadows, the dusk
 *   level. A colour is an sRGB hex number or a linear RGB triple.
 * - **frames** key them over the phase (sorted; the table wraps: 1.0 = 0.0), blended linearly by the engine's clock.
 * - **arcs**: the sun rises at `sun.rise` (compass degrees), sweeps `sun.sweep` to its noon height `sun.noon`; under the
 *   horizon at night (`sun.nightRise`, `sun.nightSweep`, `sun.nadir`); the moon rides `moon.base` + `moon.arc` degrees.
 * - **night** rises late in the day (`night.eve`: from phase … to the day's end, × its height), then fully over
 *   `night.rise` and back to day over `night.fall`.
 */
import * as THREE from 'three';
import type { OptionValue } from '@wildshard/engine/ui/Settings';
import type { DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import type { SkyPalette } from './facetedSky';

type Rgb = readonly [number, number, number];
/** a colour as data: an sRGB hex number or linear RGB */
export type DayColour = number | Rgb;
type Range = readonly [number, number];

/** one keyed light preset, as data */
export interface FacetedDayPresetRow {
  readonly sky: {
    readonly zenith: DayColour; readonly horizon: DayColour; readonly below: DayColour; readonly sunGlow: DayColour;
    readonly cloudLit: DayColour; readonly cloudShade: DayColour; readonly night: number;
  };
  readonly sunColor: DayColour; readonly sunI: number;
  readonly hemiSky: DayColour; readonly hemiGround: DayColour; readonly hemiI: number;
  readonly lift: DayColour; readonly rim: DayColour; readonly fogNear: DayColour; readonly fogSun: DayColour;
  readonly disc: DayColour; readonly cloudShadow: number; readonly dusk: number;
}

/** a faceted day's row: the clock, presets, keyframes, arcs, curves and the backdrop's numbers */
export interface FacetedDayStyle {
  /** the day's share of the cycle: [0, dayFraction) is the day (sunrise → sunset), the rest the night */
  readonly dayFraction: number;
  /** the start phase with no Time of day pinned */
  readonly start: number;
  readonly schedule: DayCycleSpec['schedule'];
  /** Settings ▸ Time of day's fixed picks → the phase they park the clock at */
  readonly fixed: DayCycleSpec['fixed'];
  /** the engine's named light presets → phase */
  readonly namedPhases: DayCycleSpec['presets'];
  readonly presets: Readonly<Record<string, FacetedDayPresetRow>>;
  /** [phase, preset name], sorted */
  readonly frames: readonly (readonly [number, string])[];
  readonly sun: { readonly rise: number; readonly sweep: number; readonly noon: number; readonly nightRise: number; readonly nightSweep: number; readonly nadir: number };
  readonly moon: { readonly rise: number; readonly sweep: number; readonly base: number; readonly arc: number };
  readonly night: { readonly eve: Range; readonly eveHeight: number; readonly rise: Range; readonly fall: Range };
  /** the light's fade: the sun by its height, the moon in and out by phase */
  readonly fade: { readonly sunY: Range; readonly moonIn: Range; readonly moonOut: Range };
  /** the shadow light turns in steps of this many degrees */
  readonly shadowStepDeg: number;
  /** seconds between environment re-renders */
  readonly envRefresh: number;
  /** the PMREM cube size of the dome's environment */
  readonly envSize: number;
  /** the sun before the clock moves it (normalised) */
  readonly startSun: Rgb;
  /** the planet's lit-side haze: the horizon toward this colour, by this much by day */
  readonly planetHaze: Rgb; readonly planetHazeDay: number;
  /** the disc's scale by night */
  readonly moonDisc: number;
  /** the level's sun intensity this row's `sunI` is relative to */
  readonly sunIBase: number;
}

/** one live preset (the row's colours as three.js colours) */
export interface FacetedDayPreset {
  sky: SkyPalette;
  sunColor: THREE.Color; sunI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  lift: THREE.Color; rim: THREE.Color; fogNear: THREE.Color; fogSun: THREE.Color;
  disc: THREE.Color; cloudShadow: number; dusk: number;
}

/** a faceted day's clock: the engine spec, the bodies' paths and the curves */
export interface FacetedDay {
  readonly style: FacetedDayStyle;
  readonly spec: DayCycleSpec<FacetedDayPreset>;
  readonly presets: Readonly<Record<string, FacetedDayPreset>>;
  readonly sunAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  readonly moonAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  readonly nightAt: (p: number) => number;
  readonly fixed: Record<Exclude<OptionValue<'time'>, 'live'>, number>;
}

const colour = (c: DayColour): THREE.Color => (typeof c === 'number' ? new THREE.Color(c) : new THREE.Color(c[0], c[1], c[2]));

/** a row's live preset */
export function facetedDayPreset(row: FacetedDayPresetRow): FacetedDayPreset {
  const s = row.sky;
  return {
    sky: { zenith: colour(s.zenith), horizon: colour(s.horizon), below: colour(s.below), sunGlow: colour(s.sunGlow), cloudLit: colour(s.cloudLit), cloudShade: colour(s.cloudShade), night: s.night },
    sunColor: colour(row.sunColor), sunI: row.sunI,
    hemiSky: colour(row.hemiSky), hemiGround: colour(row.hemiGround), hemiI: row.hemiI,
    lift: colour(row.lift), rim: colour(row.rim), fogNear: colour(row.fogNear), fogSun: colour(row.fogSun),
    disc: colour(row.disc), cloudShadow: row.cloudShadow, dusk: row.dusk,
  };
}

/** `out` = a → b at t */
export function lerpFacetedDayPreset(out: FacetedDayPreset, a: FacetedDayPreset, b: FacetedDayPreset, t: number): void {
  const L = (o: THREE.Color, x: THREE.Color, y: THREE.Color) => { o.copy(x).lerp(y, t); };
  L(out.sky.zenith, a.sky.zenith, b.sky.zenith); L(out.sky.horizon, a.sky.horizon, b.sky.horizon); L(out.sky.below, a.sky.below, b.sky.below);
  L(out.sky.sunGlow, a.sky.sunGlow, b.sky.sunGlow); L(out.sky.cloudLit, a.sky.cloudLit, b.sky.cloudLit); L(out.sky.cloudShade, a.sky.cloudShade, b.sky.cloudShade);
  out.sky.night = a.sky.night + (b.sky.night - a.sky.night) * t;
  L(out.sunColor, a.sunColor, b.sunColor); out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  L(out.hemiSky, a.hemiSky, b.hemiSky); L(out.hemiGround, a.hemiGround, b.hemiGround); out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  L(out.lift, a.lift, b.lift); L(out.rim, a.rim, b.rim); L(out.fogNear, a.fogNear, b.fogNear); L(out.fogSun, a.fogSun, b.fogSun);
  L(out.disc, a.disc, b.disc);
  out.cloudShadow = a.cloudShadow + (b.cloudShadow - a.cloudShadow) * t; out.dusk = a.dusk + (b.dusk - a.dusk) * t;
}

/** a preset's copy */
export const cloneFacetedDayPreset = (p: FacetedDayPreset): FacetedDayPreset => ({
  sky: { zenith: p.sky.zenith.clone(), horizon: p.sky.horizon.clone(), below: p.sky.below.clone(), sunGlow: p.sky.sunGlow.clone(), cloudLit: p.sky.cloudLit.clone(), cloudShade: p.sky.cloudShade.clone(), night: p.sky.night },
  sunColor: p.sunColor.clone(), sunI: p.sunI, hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), hemiI: p.hemiI,
  lift: p.lift.clone(), rim: p.rim.clone(), fogNear: p.fogNear.clone(), fogSun: p.fogSun.clone(), disc: p.disc.clone(),
  cloudShadow: p.cloudShadow, dusk: p.dusk,
});

const d2r = Math.PI / 180;
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}

/** The clock a faceted day's row declares (renderer-free). */
export function facetedDay(style: FacetedDayStyle): FacetedDay {
  const DAY = style.dayFraction, { sun, moon, night } = style;
  const presets: Record<string, FacetedDayPreset> = {};
  for (const [name, row] of Object.entries(style.presets)) presets[name] = facetedDayPreset(row);
  const frames: [number, FacetedDayPreset][] = style.frames.map(([p, name]) => {
    const preset = presets[name];
    if (preset === undefined) throw new Error(`faceted day: no preset ${name}`);
    return [p, preset];
  });
  const first = frames[0]?.[1];
  if (first === undefined) throw new Error('faceted day: no keyframes');
  const sunAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    if (p < DAY) { const s = p / DAY; return dirFrom(sun.rise + sun.sweep * s, Math.sin(Math.PI * s) * sun.noon, out); }
    const s = (p - DAY) / (1 - DAY); return dirFrom(sun.nightRise + sun.nightSweep * s, -Math.sin(Math.PI * s) * sun.nadir, out);
  };
  const moonAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
    return dirFrom(moon.rise + moon.sweep * s, moon.base + Math.sin(Math.PI * s) * moon.arc, out);
  };
  const nightAt = (p: number): number => {
    if (p < DAY) return p > night.eve[0] ? THREE.MathUtils.smoothstep(p, night.eve[0], night.eve[1]) * night.eveHeight : 0;
    return THREE.MathUtils.smoothstep(p, night.rise[0], night.rise[1]) * (1 - THREE.MathUtils.smoothstep(p, night.fall[0], night.fall[1]));
  };
  const scratch = cloneFacetedDayPreset(first);
  const dusk = (p: number): number => {
    let i = 0;
    while (i < frames.length - 2 && (frames[i + 1]?.[0] ?? 1) <= p) i++;
    const a = frames[i], b = frames[i + 1];
    if (a && b) lerpFacetedDayPreset(scratch, a[1], b[1], THREE.MathUtils.smoothstep(p, a[0], b[0]));
    return scratch.dusk;
  };
  const fixed = { ...style.fixed };
  const spec: DayCycleSpec<FacetedDayPreset> = {
    units: 'phase', start: style.start, dayFraction: DAY,
    schedule: style.schedule,
    keys: { coordinate: 'phase', frames, blend: lerpFacetedDayPreset }, sun: { path: sunAt, moon: moonAt },
    fixed, presets: { ...style.namedPhases },
    curves: { night: nightAt, dusk, dawn: () => 0, lamps: nightAt },
  };
  return { style, spec, presets, sunAt, moonAt, nightAt, fixed };
}
