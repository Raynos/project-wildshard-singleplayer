import { type SkyPalette, DayCycle, setting, type OptionValue } from '#engine';
/**
 * The day / night clock of the low-poly shard (DRIFTWOOD-REMASTER L7, the user's pick D3: "a real clock — 20 min day +
 * 4 min night, night moonlit blue and playable"; E147: "48 is good" — both doubled, a 40 min day + 8 min night). Sky.ts
 * builds it with the stylized sky and ticks it from `sky.update`.
 *
 *   sky.dayNight.phase      // 0..1 over the 48-minute cycle: [0, 20/24) is the day (sunrise → sunset), the rest the night
 *   sky.dayNight.night      // 0 = day … 1 = full night          → EnemyWorld.night, IslandAmbience.night
 *   sky.dayNight.dusk       // 0 = broad day … 1 = golden hour / night → Shrine.setDusk (glyphs, fireflies)
 *   ?tod=0.5                // start phase (default 0.2 of the day: mid-morning, the sun 36° up in the ESE)
 *   ?clock=120              // cycle length in seconds (default 2880 = 48 min) — for testing the whole loop quickly
 *   dayNight.setTime('golden')  // pause menu ▸ Settings ▸ Time of day (E55, `setting('time')`): park the sun at a fixed
 *                               // phase (midday / golden / sunset / night) or 'live' to run the clock; ?tod / ?clock win
 *
 * Every frame it moves the sun (an east → south → west arc, 62° at noon) and, at night, the moon (a high arc, ≥ 25°),
 * and blends a keyframed set of presets — dawn, morning, midday, golden hour, sunset, dusk, night — into every knob the
 * look reads: the CSM light (direction in SHADOW_STEP steps, colour, intensity — the same lights, never added or
 * removed), the hemisphere fill, the toon uniforms (shade lift, rim, fog ramp), the fog colour / sun in-scatter, the
 * sky dome + cumulus palette, the sun / moon disc and the planet's lit side. The light fades to nothing at the horizon,
 * swaps sun ↔ moon while dark, and fades back, so the direction never visibly jumps. The PMREM environment is re-rendered every 15 s.
 */
import * as THREE from 'three';
import { DRIFTWOOD_DAY, FIXED_PHASE, clonePreset, type Preset } from './dayKeys';

const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);


const DAY = 20 / 24;
const CYCLE_S = 48 * 60;
const d2r = Math.PI / 180;
/**
 * The shadow-casting light turns in steps of this, not every frame (E89). A shadow map that turns a hair each frame
 * re-rasterizes every shadow edge every frame: a post's or a palm's shadow crawls and flickers even with the camera still
 * (E89 on the old 1024² map: 0.40 % of the frame changed per frame; E147 on the 2c2k rig: 0.46 % against 0.079 %
 * stepped). Held still, the texel-snapped map is stable. A step moves the pier pennant's shadow ~3 cm, several of the
 * phone rig's 0.8 cm near texels, so each step now crossfades in over ~2 s (Sky's ShadowFade, shadowFade.ts) instead of
 * popping; the sun moves ~0.075°/s on the 48-minute day, a step every ~3–4 s.
 */
const SHADOW_STEP = 0.25 * d2r;
/** compass azimuth (0 = north = +Z, 90 = east = −X) + elevation (deg) → unit vector toward the body */
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
  /** E147: a shadow step is still fading in (Sky's ShadowFade): hold the next one */
  shadowBusy?: () => boolean;
}

export class DriftwoodSky {
  /** 0..1 over the whole cycle */
  readonly clock: DayCycle<Preset>;
  get phase(): number { return this.clock.phase; }
  set phase(p: number) { this.clock.phase = p; }
  /** 0 = day … 1 = night */
  night = 0;
  /** 0 = broad day … 1 = golden hour / dusk / night */
  dusk = 0;
  /** seconds per cycle */
  get cycle(): number { return this.clock.cycle; }
  private cur = clonePreset(DRIFTWOOD_DAY.keys?.frames[1]?.[1] ?? DRIFTWOOD_DAY.keys?.frames[0]?.[1] ?? (() => { throw new Error("Driftwood keys missing"); })());
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private envTimer = 0;
  private sunIScale = 1;
  /** a fixed Time of day: the phase does not advance */

  constructor(private T: DayNightTargets, sunIntensityScale = 1) {
    const qs = new URLSearchParams(location.search);
    const tod = Number.parseFloat(qs.get('tod') ?? '');
    const clock = Number.parseFloat(qs.get('clock') ?? '');
    this.clock = new DayCycle({ ...DRIFTWOOD_DAY, start: Number.isFinite(tod) ? ((tod % 1) + 1) % 1 : 0.2 * DAY });
    this.clock.cycle = Number.isFinite(clock) && clock > 1 ? clock : CYCLE_S;
    const time = setting('time'); // 'live' whenever ?tod / ?clock are in the URL
    if (time !== 'live') { this.clock.paused = true; this.phase = FIXED_PHASE[time]; }
    this.clock.onSet = () => { this.apply(true); this.envTimer = 0; this.T.refreshEnvironment(); return Promise.resolve(); };
    this.sunIScale = sunIntensityScale;
    this.apply(true);
  }

  /** Settings ▸ Time of day (live): park the sun at a fixed pick, or run the clock on from where it stands */
  setTime(t: OptionValue<'time'>): void {
    this.clock.setTime(t);
  }

  update(dt: number): void {
    this.clock.update(dt);
    this.apply();
    this.envTimer += dt;
    if (this.envTimer > 15) { this.envTimer = 0; this.T.refreshEnvironment(); }
  }

  private shadowWant = new THREE.Vector3();

  /** `snap`: move the shadow light to the exact phase now (boot, a Time of day pick), not in SHADOW_STEP steps */
  private apply(snap = false): void {
    const p = this.phase, T = this.T;
    // ── the preset blend ──
    this.clock.key(this.cur);
    const P = this.cur;
    // ── sun / moon ──
    this.clock.sunAt(this.sun);
    this.clock.moonAt(this.moon);
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
    const want = this.shadowWant.copy(lightDir).negate();
    // the sun ↔ moon swap is one big step; a small one waits for the last one's fade (E147)
    if (snap || (want.angleTo(T.lightDirection) > SHADOW_STEP && !(T.shadowBusy?.() ?? false))) T.lightDirection.copy(want);
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
