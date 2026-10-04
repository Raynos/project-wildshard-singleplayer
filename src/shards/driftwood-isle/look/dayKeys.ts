import type { OptionValue } from '@wildshard/engine/ui/Settings';
import type { DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import { MIDDAY_SKY, type SkyPalette } from './stylizedSky';
import * as THREE from 'three';

const DAY = 20 / 24;
/** the whole cycle in seconds (E147, the user: "72 minutes is too big … 48 is good"; it was 24 min, as BotW's) */

/** Settings ▸ Time of day's fixed picks → the phase they park the clock at (noon, the GOLDEN / SUNSET keys, mid-night) */
export const FIXED_PHASE: Record<Exclude<OptionValue<'time'>, 'live'>, number> = { midday: DAY / 2, golden: 0.74, sunset: DAY - 0.02, night: 0.92 };
const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

export interface Preset {
  sky: SkyPalette;
  sunColor: THREE.Color; sunI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  lift: THREE.Color; rim: THREE.Color; fogNear: THREE.Color; fogSun: THREE.Color;
  disc: THREE.Color; cloudShadow: number; dusk: number;
}

const hex = (h: number) => new THREE.Color(h);
const MIDDAY: Preset = {
  sky: MIDDAY_SKY,
  sunColor: c(1.0, 0.97, 0.9), sunI: 2.7,
  hemiSky: hex(0x7b90f4), hemiGround: hex(0xe8b890), hemiI: 1.15,
  lift: c(0.08, 0.05, 0.13), rim: c(1.3, 0.95, 0.6), fogNear: c(0.5, 0.6, 0.98), fogSun: c(1.0, 0.98, 0.92),
  disc: c(1.0, 0.95, 0.85), cloudShadow: 0.32, dusk: 0,
};
const GOLDEN: Preset = {
  sky: { zenith: c(0.06, 0.16, 0.6), horizon: c(1.0, 0.7, 0.45), below: c(0.35, 0.4, 0.55), sunGlow: c(1.0, 0.55, 0.22), cloudLit: c(1.45, 1.0, 0.7), cloudShade: c(0.52, 0.44, 0.78), night: 0 },
  sunColor: c(1.0, 0.72, 0.45), sunI: 2.5,
  hemiSky: hex(0x7a7ce0), hemiGround: hex(0xe0a070), hemiI: 0.85,
  lift: c(0.1, 0.03, 0.2), rim: c(1.6, 0.9, 0.45), fogNear: c(0.75, 0.6, 0.8), fogSun: c(1.0, 0.7, 0.42),
  disc: c(1.0, 0.75, 0.5), cloudShadow: 0.28, dusk: 0.7,
};
const SUNSET: Preset = {
  sky: { zenith: c(0.05, 0.08, 0.32), horizon: c(1.0, 0.45, 0.3), below: c(0.25, 0.22, 0.4), sunGlow: c(1.0, 0.4, 0.15), cloudLit: c(1.3, 0.62, 0.45), cloudShade: c(0.4, 0.3, 0.6), night: 0.1 },
  sunColor: c(1.0, 0.5, 0.3), sunI: 1.8,
  hemiSky: hex(0x5a5ab8), hemiGround: hex(0xb07060), hemiI: 0.75,
  lift: c(0.1, 0.03, 0.18), rim: c(1.6, 0.7, 0.35), fogNear: c(0.7, 0.45, 0.6), fogSun: c(1.0, 0.5, 0.3),
  disc: c(1.0, 0.55, 0.35), cloudShadow: 0.2, dusk: 0.9,
};
const NIGHT: Preset = {
  sky: { zenith: c(0.006, 0.014, 0.06), horizon: c(0.05, 0.1, 0.26), below: c(0.02, 0.05, 0.13), sunGlow: c(0.25, 0.32, 0.5), cloudLit: c(0.24, 0.3, 0.48), cloudShade: c(0.07, 0.09, 0.2), night: 1 },
  sunColor: c(0.55, 0.7, 1.0), sunI: 1.25,                        // moonlight: blue, bright enough to play by
  hemiSky: hex(0x3048a0), hemiGround: hex(0x243050), hemiI: 0.7,
  lift: c(0.02, 0.035, 0.1), rim: c(0.6, 0.8, 1.2), fogNear: c(0.08, 0.13, 0.3), fogSun: c(0.4, 0.5, 0.8),
  disc: c(0.85, 0.9, 1.0), cloudShadow: 0.25, dusk: 1,
};
const DAWN: Preset = {
  sky: { zenith: c(0.07, 0.14, 0.45), horizon: c(1.0, 0.62, 0.5), below: c(0.3, 0.32, 0.5), sunGlow: c(1.0, 0.6, 0.35), cloudLit: c(1.3, 0.9, 0.8), cloudShade: c(0.45, 0.42, 0.72), night: 0.05 },
  sunColor: c(1.0, 0.68, 0.5), sunI: 1.9,
  hemiSky: hex(0x6a78d0), hemiGround: hex(0xc09080), hemiI: 0.8,
  lift: c(0.09, 0.04, 0.2), rim: c(1.4, 0.85, 0.6), fogNear: c(0.7, 0.6, 0.85), fogSun: c(1.0, 0.68, 0.5),
  disc: c(1.0, 0.7, 0.55), cloudShadow: 0.35, dusk: 0.6,
};

/** keyframes over the phase (sorted; the table wraps: 1.0 = 0.0) */
const KEYS: [number, Preset][] = [
  [0.0, DAWN], [0.07, MIDDAY], [0.62, MIDDAY], [0.74, GOLDEN], [DAY - 0.02, SUNSET],
  [DAY + 0.03, NIGHT], [0.975, NIGHT], [1.0, DAWN],
];

export function lerpPreset(out: Preset, a: Preset, b: Preset, t: number): void {
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

export const clonePreset = (p: Preset): Preset => ({
  sky: { zenith: p.sky.zenith.clone(), horizon: p.sky.horizon.clone(), below: p.sky.below.clone(), sunGlow: p.sky.sunGlow.clone(), cloudLit: p.sky.cloudLit.clone(), cloudShade: p.sky.cloudShade.clone(), night: p.sky.night },
  sunColor: p.sunColor.clone(), sunI: p.sunI, hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), hemiI: p.hemiI,
  lift: p.lift.clone(), rim: p.rim.clone(), fogNear: p.fogNear.clone(), fogSun: p.fogSun.clone(), disc: p.disc.clone(),
  cloudShadow: p.cloudShadow, dusk: p.dusk,
});

const d2r = Math.PI / 180;
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}

export function driftwoodSunAt(p: number, out: THREE.Vector3): THREE.Vector3 {
    if (p < DAY) { const s = p / DAY; return dirFrom(90 + 180 * s, Math.sin(Math.PI * s) * 62, out); }
    const s = (p - DAY) / (1 - DAY); return dirFrom(270 + 180 * s, -Math.sin(Math.PI * s) * 40, out);
  }
export function driftwoodMoonAt(p: number, out: THREE.Vector3): THREE.Vector3 {
    const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
    return dirFrom(100 + 160 * s, 28 + Math.sin(Math.PI * s) * 30, out);
  }


export function driftwoodNightAt(p: number): number {
  if (p < DAY) return p > DAY - 0.03 ? THREE.MathUtils.smoothstep(p, DAY - 0.03, DAY) * 0.25 : 0;
  return THREE.MathUtils.smoothstep(p, DAY - 0.004, DAY + 0.03) * (1 - THREE.MathUtils.smoothstep(p, 0.975, 1));
}
const scratch = clonePreset(MIDDAY);
export const DRIFTWOOD_DAY: DayCycleSpec<Preset> = {
  units: 'phase', start: 0.2 * DAY, dayFraction: DAY,
  schedule: [{ phase: 'day', from: 6, to: 18, minutes: 40 }, { phase: 'night', from: 18, to: 30, minutes: 8 }],
  keys: { coordinate: 'phase', frames: KEYS, blend: lerpPreset }, sun: { path: driftwoodSunAt, moon: driftwoodMoonAt },
  fixed: FIXED_PHASE, presets: { dawn: 0.03, noon: 0.42, dusk: 0.8, night: 0.92 },
  curves: { night: driftwoodNightAt, dusk: (p) => { let i=0; while (i < KEYS.length-2 && (KEYS[i+1]?.[0] ?? 1) <= p) i++; const a=KEYS[i],b=KEYS[i+1]; if(a&&b) lerpPreset(scratch,a[1],b[1],THREE.MathUtils.smoothstep(p,a[0],b[0])); return scratch.dusk; }, dawn: () => 0, lamps: driftwoodNightAt },
};
