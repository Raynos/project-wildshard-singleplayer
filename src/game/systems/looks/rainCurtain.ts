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

/** Camera-local, world-anchored streak quads. Both authored programs retain their exact source. */
export function rainCurtain(spec: RainCurtainSpec): THREE.Mesh {
  const n = spec.count, rng = new Rng(spec.seed ^ 0x2a1);
  const seed = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 2), idx = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const sx = rng.next(), sy = rng.next(), sz = rng.next(), sp = rng.range(0.85, 1.2);
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      seed[v * 4] = sx; seed[v * 4 + 1] = sy; seed[v * 4 + 2] = sz; seed[v * 4 + 3] = sp;
      corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1;
    }
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...spec.uniforms };
  attachFogUniforms({ uniforms });
  const mat = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, ...spec.program });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.visible = false; mesh.name = 'rain';
  return mesh;
}
