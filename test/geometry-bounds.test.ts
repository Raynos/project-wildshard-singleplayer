import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { geometryBoundsSteps } from '../src/engine/world/geometryBounds';

function finish(steps: Generator<void, void>): number {
  let count = 0;
  while (steps.next().done !== true) count++;
  return count;
}
function reference(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = geometry.clone(); copy.computeBoundingSphere(); copy.computeBoundingBox(); return copy;
}

describe('sliced geometry bounds', () => {
  it('matches three.js exactly for a large translated, rotated mesh and keeps existing bound identities', () => {
    const geometry = new THREE.SphereGeometry(7.3, 192, 128).toNonIndexed();
    geometry.rotateY(0.782); geometry.translate(-27.1, 0.33, 112.4);
    const expected = reference(geometry), box = new THREE.Box3(), sphere = new THREE.Sphere();
    geometry.boundingBox = box; geometry.boundingSphere = sphere;
    const steps = geometryBoundsSteps(geometry);
    expect(steps.next().done).toBe(false);
    expect(box.isEmpty()).toBe(true); expect(sphere.radius).toBe(-1); // unpublished until both scans complete
    expect(finish(steps)).toBeGreaterThan(1);
    expect(geometry.boundingBox).toBe(box); expect(geometry.boundingSphere).toBe(sphere);
    expect(box).toEqual(expected.boundingBox); expect(sphere).toEqual(expected.boundingSphere);
  });

  it.each(['box', 'sphere', 'both'] as const)('preserves normalized/interleaved reads and only publishes requested %s bounds', bounds => {
    const data = new THREE.InterleavedBuffer(new Int16Array([20, -120, 44, 1, -22, 1000, 721, 2, 0, -32768, 32767, 3]), 4);
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0, true));
    const expected = reference(geometry); finish(geometryBoundsSteps(geometry, bounds));
    expect(geometry.boundingBox).toEqual(bounds === 'sphere' ? null : expected.boundingBox);
    expect(geometry.boundingSphere).toEqual(bounds === 'box' ? null : expected.boundingSphere);
  });

  it('yields within each position scan without changing geometry bytes', () => {
    const array = new Float32Array(32768 * 3 * 3);
    for (let i = 0; i < array.length; i++) array[i] = Math.sin(i * 0.81) * 83;
    const before = array.slice(), geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(array, 3));
    const expected = reference(geometry);
    expect(finish(geometryBoundsSteps(geometry))).toBe(6);
    expect(array).toEqual(before); expect(geometry.boundingBox).toEqual(expected.boundingBox); expect(geometry.boundingSphere).toEqual(expected.boundingSphere);
  });

  it.each([false, true])('keeps the original morph-target implementation (relative=%s)', relative => {
    const geometry = new THREE.BoxGeometry(5, 2, 9);
    const morph = geometry.getAttribute('position').clone();
    for (let i = 0; i < morph.count; i++) morph.setXYZ(i, morph.getX(i) * 3 + 1, morph.getY(i) - 1, morph.getZ(i) * -2);
    geometry.morphAttributes.position = [morph]; geometry.morphTargetsRelative = relative;
    const expected = reference(geometry); expect(finish(geometryBoundsSteps(geometry))).toBe(0);
    expect(geometry.boundingBox).toEqual(expected.boundingBox); expect(geometry.boundingSphere).toEqual(expected.boundingSphere);
  });

  it('matches empty and absent position attributes', () => {
    for (const geometry of [new THREE.BufferGeometry(), new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(), 3))]) {
      const expected = reference(geometry); finish(geometryBoundsSteps(geometry));
      expect(geometry.boundingBox).toEqual(expected.boundingBox); expect(geometry.boundingSphere).toEqual(expected.boundingSphere);
    }
  });
});
