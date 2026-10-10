import * as THREE from 'three';

/**
 * Rising billboard particles' material (SHARD-PLATFORM M3, the looks system): one program for every kind a shard draws
 * (smoke, flames, embers…), driven entirely by `uTime` (no per-frame CPU work). The kind is a uniform branch (`uKind`, the
 * kind's index), not a define, and every kind carries the fog uniforms, so the kinds share one compile. The row gives a
 * kind's life, rise, spread, size from birth to death, wind and blend; the shard gives the GLSL, the noise texture and the
 * uniforms it shares between kinds (the sky's sun, a night's shade and lamps).
 */

/** One particle kind: its life (s), rise (m), spread (m), size from birth to death (m), wind (m/s, world), blend (a shard's data row). */
export interface RiseParticleRow {
  readonly life: number;
  readonly rise: number;
  readonly spread: number;
  readonly size: readonly [number, number];
  readonly wind: readonly [number, number, number];
  readonly blend: 'normal' | 'additive';
}

/** The program's stages (a shard's data row). */
export interface RiseParticleGlsl { readonly vertex: string; readonly fragment: string }

/** What every kind's material shares: the noise texture and the live uniforms the shard drives. */
export interface RiseParticleShared {
  readonly noise: THREE.Texture;
  /** uniforms handed in by reference (the sky's sun direction and colour, a night's shade and lamps) */
  readonly uniforms: Readonly<Record<string, THREE.IUniform>>;
}

/** A kind's material: the row's numbers as uniforms, the shared uniforms by reference, the fog's own, and `uKind` = `kind`. */
export function riseParticleMaterial(row: RiseParticleRow, kind: number, glsl: RiseParticleGlsl, shared: RiseParticleShared): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 }, uLife: { value: row.life }, uRise: { value: row.rise }, uSpread: { value: row.spread },
    uSize: { value: new THREE.Vector2(row.size[0], row.size[1]) }, uWind: { value: new THREE.Vector3(...row.wind) }, tNoise: { value: shared.noise },
    ...shared.uniforms,
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uKind: { value: kind },
  };
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: row.blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true, side: THREE.DoubleSide,
    vertexShader: glsl.vertex,
    fragmentShader: glsl.fragment,
  });
}
