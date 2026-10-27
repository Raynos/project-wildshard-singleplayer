import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeStaticSiblingsSliced } from './staticSets';

function fixture() {
  const words = new Float32Array(65538 * 3);
  for (let i = 0; i < words.length; i++) words[i] = i % 11 === 0 ? -0 : (i % 97 - 48) / 7;
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(words, 3));
  const material = new MeshBasicMaterial(), root = new Group();
  const first = new Mesh(geometry, material), second = new Mesh(geometry, material);
  first.name = 'stone'; first.position.set(3, -0, 4); first.rotation.y = 0.7;
  second.position.set(-4, 2, 9); second.scale.set(2, 1, 3);
  first.castShadow = second.castShadow = true; first.receiveShadow = second.receiveShadow = true;
  root.add(first, second); return { geometry, material, root, first, second };
}

test('static merge bounds yield before publication and keep exact native geometry and bounds', async () => {
  const f = fixture();
  const parts = [f.first, f.second].map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
  const expected = mergeGeometries(parts, false); expected.computeBoundingSphere(); expected.computeBoundingBox();
  for (const part of parts) part.dispose();
  let release = (): void => undefined, checks = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const pending = mergeStaticSiblingsSliced(f.root, { due: () => true, yield: () => barrier,
    check: () => { checks++; return checks === 3 ? barrier : undefined; } });
  try {
    expect(checks).toBe(3); expect(f.root.children).toEqual([f.first, f.second]);
    release();
    const result = await pending, merged = result.geometries[0];
    if (merged === undefined) throw new Error('Missing merged geometry');
    expect(result.saved).toBe(1); expect(checks).toBeGreaterThan(3);
    expect(merged.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
    expect(merged.boundingSphere).toEqual(expected.boundingSphere); expect(merged.boundingBox).toEqual(expected.boundingBox);
    const mesh = f.root.children[0]; if (!(mesh instanceof Mesh)) throw new Error('Missing merged mesh');
    expect(mesh.name).toBe('stone+1'); expect(mesh.castShadow).toBe(true); expect(mesh.receiveShadow).toBe(true);
    merged.dispose();
  } finally { release(); expected.dispose(); f.geometry.dispose(); f.material.dispose(); }
});

test('failed bounds pause disposes unpublished copies without freeing borrowed input geometry', async () => {
  const f = fixture(), failure = new Error('Owner retired');
  const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose'), sourceDisposed = vi.fn((): void => undefined);
  f.geometry.addEventListener('dispose', sourceDisposed);
  let checks = 0;
  try {
    await expect(mergeStaticSiblingsSliced(f.root, { due: () => true, yield: () => Promise.reject(failure),
      check: () => { checks++; return checks === 3 ? Promise.reject(failure) : undefined; } })).rejects.toBe(failure);
    expect(dispose).toHaveBeenCalledTimes(3); // both transformed inputs and the unpublished merged buffer
    expect(sourceDisposed).not.toHaveBeenCalled(); expect(f.root.children).toEqual([f.first, f.second]);
  } finally { dispose.mockRestore(); f.geometry.dispose(); f.material.dispose(); }
});
