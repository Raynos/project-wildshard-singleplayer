/**
 * `?physics=debug`: draws every collider as lines (Rapier's `debugRender`), the authoring view for the colliders the
 * phases add (PHYSICS.md §Architecture). Dev only: nothing is built without the param.
 *
 * The world is static until P7, so the lines are rebuilt only when the collider count changes, checked twice a
 * second, not every frame. They sit 2 cm up, so they draw over the terrain they trace.
 */
import * as THREE from 'three';
import type { Physics } from './Physics';
import { tagOf } from './surface';

const LIFT = 0.02;

export function installPhysicsDebug(physics: Physics, scene: THREE.Scene, params: URLSearchParams): void {
  if (params.get('physics') !== 'debug') return;
  // for probes: which collider (and whose, what material) a query hit — `window.__physics.tagOf(collider)`
  (window as unknown as { __physics: unknown }).__physics = { physics, tagOf };
  const geo = new THREE.BufferGeometry();
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, fog: false }));
  lines.frustumCulled = false;
  lines.renderOrder = 10;
  lines.name = 'physics-debug';
  scene.add(lines);
  let count = -1;
  const rebuild = () => {
    const n = physics.world.colliders.len();
    if (n === count) return;
    count = n;
    const { vertices, colors } = physics.world.debugRender();
    const pos = new Float32Array(vertices);
    for (let i = 1; i < pos.length; i += 3) pos[i] = (pos[i] ?? 0) + LIFT;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    geo.computeBoundingSphere();
  };
  rebuild();
  setInterval(rebuild, 500);
}
