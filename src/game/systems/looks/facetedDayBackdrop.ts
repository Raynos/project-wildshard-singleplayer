/**
 * A faceted sky backdrop with its day / night clock, as a look-family system (SHARD-PLATFORM M3): no HDRI at all — the
 * faceted gradient dome + cumulus (`FacetedSky`) is the background, a PMREM of the dome is the environment (re-rendered as
 * the clock moves on), and the sun starts where the clock puts it. The clock (`facetedDay`'s row) turns the lights, the
 * fog, the toon light's tunables, the dome's palette, the disc and the planet's lit side from `bind` on; it steps its own
 * shadow light, so it runs after the cascades (`updateAt: 'late'`), and the planet keeps its opacity by night. Nothing here
 * knows a shard: the shard passes its day, its sky's GLSL rows, palette and seed, its light's tunables and its cycle.
 *
 *   ?tod=0.5    // start phase (default the row's start)
 *   ?clock=120  // cycle length in seconds (default the shard's)
 *   Settings ▸ Time of day: park the sun at a fixed phase, or 'live' to run the clock; ?tod / ?clock win
 *
 * Every frame it moves the sun and, at night, the moon, and blends the keyed presets into every knob the look reads: the
 * CSM light (direction in `shadowStepDeg` steps, colour, intensity — the same lights, never added or removed), the
 * hemisphere fill, the light's tunables, the fog colour / sun in-scatter, the dome + cumulus palette, the disc and the
 * planet's lit side. The light fades to nothing at the horizon, swaps sun ↔ moon while dark, and fades back.
 */
import * as THREE from 'three';
import { preloadBakedTextures, loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { SkyBackdropFactory } from '@wildshard/engine/render/look';
import { setting, type OptionValue } from '@wildshard/engine/ui/Settings';
import { DayCycle, type DayCycleClock } from '@wildshard/engine/world/dayCycle';
import { cloneFacetedDayPreset, type FacetedDay, type FacetedDayPreset } from './facetedDay';
import { FacetedSky, type FacetedSkyGlsl, type SkyPalette } from './facetedSky';

/** the light model's tunables the clock turns */
export interface FacetedDayLight {
  uToonLift: { value: THREE.Color }; uToonRim: { value: THREE.Color }; uFogZenith: { value: THREE.Color }; uFogNear: { value: THREE.Color };
  uCloudShadow: { value: number }; uToonNight: { value: number }; uCloudTime: { value: number };
}

/** what a faceted day backdrop is built from */
export interface FacetedDayBackdropSpec {
  /** the shard's name, for errors */
  readonly name: string;
  readonly day: FacetedDay;
  readonly sky: { readonly glsl: FacetedSkyGlsl; readonly palette: SkyPalette; readonly seed: number };
  readonly light: FacetedDayLight;
  /** the cycle's default length in seconds */
  readonly cycleSeconds: number;
}

/** the knobs the clock turns — the backdrop hands them over from the sky's targets */
interface DayNightTargets {
  sunDir: THREE.Vector3;
  lights: THREE.DirectionalLight[];
  lightDirection: THREE.Vector3;
  hemi: THREE.HemisphereLight;
  fog: THREE.Fog;
  fogSunDir: THREE.Vector3; fogSunColor: THREE.Color;
  toon: FacetedDayLight;
  setSkyPalette: (p: SkyPalette, sunDir: THREE.Vector3) => void;
  disc: THREE.Mesh;
  planetSun: THREE.Vector3; planetHaze: THREE.Color;
  refreshEnvironment: () => void;
  /** a shadow step is still fading in (Sky's ShadowFade): hold the next one */
  shadowBusy?: () => boolean;
}

class FacetedDayClock {
  /** 0..1 over the whole cycle */
  readonly clock: DayCycle<FacetedDayPreset>;
  get phase(): number { return this.clock.phase; }
  set phase(p: number) { this.clock.phase = p; }
  /** 0 = day … 1 = night */
  night = 0;
  /** 0 = broad day … 1 = golden hour / dusk / night */
  dusk = 0;
  /** seconds per cycle */
  get cycle(): number { return this.clock.cycle; }
  private cur: FacetedDayPreset;
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private envTimer = 0;
  private sunIScale = 1;
  private readonly shadowStep: number;
  private readonly haze: THREE.Color;
  private shadowWant = new THREE.Vector3();

  constructor(private readonly day: FacetedDay, private T: DayNightTargets, cycleSeconds: number, sunIntensityScale = 1) {
    const style = day.style;
    const frames = day.spec.keys?.frames ?? [];
    const second = frames[1]?.[1] ?? frames[0]?.[1];
    if (second === undefined) throw new Error('faceted day: keys missing');
    this.cur = cloneFacetedDayPreset(second);
    this.shadowStep = style.shadowStepDeg * (Math.PI / 180);
    this.haze = new THREE.Color(style.planetHaze[0], style.planetHaze[1], style.planetHaze[2]);
    const qs = new URLSearchParams(location.search);
    const tod = Number.parseFloat(qs.get('tod') ?? '');
    const clock = Number.parseFloat(qs.get('clock') ?? '');
    this.clock = new DayCycle({ ...day.spec, start: Number.isFinite(tod) ? ((tod % 1) + 1) % 1 : style.start });
    this.clock.cycle = Number.isFinite(clock) && clock > 1 ? clock : cycleSeconds;
    const time = setting('time'); // 'live' whenever ?tod / ?clock are in the URL
    if (time !== 'live') { this.clock.paused = true; this.phase = day.fixed[time]; }
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
    if (this.envTimer > this.day.style.envRefresh) { this.envTimer = 0; this.T.refreshEnvironment(); }
  }

  /** `snap`: move the shadow light to the exact phase now (boot, a Time of day pick), not in steps */
  private apply(snap = false): void {
    const p = this.phase, T = this.T, style = this.day.style, DAY = style.dayFraction, fadeRow = style.fade;
    // ── the preset blend ──
    this.clock.key(this.cur);
    const P = this.cur;
    // ── sun / moon ──
    this.clock.sunAt(this.sun);
    this.clock.moonAt(this.moon);
    const day = p < DAY;
    const lightDir = day ? this.sun : this.moon;
    const fade = day
      ? THREE.MathUtils.smoothstep(this.sun.y, fadeRow.sunY[0], fadeRow.sunY[1])                       // the sun fades out on the horizon
      : THREE.MathUtils.smoothstep(p, fadeRow.moonIn[0], fadeRow.moonIn[1]) * (1 - THREE.MathUtils.smoothstep(p, fadeRow.moonOut[0], fadeRow.moonOut[1]));
    this.night = this.day.nightAt(p);
    this.dusk = P.dusk;
    T.toon.uToonNight.value = this.night;
    T.sunDir.copy(lightDir);
    const want = this.shadowWant.copy(lightDir).negate();
    // the sun ↔ moon swap is one big step; a small one waits for the last one's fade
    if (snap || (want.angleTo(T.lightDirection) > this.shadowStep && !(T.shadowBusy?.() ?? false))) T.lightDirection.copy(want);
    for (const l of T.lights) { l.color.copy(P.sunColor); l.intensity = P.sunI * this.sunIScale * fade; }
    T.hemi.color.copy(P.hemiSky); T.hemi.groundColor.copy(P.hemiGround); T.hemi.intensity = P.hemiI;
    T.toon.uToonLift.value.copy(P.lift); T.toon.uToonRim.value.copy(P.rim); T.toon.uFogNear.value.copy(P.fogNear);
    T.toon.uFogZenith.value.copy(P.sky.zenith); T.toon.uCloudShadow.value = P.cloudShadow;
    T.fog.color.copy(P.sky.horizon);
    T.fogSunDir.copy(lightDir); T.fogSunColor.copy(P.fogSun);
    T.setSkyPalette(P.sky, day ? this.sun : this.moon);
    (T.disc.material as THREE.MeshBasicMaterial).color.copy(P.disc);
    T.disc.scale.setScalar(day ? 1 : style.moonDisc);
    T.planetSun.copy(this.sun);
    T.planetHaze.copy(P.sky.horizon).lerp(this.haze, style.planetHazeDay * (1 - this.night));
  }
}

/** A faceted sky backdrop and its day / night clock from the shard's day row, sky rows and light tunables. */
export function facetedDayBackdrop(spec: FacetedDayBackdropSpec): SkyBackdropFactory {
  const style = spec.day.style, envSize = style.envSize;
  /**
   * The GPU bytes of one of PMREM's cube-UV atlases at `envSize` (three's PMREMGenerator: 3·max(size, 112) × 4·size, RGBA
   * half float); `depth`: the environment target `fromScene` renders with a depth buffer (counted at 4 bytes a texel, its
   * widest format), the generator's ping-pong has none.
   */
  const envTargetBytes = (depth: boolean): number => {
    const texels = 3 * Math.max(envSize, 16 * 7) * 4 * envSize;
    return texels * 8 + (depth ? texels * 4 : 0);
  };
  const startSun = new THREE.Vector3(style.startSun[0], style.startSun[1], style.startSun[2]).normalize();
  return async ({ sky, scene, renderer, level }) => {
    const [, lut] = await Promise.all([preloadBakedTextures(), loadLUT(level.id)]);
    sky.sunDir.copy(startSun);
    const st = new FacetedSky(sky.sunDir, spec.sky.glsl, spec.sky.palette, spec.sky.seed).build();
    scene.add(st.dome);
    scene.background = null;
    // One owner for the environment (SF57): this backdrop holds its PMREM generator (whose ping-pong target is a second
    // cube-UV atlas) and the one live environment target, and frees both when it leaves. A grid region builds this backdrop
    // as a layer each time the shard is admitted (G223); without a dispose every visit left both behind.
    let pmrem: THREE.PMREMGenerator | null = null;
    let envRT: THREE.WebGLRenderTarget | null = null;
    let disposed = false;
    /** re-render the dome into the PMREM environment (the clock calls it when the sky has moved on; ~1 ms of GPU) */
    const refreshEnvironment = (): void => {
      if (disposed) return;
      pmrem ??= new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromScene(st.envScene, 0, 1, 3000, { size: envSize });
      envRT?.dispose();
      envRT = rt;
      scene.environment = rt.texture;
    };
    refreshEnvironment();
    scene.environmentIntensity = level.sky.envIntensity;
    spec.light.uFogZenith.value.copy(st.u.uZenith.value); // the colour-ramp fog fades into the dome's own gradient
    let clock: FacetedDayClock | null = null;
    return {
      get clock(): DayCycleClock {
        if (clock === null) throw new Error(`${spec.name}: the sky backdrop is not bound yet`);
        return clock.clock;
      },
      horizon: st.u.uHorizon.value.clone(),
      lut,
      clouds: st.dome, // Game.ts keeps `sky.clouds` on the camera: the dome and its cumulus ring
      updateAt: 'late',
      fadesPlanet: false,
      palette: { uHorizon: st.u.uHorizon, uCloudLit: st.u.uCloudLit, uSunGlow: st.u.uSunGlow, uSunDir: st.u.uSunDir, middayLit: spec.sky.palette.cloudLit },
      bind: (T) => {
        T.planet.uCrisp.value = 1; // a crisp, opaque disc against the faceted dome
        // the day / night clock turns every knob above from here on
        clock = new FacetedDayClock(spec.day, {
          sunDir: T.sunDir, lights: T.lights, lightDirection: T.lightDirection, hemi: T.hemi, fog: T.fog,
          fogSunDir: T.fogU.fogSunDir.value, fogSunColor: T.fogU.fogSunColor.value, toon: spec.light,
          setSkyPalette: (pal, dir) => { st.setPalette(pal); st.u.uSunDir.value.copy(dir); },
          disc: T.disc, planetSun: T.planet.uSunDir.value, planetHaze: T.planet.uHaze.value,
          refreshEnvironment, shadowBusy: T.shadowBusy,
        }, spec.cycleSeconds, level.sky.sunIntensity / style.sunIBase);
      },
      update: (dt) => { clock?.update(dt); st.update(dt); spec.light.uCloudTime.value += dt; },
      rebuild: () => { pmrem = null; envRT = null; refreshEnvironment(); }, // a fresh generator: the old one's targets belong to the lost context
      attachPost: () => undefined, // the clean chain: no post the clock turns
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (envRT !== null && scene.environment === envRT.texture) scene.environment = null;
        envRT?.dispose(); envRT = null;
        pmrem?.dispose(); pmrem = null; // its ping-pong target, blur and GGX passes
      },
      gpuBytes: () => (envRT === null ? 0 : envTargetBytes(true)) + (pmrem === null ? 0 : envTargetBytes(false)),
      // a refresh holds the new target beside the old one for a moment, with the generator's ping-pong
      gpuCeiling: () => 2 * envTargetBytes(true) + envTargetBytes(false),
    };
  };
}
