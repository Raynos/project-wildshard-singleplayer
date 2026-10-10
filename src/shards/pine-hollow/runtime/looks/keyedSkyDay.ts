import { DayCycle, type DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import * as THREE from 'three';
import type { KeyedSkyStyle, SkyColour, SkyPresetRow } from './keyedSkyRows';

/**
 * A keyed sky's day / night clock as data (SHARD-PLATFORM M3, look-family rows): the clock half of `keyedSky`, renderer-free
 * so a headless host steps the same clock the page draws. A shard declares its photographic sky keys, its keyed light
 * presets, the keyframes over the phase, its named phases and the sun's and moon's paths; this module turns the row into
 * the engine's `DayCycleSpec` (the presets blended between neighbouring keyframes), the sun / moon directions and the
 * night / dusk / dawn / lamp curves.
 *
 *   phase 0..1 over the cycle: [0, dayFraction) is the day (sunrise at 0, sunset at dayFraction), the rest the night
 *   the sun: an east → south → west arc by day (rise azimuth → set azimuth, `noonEl` up halfway), on round under the
 *            north by night (`nightDip` degrees down at the night's middle: its glow leads the dawn)
 *   the moon: up through the night, its azimuth and elevation rising over it
 */

/** One live preset: the row's colours as three.js colours. */
export interface SkyPreset {
  key: string;
  bg: number;
  env: number;
  light: THREE.Color; lightI: number;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  fogSun: THREE.Color; fogDist: number; fogHeight: number;
  vol: number; volColor: THREE.Color; rays: number;
  glow: THREE.Color; disc: THREE.Color; halo: THREE.Color; haloO: number;
  cloudSun: THREE.Color; cloudLit: THREE.Color; cloudA: number;
  far: THREE.Color;
  lamps: number;
  sat: number;
}

const colour = (c: SkyColour): THREE.Color => typeof c === 'number' ? new THREE.Color(c) : new THREE.Color(c[0], c[1], c[2]);

/** A row's live preset. */
export function skyPreset(r: SkyPresetRow): SkyPreset {
  return {
    key: r.key, bg: r.bg, env: r.env, light: colour(r.light), lightI: r.lightI, hemiSky: colour(r.hemiSky), hemiGround: colour(r.hemiGround), hemiI: r.hemiI,
    fogSun: colour(r.fogSun), fogDist: r.fogDist, fogHeight: r.fogHeight, vol: r.vol, volColor: colour(r.volColor), rays: r.rays,
    glow: colour(r.glow), disc: colour(r.disc), halo: colour(r.halo), haloO: r.haloO, cloudSun: colour(r.cloudSun), cloudLit: colour(r.cloudLit), cloudA: r.cloudA,
    far: colour(r.far), lamps: r.lamps, sat: r.sat,
  };
}

/** A preset's copy (its own colours). */
export function cloneSkyPreset(p: SkyPreset): SkyPreset {
  return {
    ...p, light: p.light.clone(), hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), fogSun: p.fogSun.clone(), volColor: p.volColor.clone(),
    glow: p.glow.clone(), disc: p.disc.clone(), halo: p.halo.clone(), cloudSun: p.cloudSun.clone(), cloudLit: p.cloudLit.clone(), far: p.far.clone(),
  };
}

/** `out` = a → b at t (the key switches at the midpoint). */
export function lerpSkyPreset(out: SkyPreset, a: SkyPreset, b: SkyPreset, t: number): void {
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

const d2r = Math.PI / 180;
/** compass azimuth (0 = north = +Z, 90 = east = −X) + elevation (deg) → unit vector toward the body */
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}

/** A keyed sky's clock: the engine spec, the bodies' paths and the curves. */
export interface KeyedSkyDay {
  readonly style: KeyedSkyStyle;
  /** the engine's clock spec (its curves included) */
  readonly spec: DayCycleSpec<SkyPreset>;
  /** the live presets by name, one object each (the keyframes share them) */
  readonly presets: Readonly<Record<string, SkyPreset>>;
  readonly sunAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  readonly moonAt: (p: number, out: THREE.Vector3) => THREE.Vector3;
  /** 0 at day … 1 at full night */
  readonly nightAt: (p: number) => number;
  readonly duskAt: (p: number) => number;
  readonly dawnAt: (p: number) => number;
  /** the night light body's fade at phase p (the moon's swap in and out) */
  readonly moonFadeAt: (p: number) => number;
}

/** The clock a keyed sky's row declares. */
export function keyedSkyDay(style: KeyedSkyStyle): KeyedSkyDay {
  const DAY = style.dayFraction;
  const { riseAz: RISE_AZ, setAz: SET_AZ, noonEl: NOON_EL, nightDip } = style.sun;
  const presets: Record<string, SkyPreset> = {};
  for (const [name, row] of Object.entries(style.presets)) presets[name] = skyPreset(row);
  const presetOf = (name: string): SkyPreset => {
    const p = presets[name];
    if (p === undefined) throw new Error(`keyed sky: no preset ${name}`);
    return p;
  };
  const frames: readonly (readonly [number, SkyPreset])[] = style.frames.map(([phase, name]) => [phase, presetOf(name)] as const);
  const sunAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    if (p < DAY) { const s = p / DAY; return dirFrom(RISE_AZ + (SET_AZ - RISE_AZ) * s, NOON_EL * Math.sin(Math.PI * s), out); }
    const s = (p - DAY) / (1 - DAY); return dirFrom(SET_AZ + (360 + RISE_AZ - SET_AZ) * s, -Math.sin(Math.PI * s) * nightDip, out);
  };
  const { az: MOON_AZ, azSpan: MOON_SPAN, el: MOON_EL, elRise: MOON_RISE } = style.moon;
  const moonAt = (p: number, out: THREE.Vector3): THREE.Vector3 => {
    const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
    return dirFrom(MOON_AZ + MOON_SPAN * s, MOON_EL + MOON_RISE * Math.sin(Math.PI * s), out);
  };
  const { rise, set } = style.night;
  const nightAt = (p: number): number => THREE.MathUtils.smoothstep(p, DAY + rise[0], DAY + rise[1]) * (1 - THREE.MathUtils.smoothstep(p, set[0], set[1]));
  const duskSun = new THREE.Vector3();
  const duskAt = (p: number): number => Math.max(nightAt(p), 1 - THREE.MathUtils.smoothstep(sunAt(p, duskSun).y, style.dusk[0], style.dusk[1]));
  const dawnAt = (p: number): number => {
    const d = Math.min(Math.abs(p - style.dawn.at), Math.abs(p - 1 - style.dawn.at));
    return 1 - THREE.MathUtils.smoothstep(d, style.dawn.width[0], style.dawn.width[1]);
  };
  const fadeIn = style.moonFade.rise, fadeOut = style.moonFade.set;
  const moonFadeAt = (p: number): number => THREE.MathUtils.smoothstep(p, DAY + fadeIn[0], DAY + fadeIn[1]) * (1 - THREE.MathUtils.smoothstep(p, fadeOut[0], fadeOut[1]));
  const base: DayCycleSpec<SkyPreset> = {
    units: 'phase', start: style.start, dayFraction: DAY, schedule: style.schedule,
    keys: { coordinate: 'phase', frames, blend: lerpSkyPreset }, sun: { path: sunAt, moon: moonAt },
    fixed: style.fixed, presets: style.lightPresets,
  };
  const first = frames[0];
  if (first === undefined) throw new Error('keyed sky: no keyframes');
  const lampClock = new DayCycle(base);
  const lampScratch = cloneSkyPreset(first[1]);
  const spec: DayCycleSpec<SkyPreset> = { ...base,
    curves: { night: nightAt, dusk: duskAt, dawn: dawnAt, lamps: (p) => { lampClock.phase = p; lampClock.key(lampScratch); return Math.max(lampScratch.lamps, nightAt(p)); } },
  };
  return { style, spec, presets, sunAt, moonAt, nightAt, duskAt, dawnAt, moonFadeAt };
}
