/**
 * Scene fix-ups the WebGPU backend needs where WebGL was lenient; run over the scene before the first frame and
 * every couple of seconds after (objects are added in play: drops, enemies, particles). Touches only render-side
 * state that the WebGL path never reads again.
 *
 * - An InstancedMesh on an InstancedBufferGeometry (Gulls): WebGL draws `mesh.count` instances, WebGPU draws
 *   `geometry.instanceCount` — Infinity by default, which throws in `draw()`. The geometry's count follows the mesh.
 * (Terrain.ts' `flat varying vec4 vColor` replace matches nothing: at onBeforeCompile time that line still sits inside the
 * unexpanded `#include <color_pars_vertex>`. So the WebGL terrain is smooth-shaded between vertex colours, and the
 * WebGPU path draws it the same way: no port.)
 */
import * as THREE from 'three';

const fixed = new WeakSet<THREE.BufferGeometry>();

export function fixScene(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    const g: unknown = o.geometry;
    if (!(g instanceof THREE.InstancedBufferGeometry) || fixed.has(g) || Number.isFinite(g.instanceCount)) return;
    fixed.add(g);
    Object.defineProperty(g, 'instanceCount', { get: () => o.count, set: (_v: number) => { /* the mesh's count rules */ }, configurable: true });
  });
}
