import { Rng } from '@wildshard/engine/core/rng';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import * as THREE from 'three';

export interface RainProgram { vertexShader: string; fragmentShader: string }
export interface RainCurtainSpec {
  count: number; seed: number;
  /** The covered program receives a cover texture and cave bounds here; open rain receives neither. */
  uniforms: Record<string, THREE.IUniform>;
  program: RainProgram;
}

/**
 * The curtain's streak quads, unposed: per vertex its corner in `position` (x −1 / 1 across, y 0 tail / 1 head, z 0) and
 * its drop's seed in `seedName` (xyz its spot in the box round the eye, 0..1; w its speed, 0.85..1.2), shared by the 4
 * corners. A program (or a material graph, `seedName` `aSeed`) builds each streak from them in its vertex stage.
 */
export function rainCurtainGeometry(count: number, seed: number, seedName = 'seed'): THREE.BufferGeometry {
  const n = count, rng = new Rng(seed ^ 0x2a1);
  const seeds = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 3), idx = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const sx = rng.next(), sy = rng.next(), sz = rng.next(), sp = rng.range(0.85, 1.2);
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      seeds[v * 4] = sx; seeds[v * 4 + 1] = sy; seeds[v * 4 + 2] = sz; seeds[v * 4 + 3] = sp;
      corner[v * 3] = k & 1 ? 1 : -1; corner[v * 3 + 1] = k < 2 ? 0 : 1;
    }
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(corner, 3));
  geo.setAttribute(seedName, new THREE.BufferAttribute(seeds, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geo;
}

/** Camera-local, world-anchored streak quads. Both authored programs retain their exact source. */
export function rainCurtain(spec: RainCurtainSpec): THREE.Mesh {
  const geo = rainCurtainGeometry(spec.count, spec.seed), p = geo.getAttribute('position'), corner = new Float32Array(p.count * 2);
  for (let v = 0; v < p.count; v++) { corner[v * 2] = p.getX(v); corner[v * 2 + 1] = p.getY(v); }
  geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...spec.uniforms };
  attachFogUniforms({ uniforms });
  const mat = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, ...spec.program });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.visible = false; mesh.name = 'rain';
  return mesh;
}

/** A curtain's fall as data: its streaks, its fall speed (m/s), its slant (× the wind) and its box's half size (m). */
export interface RainFallRow { readonly count: number; readonly speed: number; readonly slant: number; readonly radius: number }
/** A curtain's motion: its world-anchored offset and its fall velocity (a program's uniforms, or the caller's own). */
export interface RainFall { readonly offset: THREE.Vector3; readonly velocity: THREE.Vector3 }

/**
 * One frame of a curtain's fall: the velocity `speed` m/s down, slanted by `slant` × the wind (m/s, xz); the offset moved
 * by it and wrapped into the box round the eye (2 × `radius`: any whole multiple of the box wraps to itself, so the offset
 * stays small for float precision). Returns the index count the curtain draws at a rain of `rain` (0 … 1): the streaks
 * follow the intensity, all of them from 0.91 on. Pine Hollow's rain is its user; G441's W3 match is Nalati's
 * `world/WeatherFX.ts` `update` (its curtain block, over its program's `uOffset` / `uVel`).
 */
export function stepRainFall(fall: RainFall, row: RainFallRow, dt: number, wind: { readonly x: number; readonly z: number }, rain: number): number {
  const o = fall.offset.addScaledVector(fall.velocity.set(wind.x * row.slant, -row.speed, wind.z * row.slant), dt), box = 2 * row.radius;
  o.set(((o.x % box) + box) % box, ((o.y % box) + box) % box, ((o.z % box) + box) % box);
  return Math.ceil(row.count * Math.min(1, rain * 1.1)) * 6;
}
