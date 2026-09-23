/**
 * The WebGL path's shared uniform objects (`{ value }`), exposed as TSL uniform nodes that read them every render.
 *
 *   const u = gpuUniforms();       // one set per page, built on first use
 *   u.toon.uToonLift               // → UniformNode<'color'> reading toonUniforms.uToonLift.value
 *
 * DayNight, Sky and the underwater fog keep writing `toonUniforms` / `fogUniforms` (src/world/stylize.ts,
 * src/world/Atmosphere.ts) exactly as before; the TSL materials see the same values with no second source of truth.
 */
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { toonUniforms } from '../world/stylize';
import { fogUniforms } from '../world/Atmosphere';

/** three's TSL helpers that come back untyped (agxToneMapping, BRDF_GGX, BRDF_Lambert …) as the vec3 they are */
export function asVec3(n: Node): Node<'vec3'> { return n as Node<'vec3'>; }
export function asVec4(n: Node): Node<'vec4'> { return n as Node<'vec4'>; }
export function asFloat(n: Node): Node<'float'> { return n as Node<'float'>; }

export type FloatU = UniformNode<'float', number>;
export type ColorU = UniformNode<'color', THREE.Color>;
export type Vec3U = UniformNode<'vec3', THREE.Vector3>;
export type Vec2U = UniformNode<'vec2', THREE.Vector2>;

/** a float uniform that re-reads `ref.value` before every render */
export function liveFloat(ref: { value: number }): FloatU { return uniform(ref.value).onRenderUpdate(() => ref.value); }
/** a colour uniform that re-reads `ref.value` (copied, so a replaced Color object is followed too) */
export function liveColor(ref: { value: THREE.Color }): ColorU { return uniform(new THREE.Color().copy(ref.value)).onRenderUpdate((_f, self) => self.value.copy(ref.value)); }
export function liveVec3(ref: { value: THREE.Vector3 }): Vec3U { return uniform(new THREE.Vector3().copy(ref.value)).onRenderUpdate((_f, self) => self.value.copy(ref.value)); }
export function liveVec2(ref: { value: THREE.Vector2 }): Vec2U { return uniform(new THREE.Vector2().copy(ref.value)).onRenderUpdate((_f, self) => self.value.copy(ref.value)); }

function build() {
  const t = toonUniforms, f = fogUniforms;
  return {
    toon: {
      uToonLift: liveColor(t.uToonLift), uToonRim: liveColor(t.uToonRim), uToonTerm: liveColor(t.uToonTerm),
      uToonShadeGrade: liveFloat(t.uToonShadeGrade), uCloudShadow: liveFloat(t.uCloudShadow), uToonNight: liveFloat(t.uToonNight),
      uSeaLevel: liveFloat(t.uSeaLevel), uCaustics: liveFloat(t.uCaustics), uCloudTime: liveFloat(t.uCloudTime),
      uCloudWind: liveVec2(t.uCloudWind), uCloudScale: liveFloat(t.uCloudScale),
      uFogZenith: liveColor(t.uFogZenith), uFogNear: liveColor(t.uFogNear), uFogStart: liveFloat(t.uFogStart), uFogEnd: liveFloat(t.uFogEnd),
    },
    fog: {
      fogSunDir: liveVec3(f.fogSunDir), fogSunColor: liveColor(f.fogSunColor), fogHeight: liveFloat(f.fogHeight),
      fogHeightFalloff: liveFloat(f.fogHeightFalloff), fogHeightDensity: liveFloat(f.fogHeightDensity), fogDistDensity: liveFloat(f.fogDistDensity),
    },
  };
}

export type GpuUniforms = ReturnType<typeof build>;
let shared: GpuUniforms | null = null;
export function gpuUniforms(): GpuUniforms { shared ??= build(); return shared; }
