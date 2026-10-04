import type { OptionValue } from '@wildshard/engine/ui/Settings';
import { DayCycle, type DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import * as THREE from 'three';
import type { SkyKeyName } from './skyKeys';

const DAY = 20 / 24;
const d2r = Math.PI / 180;
/** the shadow-casting light turns in steps of this (DayNight.ts SHADOW_STEP, E89) */

/** the sun's path: rises in the NE (compass 54°), 52° up in the south at noon, sets in the NW (306°: the old sunset's azimuth) */
const RISE_AZ = 54, SET_AZ = 306, NOON_EL = 52;
/** named phases for `?tod=` and Settings ▸ Time of day */
export const PINE_PHASES = { sunrise: 0.008, morning: 0.085, day: 0.4167, midday: 0.4167, noon: 0.4167, golden: 0.735, sunset: 0.8, dusk: 0.85, night: 0.92, dawn: 0.985 } as const;
export const FIXED_PHASE: Record<Exclude<OptionValue<'time'>, 'live'>, number> = { midday: PINE_PHASES.midday, golden: PINE_PHASES.golden, sunset: PINE_PHASES.sunset, night: PINE_PHASES.night };

export interface Preset {
  /** the HDRI key */
  key: SkyKeyName;
  /** the key's gain: sky brightness relative to the photo (Poly Haven normalises every exposure) */
  bg: number;
  /** scene.environmentIntensity over the rendered sky */
  env: number;
  /** the light body (sun by day, moon by night): colour, intensity */
  light: THREE.Color; lightI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  /** the fog's in-scatter toward the light, its distance and height densities */
  fogSun: THREE.Color; fogDist: number; fogHeight: number;
  /** volumetric shafts (VolumetricsEffect uStrength) and their colour; god-ray opacity */
  vol: number; volColor: THREE.Color; rays: number;
  /** the dome's aureole around the light, the disc, the corona sprite (colour × opacity) */
  glow: THREE.Color; disc: THREE.Color; halo: THREE.Color; haloO: number;
  /** the cloud layer: the tint toward the light, the lit / shade multiplier and its opacity */
  cloudSun: THREE.Color; cloudLit: THREE.Color; cloudA: number;
  /** the far ridges' haze colour (Horizon.ts) */
  far: THREE.Color;
  /** the night lights (cabin windows, lanterns): 0 day … 1 full night */
  lamps: number;
  /** the grade's saturation (HueSaturationEffect; the fixed look's 0.18): night drains colour, as the eye does in the dark */
  sat: number;
}

const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);
const hex = (h: number): THREE.Color => new THREE.Color(h);
export const P: Record<'sunrise' | 'golden' | 'day' | 'sunset' | 'dusk' | 'night' | 'dawn', Preset> = {
  sunrise: {
    key: 'sunrise', bg: 0.8, env: 1.1, light: c(1.0, 0.62, 0.38), lightI: 2.8, hemiSky: hex(0x8a98c0), hemiGround: hex(0x3a3026), hemiI: 0.36,
    fogSun: c(1.0, 0.66, 0.42), fogDist: 0.00055, fogHeight: 0.009, vol: 0.55, volColor: c(1.0, 0.66, 0.4), rays: 0.85,
    glow: c(2.2, 1.15, 0.55), disc: c(1.0, 0.78, 0.55), halo: c(1.0, 0.72, 0.5), haloO: 0.95, cloudSun: c(1.0, 0.72, 0.52), cloudLit: c(0.95, 0.82, 0.78), cloudA: 0.8, far: c(0.5, 0.5, 0.6), lamps: 0.35, sat: 0.16,
  },
  // E401: the key's photo (late afternoon, the sun 19° up) is brighter and bluer than the day key's, so at bg 1.3 the sky —
  // half of every portrait frame — out-shone midday's and its IBL drowned the warm sun: golden read as noon everywhere but
  // under the old-growth's canopy. The sky now sits below the day's, the fill is less blue and the sun, aureole, clouds and
  // far haze carry the warmth.
  golden: {
    key: 'golden', bg: 0.85, env: 1.05, light: c(1.0, 0.62, 0.32), lightI: 4.6, hemiSky: hex(0x9c98a8), hemiGround: hex(0x5c3e20), hemiI: 0.34,
    fogSun: c(1.0, 0.66, 0.36), fogDist: 0.0005, fogHeight: 0.005, vol: 0.72, volColor: c(1.0, 0.68, 0.38), rays: 1,
    glow: c(2.8, 1.4, 0.55), disc: c(1.0, 0.86, 0.66), halo: c(1.0, 0.74, 0.46), haloO: 0.9, cloudSun: c(1.0, 0.66, 0.4), cloudLit: c(1.0, 0.84, 0.68), cloudA: 0.75, far: c(0.66, 0.6, 0.56), lamps: 0, sat: 0.24,
  },
  day: {
    key: 'day', bg: 1.8, env: 1.1, light: c(1.0, 0.96, 0.9), lightI: 4.4, hemiSky: hex(0xa0b8e0), hemiGround: hex(0x4d4232), hemiI: 0.5,
    fogSun: c(1.0, 0.96, 0.88), fogDist: 0.00035, fogHeight: 0.004, vol: 0.42, volColor: c(1.0, 0.95, 0.85), rays: 0.8,
    glow: c(1.3, 1.25, 1.15), disc: c(1.0, 0.98, 0.95), halo: c(1.0, 0.95, 0.88), haloO: 0.55, cloudSun: c(1.0, 0.97, 0.92), cloudLit: c(1.05, 1.05, 1.05), cloudA: 0.6, far: c(0.55, 0.64, 0.8), lamps: 0, sat: 0.14,
  },
  sunset: { // the pre-remaster fixed look's numbers (pine-hollow.ts sky / atmosphere): sun 3.8, hemi 0x8fa8d0 / 0x4a3a28 × 0.45, env 1.1, bg 0.95
    key: 'sunset', bg: 0.95, env: 1.16, light: c(1.0, 0.76, 0.5), lightI: 3.8, hemiSky: hex(0x8fa8d0), hemiGround: hex(0x4a3a28), hemiI: 0.45,
    fogSun: c(1.0, 0.78, 0.5), fogDist: 0.00045, fogHeight: 0.005, vol: 0.55, volColor: c(1.0, 0.72, 0.42), rays: 1,
    glow: c(2.4, 1.3, 0.55), disc: c(1.0, 0.95, 0.85), halo: c(1.0, 1.0, 1.0), haloO: 1, cloudSun: c(1.0, 0.82, 0.62), cloudLit: c(1.0, 1.0, 1.0), cloudA: 1, far: c(0.5, 0.58, 0.74), lamps: 0.55, sat: 0.18,
  },
  dusk: {
    key: 'dusk', bg: 0.42, env: 1.2, light: c(0.55, 0.6, 0.85), lightI: 0.0, hemiSky: hex(0x5d6694), hemiGround: hex(0x2a2430), hemiI: 0.3,
    fogSun: c(0.85, 0.55, 0.58), fogDist: 0.0006, fogHeight: 0.008, vol: 0.28, volColor: c(0.7, 0.55, 0.75), rays: 0.3,
    glow: c(0.45, 0.28, 0.3), disc: c(0.9, 0.93, 1.0), halo: c(0.6, 0.62, 0.8), haloO: 0.25, cloudSun: c(0.8, 0.5, 0.55), cloudLit: c(0.48, 0.44, 0.56), cloudA: 0.55, far: c(0.24, 0.24, 0.34), lamps: 1, sat: -0.05,
  },
  night: {
    key: 'night', bg: 0.11, env: 3.0, light: c(0.6, 0.72, 1.0), lightI: 3.2, hemiSky: hex(0x4a5e9c), hemiGround: hex(0x1e2434), hemiI: 0.95,
    fogSun: c(0.32, 0.4, 0.58), fogDist: 0.0007, fogHeight: 0.009, vol: 0.4, volColor: c(0.42, 0.52, 0.78), rays: 0.55,
    glow: c(0.1, 0.13, 0.2), disc: c(1.7, 1.8, 2.0), halo: c(0.5, 0.6, 0.9), haloO: 0.35, cloudSun: c(0.3, 0.36, 0.5), cloudLit: c(0.16, 0.19, 0.27), cloudA: 0.18, far: c(0.05, 0.065, 0.1), lamps: 1, sat: -0.3,
  },
  dawn: {
    key: 'dawn', bg: 0.5, env: 1.2, light: c(0.55, 0.62, 0.9), lightI: 0.0, hemiSky: hex(0x6d7aa8), hemiGround: hex(0x2c2a30), hemiI: 0.3,
    fogSun: c(0.95, 0.75, 0.68), fogDist: 0.0006, fogHeight: 0.012, vol: 0.35, volColor: c(0.85, 0.72, 0.7), rays: 0.3,
    glow: c(0.7, 0.5, 0.42), disc: c(0.9, 0.93, 1.0), halo: c(0.8, 0.7, 0.7), haloO: 0.3, cloudSun: c(0.95, 0.7, 0.62), cloudLit: c(0.62, 0.58, 0.64), cloudA: 0.6, far: c(0.34, 0.37, 0.48), lamps: 0.9, sat: -0.02,
  },
};

/** keyframes over the phase (sorted; wraps 1 → 0): the sky key and every knob are blended between neighbours */
export const KEYS: readonly [number, Preset][] = [
  [PINE_PHASES.sunrise, P.sunrise], [PINE_PHASES.morning, P.golden], [0.2, P.day], [0.62, P.day], [PINE_PHASES.golden, P.golden],
  [PINE_PHASES.sunset, P.sunset], [DAY + 0.017, P.dusk], [0.885, P.night], [0.962, P.night], [PINE_PHASES.dawn, P.dawn],
];

/** compass azimuth (0 = north = +Z, 90 = east = −X) + elevation (deg) → unit vector toward the body */
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}
/** the sun: an east → south → west arc by day, on round under the north by night (its glow leads the dawn) */
export function pineSunAt(p: number, out: THREE.Vector3): THREE.Vector3 {
  if (p < DAY) { const s = p / DAY; return dirFrom(RISE_AZ + (SET_AZ - RISE_AZ) * s, NOON_EL * Math.sin(Math.PI * s), out); }
  const s = (p - DAY) / (1 - DAY); return dirFrom(SET_AZ + (360 + RISE_AZ - SET_AZ) * s, -Math.sin(Math.PI * s) * 24, out);
}
/** the moon: up through the night, high in the south (≈ 58°, where the night key's moon is) */
export function pineMoonAt(p: number, out: THREE.Vector3): THREE.Vector3 {
  const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
  return dirFrom(115 + 130 * s, 26 + 32 * Math.sin(Math.PI * s), out);
}
/** 0 at day … 1 at full night (the ambience, the lamps) */
export function pineNightAt(p: number): number {
  return THREE.MathUtils.smoothstep(p, DAY - 0.012, DAY + 0.04) * (1 - THREE.MathUtils.smoothstep(p, 0.962, 0.997));
}

export function clonePreset(p: Preset): Preset {
  return {
    ...p, light: p.light.clone(), hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), fogSun: p.fogSun.clone(), volColor: p.volColor.clone(),
    glow: p.glow.clone(), disc: p.disc.clone(), halo: p.halo.clone(), cloudSun: p.cloudSun.clone(), cloudLit: p.cloudLit.clone(), far: p.far.clone(),
  };
}

export function lerpPreset(out: Preset, a: Preset, b: Preset, t: number): void {
  const L = (o: THREE.Color, x: THREE.Color, y: THREE.Color): void => { o.copy(x).lerp(y, t); };
  const n = (x: number, y: number): number => x + (y - x) * t;
  out.key = t < 0.5 ? a.key : b.key;
  out.bg = n(a.bg, b.bg); out.env = n(a.env, b.env);
  L(out.light, a.light, b.light); out.lightI = n(a.lightI, b.lightI);
  L(out.hemiSky, a.hemiSky, b.hemiSky); L(out.hemiGround, a.hemiGround, b.hemiGround); out.hemiI = n(a.hemiI, b.hemiI);
  L(out.fogSun, a.fogSun, b.fogSun); out.fogDist = n(a.fogDist, b.fogDist); out.fogHeight = n(a.fogHeight, b.fogHeight);
  out.vol = n(a.vol, b.vol); L(out.volColor, a.volColor, b.volColor); out.rays = n(a.rays, b.rays);
  L(out.glow, a.glow, b.glow); L(out.disc, a.disc, b.disc); L(out.halo, a.halo, b.halo); out.haloO = n(a.haloO, b.haloO);
  L(out.cloudSun, a.cloudSun, b.cloudSun); L(out.cloudLit, a.cloudLit, b.cloudLit); out.cloudA = n(a.cloudA, b.cloudA); L(out.far, a.far, b.far);
  out.lamps = n(a.lamps, b.lamps); out.sat = n(a.sat, b.sat);
}

const duskSun = new THREE.Vector3();
export function pineDuskAt(p: number): number { return Math.max(pineNightAt(p), 1 - THREE.MathUtils.smoothstep(pineSunAt(p, duskSun).y, 0.06, 0.35)); }
export function pineDawnAt(p: number): number { const d = Math.min(Math.abs(p - PINE_PHASES.sunrise), Math.abs(p - 1 - PINE_PHASES.sunrise)); return 1 - THREE.MathUtils.smoothstep(d, 0.01, 0.07); }
const PINE_BASE: DayCycleSpec<Preset> = {
  units: 'phase', start: PINE_PHASES.morning + 0.05, dayFraction: DAY,
  schedule: [{ phase: 'day', from: 6, to: 18, minutes: 20 }, { phase: 'night', from: 18, to: 30, minutes: 4 }],
  keys: { coordinate: 'phase', frames: KEYS, blend: lerpPreset }, sun: { path: pineSunAt, moon: pineMoonAt },
  fixed: FIXED_PHASE, presets: { dawn: PINE_PHASES.dawn, noon: PINE_PHASES.noon, dusk: PINE_PHASES.dusk, night: PINE_PHASES.night },
};

const lampClock = new DayCycle(PINE_BASE);
const lampScratch = clonePreset(P.day);

export const PINE_DAY: DayCycleSpec<Preset> = { ...PINE_BASE,
 curves: { night: pineNightAt, dusk: pineDuskAt, dawn: pineDawnAt, lamps: (p) => { lampClock.phase = p; lampClock.key(lampScratch); return Math.max(lampScratch.lamps, pineNightAt(p)); } },
};
