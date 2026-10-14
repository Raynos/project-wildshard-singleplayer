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
import { compassDir as dirFrom, type DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import { dayLookPresets, type DayLookPreset } from '@wildshard/sdk/looks/dayLookPresets';
import { FACETED_DAY_PRESET, type FacetedDayStyle } from '../../data/facetedDayRows';

/** one live preset (the row's colours as three.js colours) */
export type FacetedDayPreset = DayLookPreset<typeof FACETED_DAY_PRESET>;
const presetKit = dayLookPresets(FACETED_DAY_PRESET);
/** a row's live preset */
const facetedDayPreset = presetKit.live;
/** `out` = a → b at t */
const lerpFacetedDayPreset = presetKit.lerp;
/** a preset's copy */
export const cloneFacetedDayPreset = presetKit.clone;

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
