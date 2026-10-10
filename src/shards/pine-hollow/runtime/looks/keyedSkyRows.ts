import type { LightPreset, ScheduleSeg, TimePick } from '@wildshard/engine/world/dayCycle';

/**
 * A keyed sky's row types (SHARD-PLATFORM M3, look-family rows; `keyedSkyDay` is its clock, `keyedSky` its backdrop) and its
 * key files: import-free at run time, so a shard's boot file list reads the key URLs without the clock.
 */

/** Linear RGB. */
export type SkyRgb = readonly [number, number, number];
/** A colour as data: an sRGB hex number (converted to linear like `new Color(hex)`), or linear RGB. */
export type SkyColour = number | SkyRgb;

/** One photographic sky key: a baked equirect pair and where its own sun (or moon, or brightest glow) sits. */
export interface SkyKeyRow {
  /** the asset id the key files are named by */
  readonly id: string;
  /** the sun's equirect u (three's `equirectUv`: u = atan(z, x) / 2π + 0.5) */
  readonly sunU: number;
  /** the sun's elevation in degrees */
  readonly sunEl: number;
  /** degrees around the key's sun painted out by the bake (0 = no disc to remove) */
  readonly paint: number;
}

/** One keyed light preset, as data. */
export interface SkyPresetRow {
  /** the sky key it shows */
  readonly key: string;
  /** the key's gain: sky brightness relative to the photo */
  readonly bg: number;
  /** scene.environmentIntensity over the rendered sky */
  readonly env: number;
  /** the light body (sun by day, moon by night): colour, intensity */
  readonly light: SkyColour; readonly lightI: number;
  readonly hemiSky: SkyColour; readonly hemiGround: SkyColour; readonly hemiI: number;
  /** the fog's in-scatter toward the light, its distance and height densities */
  readonly fogSun: SkyColour; readonly fogDist: number; readonly fogHeight: number;
  /** volumetric shafts' strength and colour; god-ray opacity */
  readonly vol: number; readonly volColor: SkyColour; readonly rays: number;
  /** the dome's aureole around the light, the disc, the corona sprite (colour × opacity) */
  readonly glow: SkyColour; readonly disc: SkyColour; readonly halo: SkyColour; readonly haloO: number;
  /** the cloud layer: the tint toward the light, the lit / shade multiplier and its opacity */
  readonly cloudSun: SkyColour; readonly cloudLit: SkyColour; readonly cloudA: number;
  /** the far ridges' haze colour */
  readonly far: SkyColour;
  /** the night lights: 0 day … 1 full night */
  readonly lamps: number;
  /** the grade's saturation */
  readonly sat: number;
}

/** A keyed sky: its keys, presets, keyframes, phases and paths. */
export interface KeyedSkyStyle {
  /** the day's share of the cycle (sunset's phase) */
  readonly dayFraction: number;
  /** the whole cycle in real minutes */
  readonly cycleMinutes: number;
  /** the start phase when nothing pins one */
  readonly start: number;
  /** the real-time schedule the clock's hours run on */
  readonly schedule: readonly ScheduleSeg[];
  /** the photographic sky keys by name */
  readonly keys: Readonly<Record<string, SkyKeyRow>>;
  /** the key whose glow sits on the moon (every other key's sits on the sun) */
  readonly moonKey: string;
  /** the key's baked pair, `{id}` replaced by the key's id: the colour JPEG and its gain map */
  readonly keyFiles: { readonly color: string; readonly gain: string };
  /** the light presets by name */
  readonly presets: Readonly<Record<string, SkyPresetRow>>;
  /** keyframes over the phase (sorted; wraps 1 → 0): a phase and the preset it holds */
  readonly frames: readonly (readonly [number, string])[];
  /** named phases (`?tod=` names, the quest's and ambience's times) */
  readonly phases: Readonly<Record<string, number>>;
  /** Settings ▸ Time of day's picks */
  readonly fixed: Readonly<Record<Exclude<TimePick, 'live'>, number>>;
  /** the engine's named light presets */
  readonly lightPresets: Readonly<Record<LightPreset, number>>;
  /** the sun's path: compass azimuths (0 = north = +Z, 90 = east = −X) and elevations in degrees */
  readonly sun: { readonly riseAz: number; readonly setAz: number; readonly noonEl: number; readonly nightDip: number };
  /** the moon's path over the night: azimuth `az` + `azSpan` × s, elevation `el` + `elRise` × sin(π s) */
  readonly moon: { readonly az: number; readonly azSpan: number; readonly el: number; readonly elRise: number };
  /** the night curve: up over dayFraction + `rise`, down over `set` (phases) */
  readonly night: { readonly rise: readonly [number, number]; readonly set: readonly [number, number] };
  /** the night light body's fade: in over dayFraction + `rise`, out over `set` (the day's follows the sun's height) */
  readonly moonFade: { readonly rise: readonly [number, number]; readonly set: readonly [number, number] };
  /** the dusk curve's sun heights (1 → 0) */
  readonly dusk: readonly [number, number];
  /** the dawn curve: its phase and the distance window it fades over */
  readonly dawn: { readonly at: number; readonly width: readonly [number, number] };
  /** the dome: its object name, radius and sphere segments */
  readonly dome: { readonly name: string; readonly radius: number; readonly segments: readonly [number, number] };
}

/** A key's file URLs: the colour JPEG and its gain map. */
export function skyKeyFiles(style: KeyedSkyStyle, key: SkyKeyRow): { color: string; gain: string } {
  return { color: style.keyFiles.color.replaceAll('{id}', key.id), gain: style.keyFiles.gain.replaceAll('{id}', key.id) };
}

/** Every key's baked pair, for the boot pack (the clock never fetches a key mid-play). */
export function keyedSkyUrls(style: KeyedSkyStyle): string[] {
  return Object.values(style.keys).flatMap((k) => { const f = skyKeyFiles(style, k); return [f.color, f.gain]; });
}
