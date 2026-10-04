import { expect, it } from 'vitest';
import * as THREE from 'three';
import { noDriftwoodWorld, type DriftwoodWorld } from '../../../src/shards/driftwood-isle/world/build';
import { driftwoodRoots, releaseDriftwoodCopies } from '../../../src/shards/driftwood-isle/world/gpuOnlyCopies';
import { gpuOnlyContent } from '../../../src/engine/core/gpuOnly';

// G144 (E435): Driftwood's world meshes give up their JS vertex copies as they upload; position, the index, dynamic
// attributes and skinned meshes keep theirs, and nothing outside Driftwood's own roots is touched.

function mesh(dynamic = false): THREE.Mesh {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(g.attributes['position']?.count ?? 0), 1));
  const tint = g.getAttribute('aTint');
  if (dynamic && tint instanceof THREE.BufferAttribute) tint.setUsage(THREE.DynamicDrawUsage);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial());
}
/** three's WebGLAttributes calls onUploadCallback after the first upload */
function upload(g: THREE.BufferGeometry): void {
  for (const a of Object.values(g.attributes)) if (a instanceof THREE.BufferAttribute) a.onUploadCallback();
}

it('frees every static non-position array on upload, keeps position, the index and dynamic attributes', () => {
  const placed = mesh(), group = new THREE.Group(), inner = mesh(), dyn = mesh(true), shared = mesh(), outsider = mesh();
  group.add(inner, dyn, new THREE.Mesh(shared.geometry, shared.material));
  const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  group.add(skinned);
  const world: DriftwoodWorld = { ...noDriftwoodWorld(), jetties: [], palmSpecs: [] };
  Object.assign(world, { hut: { group, placed: { object: placed } }, palms: { mesh: shared } });
  expect(driftwoodRoots(world)).toEqual([group, placed, shared]);
  const bytes = releaseDriftwoodCopies(world);
  expect(bytes).toBeGreaterThan(0);
  expect(gpuOnlyContent()).toContain('driftwood.world');
  for (const m of [placed, inner, shared, dyn, skinned, outsider]) upload(m.geometry);
  for (const m of [placed, inner, shared]) {
    const g = m.geometry;
    expect(g.getAttribute('position').array.length).toBeGreaterThan(0);
    expect(g.getIndex()?.array.length).toBeGreaterThan(0);
    expect(g.getAttribute('normal').array.length).toBe(0);
    expect(g.getAttribute('uv').array.length).toBe(0);
    expect(g.getAttribute('aTint').array.length).toBe(0);
    expect(g.getAttribute('normal').count).toBeGreaterThan(0); // the count stays: three draws from it
    expect(g.boundingSphere).not.toBeNull();
  }
  expect(dyn.geometry.getAttribute('aTint').array.length).toBeGreaterThan(0);
  expect(dyn.geometry.getAttribute('normal').array.length).toBe(0); // its static attributes still go
  expect(skinned.geometry.getAttribute('normal').array.length).toBeGreaterThan(0);
  expect(outsider.geometry.getAttribute('normal').array.length).toBeGreaterThan(0);
  // a second entry (the hybrid resident's cached world) marks nothing more
  expect(releaseDriftwoodCopies(world)).toBe(0);
});
