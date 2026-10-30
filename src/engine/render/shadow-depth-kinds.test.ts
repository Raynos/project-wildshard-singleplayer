import { expect, test } from 'vitest';
import { BackSide, BatchedMesh, BoxGeometry, Color, DoubleSide, InstancedMesh, Mesh, MeshBasicMaterial, MeshDepthMaterial, Texture } from 'three';
import { depthForKind } from './shadowDepthKinds';

test('PF3: each caster kind draws its own copy of the stock depth material, as three set the stock for this draw', () => {
  const stock = new MeshDepthMaterial({ side: BackSide }), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const plain = new Mesh(geometry, material), instanced = new InstancedMesh(geometry, material, 2), batched = new BatchedMesh(2, 64, 64, material);
  // every caster draws a copy, the stock never; a DoubleSide one is its own program
  const forPlain = depthForKind(stock, plain);
  expect(forPlain).not.toBe(stock); expect(depthForKind(stock, plain)).toBe(forPlain);
  stock.side = DoubleSide; const doubled = depthForKind(stock, plain); stock.side = BackSide;
  expect(doubled).not.toBe(forPlain); expect(doubled.side).toBe(DoubleSide);
  // a caster that does not alpha-test binds no texture into the shadow pass
  const texture = new Texture(); stock.map = texture;
  expect(depthForKind(stock, plain).map).toBe(null);
  stock.map = null; texture.dispose();
  const forInstanced = depthForKind(stock, instanced), forBatched = depthForKind(stock, batched);
  expect(forInstanced).not.toBe(stock); expect(forBatched).not.toBe(stock); expect(forBatched).not.toBe(forInstanced);
  expect(depthForKind(stock, instanced)).toBe(forInstanced); // one copy a kind, kept
  const tinted = new BatchedMesh(2, 64, 64, material); tinted.addInstance(tinted.addGeometry(geometry)); tinted.setColorAt(0, new Color(1, 0, 0));
  expect(depthForKind(stock, tinted)).not.toBe(forBatched); // a batch with copy colours is its own program
  tinted.dispose();
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
