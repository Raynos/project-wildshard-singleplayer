import { expect, test } from 'vitest';
import { BoxGeometry, InstancedMesh, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { LIVE_PARKED_BUDGET, parkedDrawSlices } from '../render/parkedDraws';

test('matching instances retain every draw without paying one frame per copy', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const objects = Array.from({ length: 19 }, () => new InstancedMesh(geometry, material, 1));
  const slices = parkedDrawSlices(objects, LIVE_PARKED_BUDGET);
  expect(slices.map(slice => slice.length)).toEqual([8, 8, 3]);
  expect(slices.flat()).toEqual(objects);
  geometry.dispose(); material.dispose();
});

test('a new geometry, material or instance layout retains its first-use boundary', () => {
  const geometry = new BoxGeometry(), other = new BoxGeometry(), material = new MeshBasicMaterial(), second = new MeshBasicMaterial();
  const objects = [new InstancedMesh(geometry, material, 1), new InstancedMesh(geometry, material, 1),
    new InstancedMesh(other, material, 1), new InstancedMesh(other, second, 1), new Mesh(other, second)];
  expect(parkedDrawSlices(objects, LIVE_PARKED_BUDGET)).toEqual([[objects[0], objects[1]], [objects[2]], [objects[3]], [objects[4]]]);
  geometry.dispose(); other.dispose(); material.dispose(); second.dispose();
});

test('per-object render callbacks keep independent first uses', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const objects = [new InstancedMesh(geometry, material, 1), new InstancedMesh(geometry, material, 1)];
  for (const object of objects) object.onBeforeRender = () => undefined;
  expect(parkedDrawSlices(objects, LIVE_PARKED_BUDGET)).toEqual(objects.map(object => [object]));
  geometry.dispose(); material.dispose();
});

test('fresh instance buffers obey the smaller byte limit even with a shared binding', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const objects = Array.from({ length: 3 }, () => new InstancedMesh(geometry, material, 2100));
  expect(parkedDrawSlices(objects, LIVE_PARKED_BUDGET)).toEqual(objects.map(object => [object]));
  geometry.dispose(); material.dispose();
});

test('an oversized first buffer goes alone and all following copies remain bounded', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const first = new InstancedMesh(geometry, material, 5000), rest = Array.from({ length: 9 }, () => new InstancedMesh(geometry, material, 1));
  const slices: Object3D[][] = parkedDrawSlices([first, ...rest], LIVE_PARKED_BUDGET);
  expect(slices.map(slice => slice.length)).toEqual([1, 8, 1]);
  expect(slices.flat()).toEqual([first, ...rest]);
  geometry.dispose(); material.dispose();
});
