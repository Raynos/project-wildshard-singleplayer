import * as THREE from 'three';
import { expect, test } from 'vitest';
import { loadGlbNodes } from '../src/engine/models/glbNodes';
import { placedGeometryCollider } from '../src/engine/models/colliders';

test('named nodes widen quantized channels before file transforms and project registry colliders', async () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Int16BufferAttribute([0, 0, 0, 32767, 0, 0, 0, 32767, 0], 3, true));
  source.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  source.setAttribute('color', new THREE.Uint8BufferAttribute([255, 128, 0, 255, 128, 0, 255, 128, 0], 3, true));
  source.setIndex([2, 1, 0]);
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(source, material), root = new THREE.Group();
  mesh.name = 'module'; mesh.position.set(2, 3, 4); root.scale.setScalar(2); root.add(mesh);
  const borrowed: THREE.Material[] = [];
  const nodes = await loadGlbNodes(root, {
    position: { source: 'position', size: 3 }, normal: { source: 'normal', size: 3 },
    tint: { source: 'color', size: 4, fill: 1 }, texcoord: { source: 'uv', size: 2, fill: 0 },
  }, (m) => { borrowed.push(m); });
  const geometry = nodes.get('module');
  if (geometry === undefined) throw new Error('missing module');
  expect(borrowed).toEqual([material]);
  expect(geometry.getAttribute('position').getX(1)).toBeCloseTo(6);
  expect(geometry.getAttribute('tint').getY(0)).toBeCloseTo(128 / 255);
  expect(geometry.getAttribute('tint').getW(0)).toBe(1);
  expect(Array.from(geometry.getAttribute('texcoord').array)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(source.getAttribute('position').array).toBeInstanceOf(Int16Array);
  expect(source.hasAttribute('tint')).toBe(false);
  const matrix = new THREE.Matrix4().makeRotationY(0.4).scale(new THREE.Vector3(2, 3, 2)).setPosition(20, 5, -8);
  const collider = placedGeometryCollider({ kind: 'trimesh', geometry }, matrix, 'rock');
  if (collider.kind !== 'trimesh') throw new Error('not a trimesh');
  expect(Array.from(collider.indices)).toEqual([2, 1, 0]);
  const origin = new THREE.Vector3().setFromMatrixPosition(matrix), expected = new Float32Array(9);
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), i).applyMatrix4(matrix).sub(origin);
    expected.set([v.x, v.y, v.z], i * 3);
  }
  expect(collider.vertices).toEqual(expected);
  const hull = placedGeometryCollider({ kind: 'hull', points: new Float32Array(geometry.getAttribute('position').array) }, matrix, 'rock');
  expect(hull.kind === 'hull' ? hull.points : null).toEqual(expected);
  geometry.dispose(); source.dispose(); material.dispose();
});

test('default intake retains channels and invalid or missing required projections refuse', async () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'box';
  const result = (await loadGlbNodes(mesh)).get('box');
  expect(Object.keys(result?.attributes ?? {})).toEqual(Object.keys(geometry.attributes));
  await expect(loadGlbNodes(mesh, { position: { source: 'position', size: 3 }, missing: { source: 'missing', size: 1 } })).rejects.toThrow('Missing GLB attribute');
  await expect(loadGlbNodes(mesh, { position: { source: 'normal', size: 3 } })).rejects.toThrow('Invalid GLB attribute projection');
  result?.dispose(); geometry.dispose(); material.dispose();
});
