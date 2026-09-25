/**
 * The port registry: TSL twins of the materials that carry a GLSL patch, found by their customProgramCacheKey
 * (Sky.setupMaterial's '|csm' suffix stripped). A key without a port falls back to the plain (toon) material of its
 * type — the right look, minus the patch's motion or special shading.
 *
 *   registerPort('ocean-v2', (src, base) => …)   // src/gpu/materials.ts, src/gpu/ocean.ts
 *   portByKey('ocean-v2')                         // GpuLibrary
 *   harvest(src)                                  // the patch's own uniform objects + its GLSL, by running its hook on a stub
 *   toonCopy(src, Cls)                            // a node material of class Cls carrying src's properties, as three's library does
 */
import type * as THREE from 'three';
import { uniform } from 'three/tsl';
import type { Node, NodeMaterial } from 'three/webgpu';

export type Port = (src: THREE.Material, base: () => NodeMaterial) => NodeMaterial;

const PORTS = new Map<string, Port>();

export function registerPort(key: string, port: Port): void { PORTS.set(key, port); }
export function portByKey(key: string): Port | undefined { return key === '' ? undefined : PORTS.get(key); }

/** the offscreen WebGL renderer (Game.renderer in gpu mode): a patch hook may want it */
let legacy: THREE.WebGLRenderer | null = null;
export function setLegacyRenderer(r: THREE.WebGLRenderer): void { legacy = r; }

export interface Harvest { uniforms: Record<string, THREE.IUniform | undefined>; vertexShader: string; fragmentShader: string }

/**
 * Run a material's onBeforeCompile against a stub program whose sources are just the include lines the patches
 * replace: the patch drops its live uniform objects into `uniforms` (shared by reference with the module that owns
 * them) and leaves its GLSL in the sources (constants baked into it can be read back). Nothing is compiled.
 */
export function harvest(src: THREE.Material): Harvest {
  const includes = ['#include <common>', '#include <color_pars_vertex>', '#include <color_pars_fragment>', '#include <begin_vertex>', '#include <worldpos_vertex>', '#include <color_fragment>', '#include <emissivemap_fragment>', '#include <fog_fragment>', '#include <opaque_fragment>', '#include <lights_fragment_begin>', 'varying vec4 vColor;'].join('\n');
  const stub = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: includes, fragmentShader: includes, defines: {}, shaderName: src.type };
  if (legacy) src.onBeforeCompile(stub as THREE.WebGLProgramParametersWithUniforms, legacy);
  return stub;
}

export function need(h: Harvest, k: string): THREE.IUniform {
  const v = h.uniforms[k];
  if (!v) throw new Error(`[gpu] the patch has no uniform ${k}`);
  return v;
}

/** a node material of class `Cls` carrying every property of `src` (three's NodeLibrary.fromMaterial does the same) */
export function toonCopy<T extends NodeMaterial>(src: THREE.Material, Cls: new () => T): T {
  const m = new Cls();
  Object.assign(m, src);
  return m;
}

/** a harvested uniform as a TSL uniform that re-reads it every render */
export function hFloat(h: Harvest, k: string): Node<'float'> { const r = need(h, k) as THREE.IUniform<number>; return uniform(r.value).onRenderUpdate(() => r.value); }
export function hVec3(h: Harvest, k: string): Node<'vec3'> {
  const r = need(h, k) as THREE.IUniform<THREE.Vector3>;
  return uniform(r.value.clone()).onRenderUpdate((_f, self) => { self.value.copy(r.value); });
}
