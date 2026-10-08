/**
 * A look as data (SHARD-PLATFORM SF10b): a gradient sky, the engine's distance fog, the key light and the ambient as
 * ordered day keys sampled on the engine clock, plus an optional 33³ colour LUT. The engine owns every program here:
 * the data carries colours and numbers only, never shader source or a closure.
 *
 *   const look = dataLook({ day: DATA_LOOK_DAY, dayOverride: null, keys, lut: null });   // a LookStrategy
 *
 * Keys sit on a normalised day (0 = midnight, 0.5 = noon) and wrap: between the last key and the first the look blends
 * across midnight. The sun's direction is the clock's; a key sets its colour and intensity only.
 */
import * as THREE from 'three';
import { LookupTexture } from 'postprocessing';
import { DayCycle } from '../world/dayCycle';
import type { LookStrategy, SkyBackdropTargets } from './look';
import { LUT_SIZE, fetchLut } from './lut';
import { PATCH_ORDER, patchShader, setInheritedPatch, type ShaderSource } from './shaderPatches';

type Rgb = readonly [number, number, number];
const mesh = (object: THREE.Object3D): object is THREE.Mesh => object instanceof THREE.Mesh;

/** One day key: what the sky, fog, key light and ambient look like at `time` (0–1 of a day). */
export interface LookKey {
  readonly time: number;
  /** the dome's colour straight up and at the horizon (the fog's colour should meet `horizon`) */
  readonly sky: { readonly zenith: Rgb; readonly horizon: Rgb };
  /** Exponential density per metre, or zero density plus linear near/far distances in metres. */
  readonly fog: { readonly colour: Rgb; readonly density: number; readonly near?: number | undefined; readonly far?: number | undefined };
  /** the key light's colour and intensity; its direction is the clock's sun */
  readonly sun: { readonly colour: Rgb; readonly intensity: number };
  /** the hemisphere ambient's sky and ground colours and intensity */
  readonly ambient: { readonly sky: Rgb; readonly ground: Rgb; readonly intensity: number };
}

/** The engine clock a data look runs on: real minutes per day, the start (0–1 of a day) and the sun's arc in degrees. */
export interface LookDay { readonly minutes: number; readonly start: number; readonly maxElevation: number; readonly azimuth: number }

/** The clock a data look gets when its data names none: a 12-minute day from noon, the sun 60° high at 35° azimuth. */
export const DATA_LOOK_DAY: LookDay = { minutes: 12, start: 0.5, maxElevation: 60, azimuth: 35 };

/** A data look: its clock, an optional fixed time of day, its ordered keys (at least one) and the LUT file's URL. */
export interface DataLookSpec {
  readonly day: LookDay;
  /** a fixed time of day (0–1): the clock starts there and is paused; null runs the clock from `day.start` */
  readonly dayOverride: number | null;
  readonly keys: readonly LookKey[];
  /** a 33³ × RGBA8 LUT (render/lut.ts format), applied last in the grade; null for none */
  readonly lut: string | Uint8Array | null;
}

/** A sampled look: plain numbers, blended between the two keys around a time of day. */
export interface LookSample {
  zenith: THREE.Color; horizon: THREE.Color; fog: THREE.Color; fogDensity: number; fogNear: number | null; fogFar: number | null;
  sun: THREE.Color; sunIntensity: number; ambientSky: THREE.Color; ambientGround: THREE.Color; ambientIntensity: number;
}

/** An empty sample to fill with `sampleLook`. */
export function lookSample(): LookSample {
  return { zenith: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(), fogDensity: 0, fogNear: null, fogFar: null, sun: new THREE.Color(), sunIntensity: 0,
    ambientSky: new THREE.Color(), ambientGround: new THREE.Color(), ambientIntensity: 0 };
}

const wrap = (t: number): number => t - Math.floor(t);
const mixRgb = (out: THREE.Color, a: Rgb, b: Rgb, f: number): THREE.Color => out.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);

/**
 * The look at `time` (0–1 of a day, wrapped) into `out`: a linear blend of the keys either side, wrapping across
 * midnight. Keys must be ordered by time and non-empty (the format's rules); colours blend in their stored space.
 */
export function sampleLook(keys: readonly LookKey[], time: number, out: LookSample = lookSample()): LookSample {
  const first = keys[0], last = keys[keys.length - 1];
  if (first === undefined || last === undefined) throw new Error('[look] a data look needs at least one key');
  const t = wrap(time);
  let a = last, b = first, span = 1 - last.time + first.time, along = t >= last.time ? t - last.time : t + 1 - last.time;
  for (let i = 0; i + 1 < keys.length; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (k0 !== undefined && k1 !== undefined && t >= k0.time && t < k1.time) { a = k0; b = k1; span = k1.time - k0.time; along = t - k0.time; break; }
  }
  const f = span > 1e-9 ? Math.min(1, Math.max(0, along / span)) : 0;
  mixRgb(out.zenith, a.sky.zenith, b.sky.zenith, f); mixRgb(out.horizon, a.sky.horizon, b.sky.horizon, f);
  mixRgb(out.fog, a.fog.colour, b.fog.colour, f); out.fogDensity = a.fog.density + (b.fog.density - a.fog.density) * f;
  out.fogNear = a.fog.near === undefined || b.fog.near === undefined ? null : a.fog.near + (b.fog.near - a.fog.near) * f;
  out.fogFar = a.fog.far === undefined || b.fog.far === undefined ? null : a.fog.far + (b.fog.far - a.fog.far) * f;
  mixRgb(out.sun, a.sun.colour, b.sun.colour, f); out.sunIntensity = a.sun.intensity + (b.sun.intensity - a.sun.intensity) * f;
  mixRgb(out.ambientSky, a.ambient.sky, b.ambient.sky, f); mixRgb(out.ambientGround, a.ambient.ground, b.ambient.ground, f);
  out.ambientIntensity = a.ambient.intensity + (b.ambient.intensity - a.ambient.intensity) * f;
  return out;
}

/** The engine clock for a data look (an hour clock with one day-long segment, the sun on the day's arc). */
export function dataLookClock(day: LookDay, dayOverride: number | null): DayCycle {
  const clock = new DayCycle({ units: 'hour', start: (dayOverride ?? day.start) * 24,
    schedule: [{ phase: 'day', from: 0, to: 24, minutes: day.minutes }], sun: { maxElevation: day.maxElevation, azimuthOffset: day.azimuth },
    fixed: { midday: 12, golden: 17, sunset: 18, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 18, night: 0 } });
  clock.paused = dayOverride !== null;
  return clock;
}

/** The engine's gradient dome: radius 600 m, drawn first, unfogged, kept on the camera by Game (the backdrop's `clouds`). */
function gradientDome(): { dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; zenith: THREE.Color; horizon: THREE.Color } {
  const zenith = new THREE.Color(), horizon = new THREE.Color();
  const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZenith: { value: zenith }, uHorizon: { value: horizon } },
    vertexShader: 'varying float vH; void main() { vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uZenith; uniform vec3 uHorizon; varying float vH; void main() { gl_FragColor = vec4(mix(uHorizon, uZenith, clamp(vH, 0.0, 1.0)), 1.0); }' });
  material.name = 'engine.look.dome';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), material);
  dome.name = 'look-dome'; dome.renderOrder = -1; dome.frustumCulled = false;
  return { dome, zenith, horizon };
}

async function lutTexture(url: string | Uint8Array | null): Promise<LookupTexture | null> {
  if (url === null) return null;
  const data = typeof url === 'string' ? await fetchLut(url) : Uint8Array.from(url);
  if (data === null) return null;
  if (data.length !== LUT_SIZE ** 3 * 4) throw new Error('Invalid admitted look LUT');
  const lut = new LookupTexture(data, LUT_SIZE);
  lut.type = THREE.UnsignedByteType; lut.colorSpace = THREE.NoColorSpace; lut.name = 'look-lut'; lut.needsUpdate = true;
  return lut;
}

/**
 * A level look from data: the engine's clean chain, the gradient dome, the engine fog, key light and ambient turned by
 * the keys on the engine clock, and the LUT last in the grade. Nothing is patched into another material.
 */
export function dataLook(spec: DataLookSpec): LookStrategy {
  if (spec.keys.length === 0) throw new Error('[look] a data look needs at least one key');
  const linear = spec.keys[0]?.fog.near !== undefined;
  const fog = { wsLookFogNear: new THREE.Uniform(0), wsLookFogFar: new THREE.Uniform(1), wsLookFogEnabled: new THREE.Uniform(0) };
  const patchFog = (shader: ShaderSource): void => {
    if (shader.uniforms['wsLookFogNear'] !== undefined) return;
    Object.assign(shader.uniforms, fog);
    const patched = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
      if (wsLookFogEnabled > 0.5) {
        float amount = clamp((length(vFogWorldPos - cameraPosition) - wsLookFogNear) / (wsLookFogFar - wsLookFogNear), 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, amount);
      } else {
        #include <fog_fragment>
      }
      #endif`);
    shader.fragmentShader = `#ifdef USE_FOG\nuniform float wsLookFogNear; uniform float wsLookFogFar; uniform float wsLookFogEnabled;\n#endif\n${patched}`;
  };
  const owned: { dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null; lut: LookupTexture | null } = { dome: null, lut: null };
  return {
    // the sky builds before the composer: the level scope takes the dome and the LUT here
    mode: 'extend', chain: 'clean', compose: ({ engineChain, scene, scope }) => {
      if (linear) {
        setInheritedPatch(patchFog, { scope, chain: true });
        const seen = new Set<THREE.Material>();
        scene.traverse((object) => {
          if (!mesh(object)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (seen.has(material)) continue;
            seen.add(material); patchShader(material, 'engine.look.linear-fog', PATCH_ORDER.decorate, patchFog, { scope });
          }
        });
      }
      const { dome, lut } = owned;
      if (dome !== null) { scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); }); }
      if (lut !== null) scope.own(lut);
      return { chain: engineChain('clean') };
    },
    sky: { clouds: false, planet: false },
    backdrop: async ({ sky }) => {
      const clock = dataLookClock(spec.day, spec.dayOverride), now = lookSample();
      const { dome, zenith, horizon } = gradientDome();
      owned.dome = dome;
      let targets: SkyBackdropTargets | null = null;
      const apply = (): void => {
        sampleLook(spec.keys, clock.hour / 24, now);
        zenith.copy(now.zenith); horizon.copy(now.horizon);
        sky.setKeyLight(clock.sunDir, now.sun, now.sunIntensity);
        if (targets === null) return;
        targets.hemi.color.copy(now.ambientSky); targets.hemi.groundColor.copy(now.ambientGround); targets.hemi.intensity = now.ambientIntensity;
        fog.wsLookFogEnabled.value = targets.underwater() ? 0 : Number(linear);
        if (targets.underwater()) return; // Atmosphere.ts owns the fog under water
        targets.fog.color.copy(now.fog);
        if (now.fogNear !== null && now.fogFar !== null) {
          targets.fog.near = now.fogNear; targets.fog.far = now.fogFar;
          fog.wsLookFogNear.value = now.fogNear; fog.wsLookFogFar.value = now.fogFar;
        }
        targets.fogU.fogDistDensity.value = now.fogDensity; targets.fogU.fogHeightDensity.value = 0;
        targets.fogU.fogSunColor.value.copy(now.sun);
      };
      sampleLook(spec.keys, clock.hour / 24, now);
      zenith.copy(now.zenith); horizon.copy(now.horizon);
      owned.lut = await lutTexture(spec.lut);
      return { clock, horizon: now.fog.clone(), lut: owned.lut, clouds: dome,
        bind: (t) => { targets = t; apply(); },
        update: (dt) => { clock.update(dt); apply(); },
        rebuild: () => undefined, attachPost: () => undefined };
    },
  };
}
