/**
 * A faceted sky backdrop with its day / night clock, as a look-family system (SHARD-PLATFORM M3): no HDRI at all — the
 * faceted gradient dome + cumulus (`FacetedSky`, the shard's material graphs) is the background, a PMREM of the dome is the environment (re-rendered as
 * the clock moves on), and the sun starts where the clock puts it. The clock (the shared day clock over the shard's row)
 * turns the lights, the fog and its colour ramp, the day light the toon looks follow, the dome's palette, the disc and the
 * planet's lit side from `bind` on; it steps its own shadow light, so it runs after the cascades (`updateAt: 'late'`), and
 * the planet keeps its opacity by night. Nothing here knows a shard: the shard passes its day, its sky's graph ids, palette
 * and cumulus rows, its day light, ramp fog and cycle.
 *
 *   ?tod=0.5    // start phase (default the row's start)
 *   ?clock=120  // cycle length in seconds (default the shard's)
 *   Settings ▸ Time of day: park the sun at a fixed phase, or 'live' to run the clock; ?tod / ?clock win
 *
 * Every frame it moves the sun and, at night, the moon, and blends the keyed presets into every knob the look reads: the
 * CSM light (`driveDayLight`: direction in `shadowStepDeg` steps, colour, intensity, the hemisphere fill), the day light,
 * the fog colour / sun in-scatter and ramp, the dome + cumulus palette, the disc and the planet's lit side. The light fades
 * to nothing at the horizon, swaps sun ↔ moon while dark, and fades back.
 */
import * as THREE from 'three';
import { prepareOffscreenBuild } from '@wildshard/engine/render/offscreenBuild';
import { SkyEnvironment, type SkyEnvironmentSource } from '@wildshard/engine/render/skyEnvironment';
import { resourceScope } from '@wildshard/engine/app/resources';
import { preloadBakedTextures, loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { SkyBackdropFactory, SkyBackdropTargets } from '@wildshard/engine/render/look';
import type { DayCycle, DayCycleClock } from '@wildshard/engine/world/dayCycle';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import type { DayClock } from '@wildshard/sdk/looks/dayClock';
import { driveDayLight, runDayClock } from '@wildshard/sdk/looks/daySky';
import type { FACETED_DAY_PRESET, FacetedDayPreset, FacetedDayStyle } from '../../data/facetedDayRows';
import { FacetedSky, type SkyPalette } from './facetedSky';

/** a faceted day: the shared day clock over the shard's row */
export type FacetedDay = DayClock<typeof FACETED_DAY_PRESET, FacetedDayStyle>;

/** the day light the clock turns (linear colours), which the shard's toon looks follow */
export interface FacetedDayLight {
  uToonLift: { value: THREE.Color }; uToonRim: { value: THREE.Color };
  uCloudShadow: { value: number }; uToonNight: { value: number }; uCloudTime: { value: number };
}

/** the colour-ramp fog's colours the clock turns (the engine's `ColourRampFog`) */
export interface FacetedDayFog { readonly near: { value: THREE.Color }; readonly zenith: { value: THREE.Color } }

/** what a faceted day backdrop is built from */
export interface FacetedDayBackdropSpec {
  /** the shard's name, for errors */
  readonly name: string;
  readonly day: FacetedDay;
  readonly sky: {
    /** the shard's declaration and the look.materials ids of the dome's and the cumulus's graphs */
    readonly looks: { readonly source: Parameters<typeof lookGraphMaterials>[2]; readonly dome: string; readonly clouds: string };
    readonly palette: SkyPalette; readonly puffs: readonly (readonly number[])[];
  };
  readonly light: FacetedDayLight;
  readonly fog: FacetedDayFog;
  /** the cycle's default length in seconds */
  readonly cycleSeconds: number;
}

/** what the clock turns beyond the scene's targets: the day light, the ramp fog, the dome's palette, the environment */
interface FacetedDayParts { readonly spec: FacetedDayBackdropSpec; readonly sky: FacetedSky; readonly env: SkyEnvironment }

class FacetedDayClock {
  /** 0..1 over the whole cycle */
  readonly clock: DayCycle<FacetedDayPreset>;
  /** 0 = day … 1 = night */
  night = 0;
  private readonly day: FacetedDay;
  private readonly T: SkyBackdropTargets;
  private readonly parts: FacetedDayParts;
  private readonly cur: FacetedDayPreset;
  private readonly sun = new THREE.Vector3();
  private readonly moon = new THREE.Vector3();
  private readonly sunIScale: number;
  private readonly shadowStep: number;
  private readonly haze: THREE.Color;

  constructor(T: SkyBackdropTargets, parts: FacetedDayParts, sunIntensityScale: number) {
    const day = parts.spec.day, style = day.style;
    this.day = day; this.T = T; this.parts = parts; this.sunIScale = sunIntensityScale;
    const frames = day.spec.keys?.frames ?? [];
    const second = frames[1]?.[1] ?? frames[0]?.[1];
    if (second === undefined) throw new Error('faceted day: keys missing');
    this.cur = day.clone(second);
    this.shadowStep = style.shadowStepDeg * (Math.PI / 180);
    this.haze = new THREE.Color(style.planetHaze[0], style.planetHaze[1], style.planetHaze[2]);
    this.clock = runDayClock(day, parts.spec.cycleSeconds);
    this.clock.onSet = () => { this.apply(true); this.parts.env.refresh(); return Promise.resolve(); };
    this.apply(true);
  }

  update(dt: number): void {
    this.clock.update(dt);
    this.apply();
    this.parts.env.update(dt);
  }

  /** `snap`: move the shadow light to the exact phase now (boot, a Time of day pick), not in steps */
  private apply(snap = false): void {
    const p = this.clock.phase, T = this.T, style = this.day.style, { light, fog } = this.parts.spec;
    // ── the preset blend ──
    this.clock.key(this.cur);
    const P = this.cur;
    // ── sun / moon ──
    this.clock.sunAt(this.sun);
    this.clock.moonAt(this.moon);
    const day = p < style.dayFraction;
    this.night = this.day.nightAt(p);
    light.uToonNight.value = this.night;
    driveDayLight(T, this.day, p, this.sun, this.moon, P, this.sunIScale, this.shadowStep, snap, T.shadowBusy);
    light.uToonLift.value.copy(P.lift); light.uToonRim.value.copy(P.rim); light.uCloudShadow.value = P.cloudShadow;
    fog.near.value.copy(P.fogNear); fog.zenith.value.copy(P.sky.zenith);
    T.fog.color.copy(P.sky.horizon);
    T.fogU.fogSunColor.value.copy(P.fogSun);
    this.parts.sky.setPalette(P.sky, day ? this.sun : this.moon);
    (T.disc.material as THREE.MeshBasicMaterial).color.copy(P.disc);
    T.disc.scale.setScalar(day ? 1 : style.moonDisc);
    T.planet.uSunDir.value.copy(this.sun);
    T.planet.uHaze.value.copy(P.sky.horizon).lerp(this.haze, style.planetHazeDay * (1 - this.night));
  }
}

/** A faceted sky backdrop and its day / night clock from the shard's day row, sky rows and light tunables. */
export function facetedDayBackdrop(spec: FacetedDayBackdropSpec): SkyBackdropFactory {
  const style = spec.day.style, envSize = style.envSize;
  const startSun = new THREE.Vector3(style.startSun[0], style.startSun[1], style.startSun[2]).normalize();
  return async (context) => {
    const { sky, scene, renderer, level } = context;
    const owner = resourceScope();
    // the sky's graphs compile here from the look catalogue, on the page renderer, before the world stage: the dome is drawn
    // (and PMREM'd) from the first frame, and a grid layer gets the same materials to blend; they leave with this owner
    const ids = spec.sky.looks;
    const [, lut, looks] = await Promise.all([preloadBakedTextures(), loadLUT(level.id), lookGraphMaterials(owner, context, ids.source, [ids.dome, ids.clouds])]);
    const material = (id: string): THREE.Material => {
      const found = looks.materials.get(id);
      if (found === undefined) throw new Error(`${spec.name}: look.materials lacks the sky graph ${id}`);
      return found;
    };
    sky.sunDir.copy(startSun);
    const st = new FacetedSky(sky.sunDir, spec.sky.palette, spec.sky.puffs).build({ dome: material(ids.dome), clouds: material(ids.clouds),
      setParam: (part, name, value) => { looks.setParam(part === 'dome' ? ids.dome : ids.clouds, name, value); } });
    scene.add(st.dome);
    scene.background = null;
    const envSource: SkyEnvironmentSource = { kind: 'scene', scene: st.envScene, size: envSize, near: 1, far: 3000 };
    // One owner for the environment (SF57): this backdrop holds its PMREM generator (whose ping-pong target is a second
    // cube-UV atlas) and the one live environment target, and frees both when it leaves. A grid region builds this backdrop
    // as a layer each time the shard is admitted (G223); without a dispose every visit left both behind.
    const env = new SkyEnvironment(renderer, scene, envSource, { every: style.envRefresh, stepped: false });
    const prepared: { generator: THREE.PMREMGenerator | null } = { generator: null };
    try {
      const first = await prepareOffscreenBuild(renderer, commands => {
        prepared.generator = new THREE.PMREMGenerator(commands);
        return prepared.generator.fromScene(st.envScene, 0, 1, 3000, { size: envSize });
      }, () => !owner.disposed, { webKitOnly: true });
      env.adopt(prepared.generator, first);
    } catch (error) { prepared.generator?.dispose(); throw error; }
    scene.environmentIntensity = level.sky.envIntensity;
    spec.fog.zenith.value.copy(st.u.uZenith.value); // the colour-ramp fog fades into the dome's own gradient
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
        clock = new FacetedDayClock(T, { spec, sky: st, env }, level.sky.sunIntensity / style.sunIBase);
      },
      update: (dt) => { clock?.update(dt); spec.light.uCloudTime.value += dt; },
      rebuild: () => { env.rebuild(); env.refresh(); }, // a fresh generator: the old one's targets belong to the lost context
      attachPost: () => undefined, // the clean chain: no post the clock turns
      dispose: () => { env.dispose(); }, // its target, its generator's ping-pong target, blur and GGX passes
      gpuBytes: () => env.bytes(),
      gpuCeiling: () => env.ceiling(),
    };
  };
}
