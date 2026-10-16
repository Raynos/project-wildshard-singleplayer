/**
 * A faceted sky backdrop with its day / night clock, as a look-family system (SHARD-PLATFORM M3): no HDRI at all — the
 * faceted gradient dome + cumulus (`FacetedSky`, the shard's material graphs) is the background, a PMREM of the dome is the environment (re-rendered as
 * the clock moves on), and the sun starts where the clock puts it. The clock (the shared day clock over the shard's row)
 * turns the lights, the fog and its colour ramp, the day light the toon looks follow, the dome's palette, the disc and the
 * planet's lit side from `bind` on; it steps its own shadow light, so it runs after the cascades (`updateAt: 'late'`), and
 * the planet keeps its opacity by night. Nothing here knows a shard: the shard passes its day, its sky's graph ids, palette
 * and cumulus rows, its day light, ramp fog and cycle. The SDK's graph day sky (`@wildshard/sdk/looks/graphDaySky`) owns the
 * graphs, the environment (its first PMREM built offscreen), the clock's jumps and the backdrop's lifecycle.
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
import type { SkyBackdropFactory, SkyBackdropTargets } from '@wildshard/engine/render/look';
import type { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { DayClock } from '@wildshard/sdk/looks/dayClock';
import { driveDayLight, runDayClock } from '@wildshard/sdk/looks/daySky';
import { graphDaySkyBackdrop } from '@wildshard/sdk/looks/graphDaySky';
import type { FACETED_DAY_PRESET } from '../const';
import type { FacetedDayPreset, FacetedDayStyle } from './rows';
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
    readonly looks: { readonly source: Parameters<typeof graphDaySkyBackdrop>[0]['source']; readonly dome: string; readonly clouds: string };
    readonly palette: SkyPalette; readonly puffs: readonly (readonly number[])[];
  };
  readonly light: FacetedDayLight;
  readonly fog: FacetedDayFog;
  /** the cycle's default length in seconds */
  readonly cycleSeconds: number;
}

/** The clock's frame: every knob the presets turn at the phase (from `bind` on); `snap` moves the shadow light at once. */
function facetedFrame(spec: FacetedDayBackdropSpec, sky: FacetedSky, clock: DayCycle<FacetedDayPreset>, sunIScale: number): (T: SkyBackdropTargets | null, snap: boolean) => void {
  const day = spec.day, style = day.style, { light, fog } = spec, sun = new THREE.Vector3(), moon = new THREE.Vector3();
  const frames = day.spec.keys?.frames ?? [], second = frames[1]?.[1] ?? frames[0]?.[1];
  if (second === undefined) throw new Error('faceted day: keys missing');
  const P = day.clone(second), shadowStep = style.shadowStepDeg * (Math.PI / 180);
  const haze = new THREE.Color(style.planetHaze[0], style.planetHaze[1], style.planetHaze[2]);
  return (T, snap) => {
    if (T === null) return;
    const p = clock.phase;
    clock.key(P);
    clock.sunAt(sun); clock.moonAt(moon);
    const isDay = p < style.dayFraction, night = day.nightAt(p);
    light.uToonNight.value = night;
    driveDayLight(T, day, p, sun, moon, P, sunIScale, shadowStep, snap, T.shadowBusy);
    light.uToonLift.value.copy(P.lift); light.uToonRim.value.copy(P.rim); light.uCloudShadow.value = P.cloudShadow;
    fog.near.value.copy(P.fogNear); fog.zenith.value.copy(P.sky.zenith);
    T.fog.color.copy(P.sky.horizon);
    T.fogU.fogSunColor.value.copy(P.fogSun);
    sky.setPalette(P.sky, isDay ? sun : moon);
    (T.disc.material as THREE.MeshBasicMaterial).color.copy(P.disc);
    T.disc.scale.setScalar(isDay ? 1 : style.moonDisc);
    T.planet.uSunDir.value.copy(sun);
    T.planet.uHaze.value.copy(P.sky.horizon).lerp(haze, style.planetHazeDay * (1 - night));
  };
}

/** A faceted sky backdrop and its day / night clock from the shard's day row, sky rows and light tunables. */
export function facetedDayBackdrop(spec: FacetedDayBackdropSpec): SkyBackdropFactory {
  const style = spec.day.style, ids = spec.sky.looks;
  const startSun = new THREE.Vector3(style.startSun[0], style.startSun[1], style.startSun[2]).normalize();
  return graphDaySkyBackdrop({ name: spec.name, source: ids.source, ids: [ids.dome, ids.clouds], build: (context, g) => {
    const { sky, scene, level } = context;
    sky.sunDir.copy(startSun);
    const st = new FacetedSky(sky.sunDir, spec.sky.palette, spec.sky.puffs).build({ dome: g.material(ids.dome), clouds: g.material(ids.clouds),
      setParam: (part, name, value) => { g.setParam(part === 'dome' ? ids.dome : ids.clouds, name, value); } });
    scene.environmentIntensity = level.sky.envIntensity;
    spec.fog.zenith.value.copy(st.u.uZenith.value); // the colour-ramp fog fades into the dome's own gradient
    const clock = runDayClock(spec.day, spec.cycleSeconds), frame = facetedFrame(spec, st, clock, level.sky.sunIntensity / style.sunIBase);
    return Promise.resolve({
      clock, dome: st.dome, follow: false, horizon: st.u.uHorizon.value.clone(),
      // one owner for the environment (SF57): a grid region builds this backdrop as a layer each time it is admitted (G223)
      environment: { source: { kind: 'scene', scene: st.envScene, size: style.envSize, near: 1, far: 3000 }, refresh: { every: style.envRefresh, stepped: false }, offscreenFirst: true },
      drive: (T, _post, snap) => { frame(T, snap); }, // the clean chain: no post the clock turns
      tick: (dt) => { spec.light.uCloudTime.value += dt; },
      bound: (T) => { T.planet.uCrisp.value = 1; }, // a crisp, opaque disc against the faceted dome
      backdrop: { updateAt: 'late', fadesPlanet: false,
        palette: { uHorizon: st.u.uHorizon, uCloudLit: st.u.uCloudLit, uSunGlow: st.u.uSunGlow, uSunDir: st.u.uSunDir, middayLit: spec.sky.palette.cloudLit } },
    });
  } });
}
