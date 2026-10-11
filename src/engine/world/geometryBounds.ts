import { Box3, BufferAttribute, InterleavedBufferAttribute, Sphere, Vector3, type BufferGeometry } from 'three';

/** Compute ordinary geometry bounds in 32,768-vertex steps, with three.js's vertex order and arithmetic.
 * Exhausting the generator is synchronous; a sliced builder may pause between steps. Geometry must remain
 * unmodified until completion. Existing bound objects retain their identity and are published only at completion.
 * Morph targets, GPU-only attributes and invalid coordinates keep three.js's original implementation. */
export function* geometryBoundsSteps(geometry: BufferGeometry, bounds: 'box' | 'sphere' | 'both' = 'both'): Generator<void, void> {
  const position: unknown = geometry.getAttribute('position');
  const original = (): void => {
    if (bounds !== 'box') geometry.computeBoundingSphere();
    if (bounds !== 'sphere') geometry.computeBoundingBox();
  };
  if (!(position instanceof BufferAttribute || position instanceof InterleavedBufferAttribute) || geometry.morphAttributes.position !== undefined) {
    original(); return;
  }
  const box = new Box3(), point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i); box.expandByPoint(point);
    if ((i & 32767) === 32767) yield;
  }
  if (Number.isNaN(box.min.x) || Number.isNaN(box.min.y) || Number.isNaN(box.min.z)) { original(); return; }
  if (bounds !== 'box') {
    const sphere = new Sphere(); box.getCenter(sphere.center);
    let radiusSq = 0;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      radiusSq = Math.max(radiusSq, sphere.center.distanceToSquared(point));
      if ((i & 32767) === 32767) yield;
    }
    sphere.radius = Math.sqrt(radiusSq);
    if (Number.isNaN(sphere.radius)) { original(); return; }
    (geometry.boundingSphere ??= new Sphere()).copy(sphere);
  }
  if (bounds !== 'sphere') (geometry.boundingBox ??= new Box3()).copy(box);
}
