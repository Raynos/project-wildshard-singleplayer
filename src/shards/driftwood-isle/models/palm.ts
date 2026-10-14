/**
 * The coconut palm (E306 / E315 M1: a model on the contract, src/engine/models/model.ts). A bent segmented trunk with ring
 * bands, a crown of drooping zig-zag fronds in two layers and a cluster of coconuts, flat-shaded and vertex-coloured.
 * The fronds sway in the vertex shader (a per-vertex `sway` = weight + phase, no CPU work), in the lit pass and the
 * shadow pass alike. Every copy has its own shape: its height, lean, turn and frond count are its params, the rest
 * comes from the placement group's rng stream (the old Palms.build loop's stream, so the move is exact). Built in its
 * own space: the foot of the trunk at the origin (the world sinks it 0.2 m into the sand, src/shards/driftwood-isle/world/Palms.ts).
 * The trunk collides as three capsules along its bent axis; the fronds are walk-through.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { palmSpecimen } from '../boot/palmGeometry';
import { windUniforms } from '@wildshard/engine/world/wind';

export interface PalmParams {
  /** trunk height, metres */
  readonly h: number;
  /** how far the trunk arches over (0 upright … 0.35) */
  readonly lean: number;
  /** which way it arches, radians about +Y */
  readonly leanDir: number;
  /** the trunk's and the crown's turn, radians */
  readonly rot: number;
  /** fronds in the drooping lower layer (the upper layer has 0.9× as many) */
  readonly fronds: number;
}

/** the trunk's bent axis at height share t (0 foot … 1 crown), own space: the lean grows with height and a slight S-bend */
function axisAt(p: PalmParams, t: number): THREE.Vector3 {
  const off = p.lean * p.h * (t * t - 0.12 * Math.sin(t * Math.PI));
  return new THREE.Vector3(Math.cos(p.leanDir) * off, p.h * t, Math.sin(p.leanDir) * off);
}

/** the fronds' sway (per-vertex weight + phase in `sway`), stronger in a gust — for the lit and the shadow-pass material */
function patchPalmSway(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }): void {
  shader.uniforms['uTime'] = windUniforms.uWindTime;
  shader.uniforms['uGust'] = windUniforms.uGust;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 sway; uniform float uTime; uniform float uGust;')
    .replace('#include <begin_vertex>', `
      vec3 transformed = vec3( position );
      {
        float w = sway.x * (0.55 + 0.8 * uGust), ph = sway.y;
        float g = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25 + 0.35 * uGust;
        transformed.x += g * w * 0.22;
        transformed.z += cos(uTime * 1.1 + ph) * w * 0.14;
        transformed.y -= abs(g) * w * 0.05;
      }`);
}

/** the palms' material and the matching shadow-pass one: one pair per shard, so every copy merges into one draw */
export function palmMaterials(ctx: ModelContext): { lit: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial } {
  return ctx.once('driftwood-isle/palm:materials', () => {
    const lit = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    patchShader(lit, 'driftwood.palm-sway', PATCH_ORDER.material, (shader) => { attachFogUniforms(shader); patchPalmSway(shader); }, { mode: 'replace', key: 'palms-sway' });
    ctx.sky.setupMaterial(lit);
    // the shadow pass sways the fronds too, so the palm shadows on the sand move (M5)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    patchShader(depth, 'driftwood.palm-sway-depth', PATCH_ORDER.material, (shader) => { patchPalmSway(shader); }, { mode: 'replace', key: 'palms-sway-depth' });
    return { lit, depth };
  });
}

/**
 * The trunk's collision, own space: three capsules whose segments run along the bent axis (t 0 → ⅓ → ⅔ → 1, the first
 * sunk 0.3 m into the ground), each as thick as the trunk's rings at its lower end (0.3 m tapering by 45 % to the crown).
 */
function trunkCapsules(p: PalmParams): ColliderDesc[] {
  const out: ColliderDesc[] = [];
  const cuts = [0, 1 / 3, 2 / 3, 1];
  for (let k = 0; k < 3; k++) {
    const t0 = cuts[k] ?? 0, t1 = cuts[k + 1] ?? 1;
    const p0 = axisAt(p, t0), p1 = axisAt(p, t1);
    if (k === 0) p0.y -= 0.3;
    const along = p1.clone().sub(p0), len = along.length(), radius = 0.3 * (1 - t0 * 0.45);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.divideScalar(len));
    out.push({ kind: 'capsule', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2, halfHeight: len / 2, radius, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
  }
  return out;
}

export const palm = defineModel<PalmParams>({
  id: 'driftwood-isle/palm', name: 'Coconut palm', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/palm.ts', surface: 'wood',
  defaults: { h: 8, lean: 0.2, leanDir: 0, rot: 0, fronds: 11 },
  variants: [
    { id: 'tall', label: 'Tall', params: {} },
    { id: 'young', label: 'Young', params: { h: 5.5, lean: 0.1, fronds: 9 } },
    { id: 'leaning', label: 'Leaning', params: { h: 9.5, lean: 0.35, fronds: 13 } },
  ],
  seed: 0x5ea1 ^ 0x9a,
  build: (ctx, p) => {
    const { lit, depth } = palmMaterials(ctx);
    return palmSpecimen(p, lit, depth);
  },
  colliders: (p) => trunkCapsules(p),
});
