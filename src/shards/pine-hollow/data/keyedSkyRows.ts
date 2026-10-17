import type { DayClockStyle } from '@wildshard/sdk/looks/dayClock';
import type { DayLookPreset, DayLookSchema } from '@wildshard/sdk/looks/dayLookPresets';
import type { OvercastRow } from '@wildshard/sdk/looks/overcast';
import * as v from 'valibot';

/**
 * A keyed sky's row types and its preset schema (SHARD-PLATFORM M3, look-family rows; the shared day clock is its clock,
 * runtime/looks/keyedSky.ts its backdrop, which also names each key's files): plain data, no functions (W2c).
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

/** A preset's fields by kind (`dayLookPresets`: the row → its live preset, copied and blended by the clock). */
export const SKY_PRESET = {
  key: 'name', bg: 'number', env: 'number', light: 'colour', lightI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  fogSun: 'colour', fogDist: 'number', fogHeight: 'number', vol: 'number', volColor: 'colour', rays: 'number',
  glow: 'colour', disc: 'colour', halo: 'colour', haloO: 'number', cloudSun: 'colour', cloudLit: 'colour', cloudA: 'number',
  far: 'colour', lamps: 'number', sat: 'number',
} as const satisfies DayLookSchema & Record<keyof SkyPresetRow, unknown>;

const n = v.number(), pair = v.tuple([n, n]), rgb = v.tuple([n, n, n]), colour = v.union([n, rgb]);
const numberKey = v.picklist(['bg', 'env', 'lightI', 'hemiI', 'fogDist', 'fogHeight', 'vol', 'rays', 'haloO', 'cloudA', 'lamps', 'sat']);
const colourKey = v.picklist(['light', 'hemiSky', 'hemiGround', 'fogSun', 'volColor', 'glow', 'disc', 'halo', 'cloudSun', 'cloudLit', 'far']);
const preset = v.strictObject({ key: v.string(), bg: n, env: n, light: colour, lightI: n, hemiSky: colour, hemiGround: colour, hemiI: n,
  fogSun: colour, fogDist: n, fogHeight: n, vol: n, volColor: colour, rays: n, glow: colour, disc: colour, halo: colour, haloO: n,
  cloudSun: colour, cloudLit: colour, cloudA: n, far: colour, lamps: n, sat: n });

/** Decode authored JSON at the clock boundary, including tuple arity and weather field kinds. */
export const KEYED_SKY = v.strictObject({
  dayFraction: n, cycleMinutes: n, start: n,
  schedule: v.array(v.strictObject({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: n, to: n, minutes: n })),
  keys: v.record(v.string(), v.strictObject({ id: v.string(), sunU: n, sunEl: n, paint: n })),
  moonKey: v.string(), keyFiles: v.strictObject({ color: v.string(), gain: v.string() }), presets: v.record(v.string(), preset),
  frames: v.array(v.tuple([n, v.string()])), phases: v.record(v.string(), n),
  fixed: v.strictObject({ midday: n, golden: n, sunset: n, night: n }), namedPhases: v.strictObject({ dawn: n, noon: n, dusk: n, night: n }),
  sun: v.strictObject({ rise: n, sweep: n, noon: n, nightRise: n, nightSweep: n, nadir: n }), moon: v.strictObject({ rise: n, sweep: n, base: n, arc: n }),
  night: v.strictObject({ rise: pair, fall: pair }), fade: v.strictObject({ sunY: pair, moonIn: pair, moonOut: pair }), nightShadow: n,
  dusk: pair, dawn: v.strictObject({ at: n, width: pair }), dome: v.strictObject({ name: v.string(), radius: n, segments: pair }),
  overcast: v.array(v.variant('op', [
    v.strictObject({ op: v.literal('scale'), key: v.union([numberKey, colourKey]), by: n, curve: v.exactOptional(pair) }),
    v.strictObject({ op: v.literal('add'), key: numberKey, by: n }), v.strictObject({ op: v.literal('atLeast'), key: numberKey, by: n }),
    v.strictObject({ op: v.literal('grey'), key: colourKey, by: n, tint: rgb }),
    v.strictObject({ op: v.literal('toward'), key: colourKey, by: n, colour: rgb, lit: v.exactOptional(n) }),
  ])),
});

/** A keyed sky's live preset: the row's colours as three.js colours. */
export type SkyPreset = DayLookPreset<typeof SKY_PRESET>;

/** A keyed sky: its keys and dome over the shared day clock's row (presets, keyframes, phases, paths and curves). */
export interface KeyedSkyStyle extends DayClockStyle<typeof SKY_PRESET> {
  /** the whole cycle in real minutes */
  readonly cycleMinutes: number;
  /** the photographic sky keys by name */
  readonly keys: Readonly<Record<string, SkyKeyRow>>;
  /** the key whose glow sits on the moon (every other key's sits on the sun) */
  readonly moonKey: string;
  /** the key's baked pair, `{id}` replaced by the key's id: the colour JPEG and its gain map */
  readonly keyFiles: { readonly color: string; readonly gain: string };
  /** the light presets by name */
  readonly presets: Readonly<Record<string, SkyPresetRow>>;
  /** named phases (`?tod=` names, the quest's and ambience's times) */
  readonly phases: Readonly<Record<string, number>>;
  /** the key light's shadow intensity at full night (1 by day, blended by the night curve): the moon's shade is not black */
  readonly nightShadow: number;
  /** the dusk curve's sun heights (1 → 0) */
  readonly dusk: readonly [number, number];
  /** the dome: its object name, radius and sphere segments */
  readonly dome: { readonly name: string; readonly radius: number; readonly segments: readonly [number, number] };
  /** the weather's cloud deck over the blended preset (`@wildshard/sdk/looks/overcast`), in order */
  readonly overcast: readonly OvercastRow<SkyPreset>[];
}
