/**
 * The day / night clock of the low-poly shard (DRIFTWOOD-REMASTER L7, the user's pick D3: "a real clock — 20 min day +
 * 4 min night, night moonlit blue and playable"). Sky.ts builds it with the stylized sky and ticks it from `sky.update`.
 *
 *   sky.dayNight.phase      // 0..1 over the 24-minute cycle: [0, 20/24) is the day (sunrise → sunset), the rest the night
 *   sky.dayNight.night      // 0 = day … 1 = full night          → EnemyWorld.night, IslandAmbience.night
 *   sky.dayNight.dusk       // 0 = broad day … 1 = golden hour / night → Shrine.setDusk (glyphs, fireflies)
 *   ?tod=0.5                // start phase (default 0.2 of the day: mid-morning, the sun 36° up in the ESE)
 *   ?clock=120              // cycle length in seconds (default 1440 = 24 min) — for testing the whole loop quickly
 *   dayNight.setTime('golden')  // pause menu ▸ Settings ▸ Time of day (E55, `setting('time')`): park the sun at a fixed
 *                               // phase (midday / golden / sunset / night) or 'live' to run the clock; ?tod / ?clock win
 *
 * Every frame it moves the sun (an east → south → west arc, 62° at noon) and, at night, the moon (a high arc, ≥ 25°),
 * and blends a keyframed set of presets — dawn, morning, midday, golden hour, sunset, dusk, night — into every knob the
 * look reads: the CSM light (direction, colour, intensity — the same lights, never added or removed), the hemisphere
 * fill, the toon uniforms (shade lift, rim, fog ramp), the fog colour / sun in-scatter, the sky dome + cumulus palette,
 * the sun / moon disc and the planet's lit side. The light fades to nothing at the horizon, swaps sun ↔ moon while dark,
 * and fades back, so the direction never visibly jumps. The PMREM environment is re-rendered every 15 s.
 */
import * as THREE from 'three';
import { MIDDAY_SKY, type SkyPalette } from './StylizedSky';
import { setting, type OptionValue } from '../ui/Settings';

const DAY = 20 / 24;
/** Settings ▸ Time of day's fixed picks → the phase they park the clock at (noon, the GOLDEN / SUNSET keys, mid-night) */
const FIXED_PHASE: Record<Exclude<OptionValue<'time'>, 'live'>, number> = { midday: DAY / 2, golden: 0.74, sunset: DAY - 0.02, night: 0.92 };
const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

interface Preset {
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
  hemiSky: hex(0x7b90f4), hemiGround: hex(0xd8a878), hemiI: 0.9,
  lift: c(0.07, 0.035, 0.2), rim: c(1.3, 0.95, 0.6), fogNear: c(0.5, 0.6, 0.98), fogSun: c(1.0, 0.98, 0.92),
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

function lerpPreset(out: Preset, a: Preset, b: Preset, t: number): void {
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

const clonePreset = (p: Preset): Preset => ({
  sky: { zenith: p.sky.zenith.clone(), horizon: p.sky.horizon.clone(), below: p.sky.below.clone(), sunGlow: p.sky.sunGlow.clone(), cloudLit: p.sky.cloudLit.clone(), cloudShade: p.sky.cloudShade.clone(), night: p.sky.night },
  sunColor: p.sunColor.clone(), sunI: p.sunI, hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), hemiI: p.hemiI,
  lift: p.lift.clone(), rim: p.rim.clone(), fogNear: p.fogNear.clone(), fogSun: p.fogSun.clone(), disc: p.disc.clone(),
  cloudShadow: p.cloudShadow, dusk: p.dusk,
});

const d2r = Math.PI / 180;
/** compass azimuth (0 = north = +Z, 90 = east = −X) + elevation (deg) → unit vector toward the body */
function dirFrom(az: number, el: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(-Math.sin(az * d2r) * Math.cos(el * d2r), Math.sin(el * d2r), Math.cos(az * d2r) * Math.cos(el * d2r));
}

/** the knobs DayNight turns — Sky hands them over (no Sky import: Sky imports this) */
export interface DayNightTargets {
  sunDir: THREE.Vector3;
  lights: THREE.DirectionalLight[];
  lightDirection: THREE.Vector3;
  hemi: THREE.HemisphereLight;
  fog: THREE.Fog;
  fogSunDir: THREE.Vector3; fogSunColor: THREE.Color;
  toon: { uToonLift: { value: THREE.Color }; uToonRim: { value: THREE.Color }; uFogZenith: { value: THREE.Color }; uFogNear: { value: THREE.Color }; uCloudShadow: { value: number }; uToonNight: { value: number } };
  setSkyPalette: (p: SkyPalette, sunDir: THREE.Vector3) => void;
  disc: THREE.Mesh;
  planetSun: THREE.Vector3; planetHaze: THREE.Color;
  refreshEnvironment: () => void;
}

export class DayNight {
  /** 0..1 over the whole cycle */
  phase: number;
  /** 0 = day … 1 = night */
  night = 0;
  /** 0 = broad day … 1 = golden hour / dusk / night */
  dusk = 0;
  /** seconds per cycle */
  readonly cycle: number;
  private cur = clonePreset(MIDDAY);
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private envTimer = 0;
  private sunIScale = 1;
  /** a fixed Time of day: the phase does not advance */
  private frozen = false;

  constructor(private T: DayNightTargets, sunIntensityScale = 1) {
    const qs = new URLSearchParams(location.search);
    const tod = Number.parseFloat(qs.get('tod') ?? '');
    const clock = Number.parseFloat(qs.get('clock') ?? '');
    this.phase = Number.isFinite(tod) ? ((tod % 1) + 1) % 1 : 0.2 * DAY;
    this.cycle = Number.isFinite(clock) && clock > 1 ? clock : 24 * 60;
    const time = setting('time'); // 'live' whenever ?tod / ?clock are in the URL
    if (time !== 'live') { this.frozen = true; this.phase = FIXED_PHASE[time]; }
    this.sunIScale = sunIntensityScale;
    this.apply();
  }

  /** the sun's direction for the current phase (below the horizon at night) */
  private sunAt(p: number, out: THREE.Vector3): THREE.Vector3 {
    if (p < DAY) { const s = p / DAY; return dirFrom(90 + 180 * s, Math.sin(Math.PI * s) * 62, out); }
    const s = (p - DAY) / (1 - DAY); return dirFrom(270 + 180 * s, -Math.sin(Math.PI * s) * 40, out);
  }
  private moonAt(p: number, out: THREE.Vector3): THREE.Vector3 {
    const s = p < DAY ? 0 : (p - DAY) / (1 - DAY);
    return dirFrom(100 + 160 * s, 28 + Math.sin(Math.PI * s) * 30, out);
  }

  /** Settings ▸ Time of day (live): park the sun at a fixed pick, or run the clock on from where it stands */
  setTime(t: OptionValue<'time'>): void {
    this.frozen = t !== 'live';
    if (t === 'live') return;
    this.phase = FIXED_PHASE[t];
    this.apply();
    this.envTimer = 0; this.T.refreshEnvironment();
  }

  update(dt: number): void {
    if (!this.frozen) this.phase = (this.phase + dt / this.cycle) % 1;
    this.apply();
    this.envTimer += dt;
    if (this.envTimer > 15) { this.envTimer = 0; this.T.refreshEnvironment(); }
  }

  private apply(): void {
    const p = this.phase, T = this.T;
    // ── the preset blend ──
    let i = 0;
    while (i < KEYS.length - 2 && (KEYS[i + 1]?.[0] ?? 1) <= p) i++;
    const ka = KEYS[i], kb = KEYS[i + 1];
    if (!ka || !kb) return;
    const t = THREE.MathUtils.smoothstep(p, ka[0], kb[0]);
    lerpPreset(this.cur, ka[1], kb[1], t);
    const P = this.cur;
    // ── sun / moon ──
    this.sunAt(p, this.sun);
    this.moonAt(p, this.moon);
    const day = p < DAY;
    const lightDir = day ? this.sun : this.moon;
    const fade = day
      ? THREE.MathUtils.smoothstep(this.sun.y, 0.0, 0.08)                                  // the sun fades out on the horizon
      : THREE.MathUtils.smoothstep(p, DAY + 0.006, DAY + 0.03) * (1 - THREE.MathUtils.smoothstep(p, 0.985, 0.999));
    this.night = day ? 0 : THREE.MathUtils.smoothstep(p, DAY - 0.004, DAY + 0.03) * (1 - THREE.MathUtils.smoothstep(p, 0.975, 1.0));
    if (day && p > DAY - 0.03) this.night = THREE.MathUtils.smoothstep(p, DAY - 0.03, DAY) * 0.25;
    this.dusk = P.dusk;
    T.toon.uToonNight.value = this.night;
    T.sunDir.copy(lightDir);
    T.lightDirection.copy(lightDir).negate();
    for (const l of T.lights) { l.color.copy(P.sunColor); l.intensity = P.sunI * this.sunIScale * fade; }
    T.hemi.color.copy(P.hemiSky); T.hemi.groundColor.copy(P.hemiGround); T.hemi.intensity = P.hemiI;
    T.toon.uToonLift.value.copy(P.lift); T.toon.uToonRim.value.copy(P.rim); T.toon.uFogNear.value.copy(P.fogNear);
    T.toon.uFogZenith.value.copy(P.sky.zenith); T.toon.uCloudShadow.value = P.cloudShadow;
    T.fog.color.copy(P.sky.horizon);
    T.fogSunDir.copy(lightDir); T.fogSunColor.copy(P.fogSun);
    T.setSkyPalette(P.sky, day ? this.sun : this.moon);
    (T.disc.material as THREE.MeshBasicMaterial).color.copy(P.disc);
    T.disc.scale.setScalar(day ? 1 : 0.7);
    T.planetSun.copy(this.sun);
    T.planetHaze.copy(P.sky.horizon).lerp(c(0.55, 0.7, 0.95), 0.4 * (1 - this.night));
  }
}
