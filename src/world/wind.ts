/**
 * wind — Driftwood Isle's one wind (remaster M5): a clock and a slow GUST (0 calm … 1 gusting) that everything that
 * sways reads — palm fronds, bushes, ground cover, sails, the lookout banner, hanging weed and flags — and that the sound
 * agent reads too (`palms.gust`). Palms.update(dt) advances it once a frame (main.ts already calls it).
 *
 * Geometry opts in through a vec2 vertex attribute `aSway` = (weight, phase): weight 0 never moves (a geometry without
 * the attribute reads 0), ~1 flutters like cloth. `patchSway(shader)` adds the displacement to any material's vertex
 * shader (call it from onBeforeCompile, before `sky.setupMaterial`); `swayDepthMaterial()` is the matching shadow-pass
 * material, so shadows move with what casts them (`mesh.customDepthMaterial = swayDepthMaterial()`).
 */
import * as THREE from 'three';

export const windUniforms = { uWindTime: { value: 0 }, uGust: { value: 0.5 } };

/** advance the wind clock and the gust (a few incommensurate sines: long lulls, a stronger puff every half-minute or so) */
export function updateWind(dt: number): void {
  const t = (windUniforms.uWindTime.value += dt);
  const g = 0.5 + 0.28 * Math.sin(t * 0.11) + 0.16 * Math.sin(t * 0.37 + 1.3) + 0.08 * Math.sin(t * 1.3 + 0.4);
  windUniforms.uGust.value = Math.min(1, Math.max(0, g));
}

/** the prevailing wind (from the sea in the south-east), unit xz */
const WX = -0.55, WZ = 0.83;

const SWAY_GLSL = /* glsl */`
  {
    float sw = aSway.x;
    if (sw > 0.0) {
      vec4 wp4 = modelMatrix * vec4(position, 1.0);
      float ph = aSway.y + wp4.x * 0.21 + wp4.z * 0.17;
      float amp = (0.35 + 0.65 * uGust) * sw;
      float flap = sin(uWindTime * 2.1 + ph) * 0.55 + sin(uWindTime * 4.3 + ph * 1.9) * 0.25;
      float lean = 0.25 + 0.75 * uGust;
      vec2 d = vec2(${WX.toFixed(3)}, ${WZ.toFixed(3)}) * (lean * 0.12 + flap * 0.1) * amp;
      d += vec2(-${WZ.toFixed(3)}, ${WX.toFixed(3)}) * sin(uWindTime * 1.4 + ph * 1.3) * 0.05 * amp;
      // world-space offset → object space (the kit's meshes are world-space; the boat's is a moving group)
      vec3 off = (inverse(modelMatrix) * vec4(d.x, -abs(flap) * 0.02 * amp, d.y, 0.0)).xyz;
      transformed += off;
    }
  }`;

/** add the sway to a material's vertex shader (inside onBeforeCompile) */
export function patchSway(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }): void {
  shader.uniforms['uWindTime'] = windUniforms.uWindTime;
  shader.uniforms['uGust'] = windUniforms.uGust;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aSway;\nuniform float uWindTime;\nuniform float uGust;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_GLSL}`);
}

let depth: THREE.MeshDepthMaterial | null = null;
/** the shadow-pass material for swaying meshes (one shared program) */
export function swayDepthMaterial(): THREE.MeshDepthMaterial {
  if (depth) return depth;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => patchSway(sh);
  m.customProgramCacheKey = () => 'sway-depth';
  depth = m;
  return m;
}

/** an aSway attribute for a geometry: weight rises with height from 0 at `y0` to `w` at `y1` (a bush, a frond) or falls
 * from the top (hanging cloth: pass y0 > y1) */
export function swayByHeight(g: THREE.BufferGeometry, w: number, y0: number, y1: number, phase: number): void {
  const pos = g.getAttribute('position'), a = new Float32Array(pos.count * 2), span = y1 - y0 || 1;
  for (let i = 0; i < pos.count; i++) { a[i * 2] = w * Math.min(1, Math.max(0, (pos.getY(i) - y0) / span)); a[i * 2 + 1] = phase; }
  g.setAttribute('aSway', new THREE.BufferAttribute(a, 2));
}
