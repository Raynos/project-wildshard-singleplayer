import { expect, test } from 'vitest';
import { BatchedMesh, BoxGeometry, DoubleSide, InstancedMesh, Mesh, MeshBasicMaterial, MeshDepthMaterial, Texture } from 'three';
import { depthForKind } from './shadowDepthKinds';

test('PF3: each caster kind draws its own copy of the stock depth material, as three set the stock for this draw', () => {
  const stock = new MeshDepthMaterial(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const plain = new Mesh(geometry, material), instanced = new InstancedMesh(geometry, material, 2), batched = new BatchedMesh(2, 64, 64, material);
  // the plain kind keeps the stock
  expect(depthForKind(stock, plain)).toBe(stock);
  const forInstanced = depthForKind(stock, instanced), forBatched = depthForKind(stock, batched);
  expect(forInstanced).not.toBe(stock); expect(forBatched).not.toBe(stock); expect(forBatched).not.toBe(forInstanced);
  expect(depthForKind(stock, instanced)).toBe(forInstanced); // one copy a kind, kept
  // three's per-draw fields follow the stock
  const map = new Texture();
  stock.side = DoubleSide; stock.map = map; stock.alphaTest = 0.45; stock.visible = false;
  const copy = depthForKind(stock, batched);
  expect([copy.side, copy.map, copy.alphaTest, copy.visible]).toEqual([DoubleSide, map, 0.45, false]);
  expect(copy.depthPacking).toBe(stock.depthPacking);
  // a disposed stock (a source material's cached clone) disposes its copies
  let disposed = 0; copy.addEventListener('dispose', () => { disposed++; });
  stock.dispose();
  expect(disposed).toBe(1);
  expect(depthForKind(stock, batched)).not.toBe(copy);
  geometry.dispose(); material.dispose(); map.dispose(); batched.dispose();
});
