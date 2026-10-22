import { expect, test, vi } from 'vitest';
import { Bone, Box3, BoxGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';
import { skinEnvelope, uploadedSkinBounds } from '../src/game/grid/skinEnvelope';

test('bone envelopes contain exact vertices through poses, rebasing and unequal weight sums', () => {
  const geometry = new BoxGeometry(2, 4, 3), material = new MeshBasicMaterial(), mesh = new SkinnedMesh(geometry, material);
  const count = geometry.getAttribute('position').count, weights = new Float32Array(count * 4), indices = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++) { weights[i * 4] = i % 2 ? 0.2 : 0.8; weights[i * 4 + 1] = i % 3 ? 0.4 : 0.7; indices[i * 4 + 1] = 1; }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  const root = new Group(), a = new Bone(), b = new Bone(); a.add(b); mesh.add(a); root.add(mesh); b.position.y = 2;
  root.position.set(555, 0, -1110); root.updateMatrixWorld(true); mesh.bind(new Skeleton([a, b]));
  try {
    const envelope = skinEnvelope(mesh); if (envelope === null) throw new Error('Expected a linear skin envelope');
    for (let pose = 0; pose < 12; pose++) {
      a.rotation.y = pose * 0.23; b.rotation.z = pose * -0.19; a.position.x = pose * 0.7;
      root.position.z += 0.3; root.updateMatrixWorld(true); mesh.skeleton.update();
      expect(envelope().clone().expandByScalar(0.000001).containsBox(uploadedSkinBounds(mesh, geometry.boundingBox ?? new Box3()))).toBe(true);
    }
    // an uploaded weight change (its version bumps, as the GPU needs) is scanned again
    const changed = geometry.getAttribute('skinWeight'); changed.setX(0, -0.1); changed.needsUpdate = true; expect(skinEnvelope(mesh)).toBeNull();
  } finally { mesh.skeleton.dispose(); geometry.dispose(); material.dispose(); }
});

test('skinned copies on one geometry and bind pose share the vertex scan, each with its own pose', () => {
  const geometry = new BoxGeometry(2, 4, 3), material = new MeshBasicMaterial(), count = geometry.getAttribute('position').count;
  const weights = new Float32Array(count * 4), indices = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++) { weights[i * 4] = 0.6; weights[i * 4 + 1] = 0.4; indices[i * 4 + 1] = 1; }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  const copy = (): { mesh: SkinnedMesh; a: Bone; b: Bone } => {
    const mesh = new SkinnedMesh(geometry, material), a = new Bone(), b = new Bone(); a.add(b); mesh.add(a); b.position.y = 2;
    mesh.updateMatrixWorld(true); mesh.bind(new Skeleton([a, b])); return { mesh, a, b };
  };
  const first = copy(), second = copy(), reads = vi.spyOn(geometry.getAttribute('skinWeight'), 'getComponent');
  try {
    const one = skinEnvelope(first.mesh); reads.mockClear();
    const two = skinEnvelope(second.mesh);
    expect(reads).not.toHaveBeenCalled();
    if (one === null || two === null) throw new Error('Expected linear skin envelopes');
    first.a.rotation.y = 0.8; second.b.rotation.z = -0.6; second.a.position.x = 3;
    for (const { mesh } of [first, second]) { mesh.updateMatrixWorld(true); mesh.skeleton.update(); }
    expect(one().clone().expandByScalar(0.000001).containsBox(uploadedSkinBounds(first.mesh, new Box3()))).toBe(true);
    expect(two().clone().expandByScalar(0.000001).containsBox(uploadedSkinBounds(second.mesh, new Box3()))).toBe(true);
  } finally { reads.mockRestore(); first.mesh.skeleton.dispose(); second.mesh.skeleton.dispose(); geometry.dispose(); material.dispose(); }
});
