import type { Color, Vector3 } from 'three';
import type { DayLookRow } from '@wildshard/format/dayLook';

type RGB = [number, number, number];
export interface SkyKey {
  el: number;
  sun: RGB; sunI: number;
  zenith: RGB; horizon: RGB; ground: RGB; glow: RGB; stars: number;
  hemiSky: RGB; hemiGround: RGB; hemiI: number; env: number;
  fog: RGB; fogSun: RGB;
  shade: RGB; rim: RGB;
  cloudSun: RGB; cloud: RGB; planet: RGB;
  shadowTint: RGB; highTint: RGB; lift: RGB; gain: RGB; sat: number; contrast: number;
  vol: RGB; volS: number; rays: number;
}

// ─────────────────────────────────────────────── the look ───────────────────────────────────────────────

/** everything the sky rig paints, as plain numbers (lerpable) — the clock builds one, weather modifies it, `apply` writes it */
export interface SkyLook {
  /** the sun's direction (even below the horizon: the dome's afterglow follows it) */
  sunDir: Vector3;
  /** the key light: the sun by day, the moon at night */
  keyDir: Vector3; keyColor: Color; keyIntensity: number;
  /** 0 = the key is the sun, 1 = the moon (the disc's look) */
  moon: number;
  /** the sun/moon disc's visibility 0..1 (a storm deck hides it) */
  disc: number;
  zenith: Color; horizon: Color; ground: Color; glow: Color;
  stars: number;
  hemiSky: Color; hemiGround: Color; hemiIntensity: number;
  envIntensity: number;
  fogColor: Color; fogSunColor: Color; fogDist: number; fogHeightDensity: number;
  shadeTint: Color; rimColor: Color;
  cloudSun: Color; cloudLight: Color; planetLight: Color; planetOpacity: number;
  shadowTint: Color; highTint: Color; lift: Color; gain: Color;
  saturation: number; contrast: number; brightness: number;
  volColor: Color; volStrength: number;
  godRays: number;
}

export type SkyPalette = Omit<SkyLook, 'sunDir' | 'keyDir'>;
export type SkySchema = { [K in keyof SkyPalette]: SkyPalette[K] extends Color ? 'colour' : 'number' };
export interface SkyRows { day: SkyKey; schema: SkySchema; initial: DayLookRow<SkySchema> }
