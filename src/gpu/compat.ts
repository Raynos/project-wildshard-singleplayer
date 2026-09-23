/**
 * Scene fix-ups the WebGPU backend needs where WebGL was lenient; run over the scene before the first frame and
 * every couple of seconds after (objects are added in play: drops, enemies, particles). Touches only render-side
 * state that the WebGL path never reads again.
 *
 * - An InstancedMesh on an InstancedBufferGeometry (Gulls): WebGL draws `mesh.count` instances, WebGPU draws
 *   `geometry.instanceCount` — Infinity by default, which throws in `draw()`. The geometry's count follows the mesh.
 * - `flat` varyings (the low-poly terrain's facet colour, materials.ts terrain-lowpoly): WebGL takes the triangle's LAST
 *   vertex, WebGPU its FIRST. On the WebGPU backend each triangle's indices are rotated (a b c → c a b: the same triangle,
 *   the same winding) so the same vertex provides the colour.
 */
import * as THREE from 'three';
import { usesFlatColour } from './materials';

const fixed = new WeakSet<THREE.BufferGeometry>();
const rotated = new WeakSet<THREE.BufferAttribute>();

function rotateTriangles(index: THREE.BufferAttribute): void {
  if (rotated.has(index)) return;
  rotated.add(index);
  const a = index.array;
  for (let i = 0; i + 2 < a.length; i += 3) { const c = a[i + 2] ?? 0; a[i + 2] = a[i + 1] ?? 0; a[i + 1] = a[i] ?? 0; a[i] = c; }
  index.needsUpdate = true;
}

export function fixScene(root: THREE.Object3D, webgpuBackend: boolean): void {
  root.traverse((o) => {
    if (webgpuBackend && o instanceof THREE.Mesh) {
      const m: unknown = o.material, g: unknown = o.geometry;
      if (m instanceof THREE.MeshStandardMaterial && g instanceof THREE.BufferGeometry && g.index && Object.hasOwn(m, 'customProgramCacheKey')
        && m.customProgramCacheKey().startsWith('terrain-lowpoly') && usesFlatColour(m)) rotateTriangles(g.index);
    }
    if (!(o instanceof THREE.InstancedMesh)) return;
    const g: unknown = o.geometry;
    if (!(g instanceof THREE.InstancedBufferGeometry) || fixed.has(g) || Number.isFinite(g.instanceCount)) return;
    fixed.add(g);
    Object.defineProperty(g, 'instanceCount', { get: () => o.count, set: (_v: number) => { /* the mesh's count rules */ }, configurable: true });
  });
}
