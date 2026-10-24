// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate the exact serialized page reader in an isolated realm.
import { runInNewContext } from 'node:vm';
import { BufferAttribute, BufferGeometry, InstancedMesh, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshBasicMaterial, Scene } from 'three';
import { expect, test } from 'vitest';
import { captureTileScene } from '../scripts/parity/tile-census-scene.mjs';

function fixture() {
  const backing = new ArrayBuffer(48), position = new BufferAttribute(new Float32Array(backing, 0, 6), 3);
  position.array.set([0, 0, 0, 1, 1, 1]);
  const color = new BufferAttribute(new Float32Array(backing, 24, 6), 3);
  const geometry = new BufferGeometry().setAttribute('position', position).setAttribute('color', color);
  const scene = new Scene(), material = new MeshBasicMaterial();
  const a = new Mesh(geometry, material), b = new Mesh(geometry, material);
  a.name = 'a'; b.name = 'b'; a.position.set(10, 2, -4);
  scene.add(a, b); scene.updateMatrixWorld(true);
  const sourceIds = (source: object) => source === position ? ['gpu:position'] : source === color ? ['gpu:color'] : [];
  return { scene, backing, geometry, position, color, a, b, sourceIds, material };
}

test('shared and offset attribute views retain one full backing identity', () => {
  const f = fixture(), result = captureTileScene(f.scene, f.sourceIds);
  expect(result.cpuBuffers).toEqual([{ id: 'scene-cpu:1', bytes: 48 }]);
  expect(result.nodes.map(row => row.cpuBuffers)).toEqual([
    [{ id: 'scene-cpu:1', role: 'position' }, { id: 'scene-cpu:1', role: 'color' }],
    [{ id: 'scene-cpu:1', role: 'position' }, { id: 'scene-cpu:1', role: 'color' }],
  ]);
  expect(result.nodes.map(row => row.buffers)).toEqual([['gpu:position', 'gpu:color'], ['gpu:position', 'gpu:color']]);
  expect(result.nodes.every(row => row.worldBounds === null)).toBe(true);
  expect(f.geometry.boundingBox).toBeNull();
  expect(structuredClone(result)).toEqual(result);
  // A later read reflects a replacement, without mutating an old scalar receipt.
  f.geometry.setAttribute('color', new BufferAttribute(new Float32Array(6), 3));
  expect(captureTileScene(f.scene, f.sourceIds).cpuBuffers.map(row => row.bytes)).toEqual([48, 24]);
  expect(result.cpuBuffers).toEqual([{ id: 'scene-cpu:1', bytes: 48 }]);
});

test('serialized browser function has no module closure and does not compute bounds', () => {
  const f = fixture();
  const result: unknown = runInNewContext(`(${captureTileScene.toString()})(scene, sourceIds)`,
    { scene: f.scene, sourceIds: f.sourceIds }, { timeout: 1000 });
  expect(result).toEqual(captureTileScene(f.scene, f.sourceIds));
  expect(f.geometry.boundingBox).toBeNull();
});

test('existing affine bounds transform without changing geometry or transforms', () => {
  const f = fixture();
  f.geometry.computeBoundingBox();
  const before = f.geometry.boundingBox?.clone(), matrix = f.a.matrixWorld.clone();
  const result = captureTileScene(f.scene, f.sourceIds);
  expect(result.nodes[0]?.worldBounds).toEqual({ min: { x: 10, y: 2, z: -4 }, max: { x: 11, y: 3, z: -3 } });
  expect(f.geometry.boundingBox).toEqual(before);
  expect(f.a.matrixWorld).toEqual(matrix);
  f.a.matrixWorld.elements[3] = 1;
  expect(captureTileScene(f.scene, f.sourceIds).nodes[0]?.worldBounds).toBeNull();
});

test('interleaved, index, instance and morph views preserve shared storage', () => {
  const backing = new ArrayBuffer(128), scene = new Scene();
  const data = new InterleavedBuffer(new Float32Array(backing, 0, 12), 6);
  const geometry = new BufferGeometry()
    .setAttribute('position', new InterleavedBufferAttribute(data, 3, 0))
    .setAttribute('normal', new InterleavedBufferAttribute(data, 3, 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array(backing, 48, 3), 1));
  geometry.morphAttributes.position = [new BufferAttribute(new Float32Array(backing, 64, 6), 3)];
  geometry.computeBoundingBox();
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), 1);
  scene.add(mesh); scene.updateMatrixWorld(true);
  const result = captureTileScene(scene, source => source === data ? ['gpu:interleaved'] : []);
  expect(result.cpuBuffers.map(row => row.bytes)).toEqual([128, 64]);
  expect(result.nodes[0]?.buffers).toEqual(['gpu:interleaved']);
  expect(result.nodes[0]?.cpuBuffers.map(row => row.role)).toEqual(['position', 'normal', 'index', 'morph:position:0', 'instanceMatrix']);
  expect(result.nodes[0]?.worldBounds).toBeNull();
});

test('missing CPU arrays stay unknown while zero-byte backing remains explicit', () => {
  const f = fixture();
  Reflect.deleteProperty(f.position, 'array');
  f.color.array = new Float32Array(0);
  const result = captureTileScene(f.scene, f.sourceIds);
  expect(result.cpuBuffers).toEqual([{ id: 'scene-cpu:1', bytes: 0 }]);
  expect(result.nodes.map(row => row.missingCpuRoles)).toEqual([['position'], ['position']]);
  expect(result.nodes[0]?.buffers).toEqual(['gpu:position', 'gpu:color']);
});
