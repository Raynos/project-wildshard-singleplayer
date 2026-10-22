import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, HalfFloatType, Mesh } from 'three';
import { loadVertexWear, wearBakedTiles } from '../src/game/looks/vertexWear';
import ISLAND_COVER_FILES from '../src/shards/driftwood-isle/data/islandCoverFiles.json' with { type: 'json' };

// G571: a vertex wear file (Driftwood's island cover) worn by geometries the world already built.
const geometry = (count: number): BufferGeometry => new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
const row = { file: 'world/cover.bin', texture: { width: 2, height: 1 }, rect: [0, 0, 4, 4], parts: [[16, 3], [31, 2]],
  attributes: [{ name: 'aCover', size: 4 }, { name: 'aCoverSide', size: 1 }] };

test('each part wears its attributes as normalized views over the file, after the texture', async () => {
  const bytes = Uint8Array.from({ length: 41 }, (_, i) => i);
  const wear = await loadVertexWear({ file: () => Promise.resolve(bytes) }, row);
  expect(wear.texture?.image.width).toBe(2); expect(wear.texture?.type).toBe(HalfFloatType); expect(wear.rect).toEqual([0, 0, 4, 4]);
  const first = geometry(3), second = geometry(2);
  wear.wear(first, 0); wear.wear(second, 1);
  const cover = first.getAttribute('aCover'), side = first.getAttribute('aCoverSide'), later = second.getAttribute('aCoverSide');
  expect(cover.itemSize).toBe(4); expect(cover.normalized).toBe(true); expect(Array.from(cover.array)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
  expect(Array.from(side.array)).toEqual([28, 29, 30]); expect(Array.from(later.array)).toEqual([39, 40]);
});

test('a part baked for other geometry, an unknown part or a missing file refuses', async () => {
  const wear = await loadVertexWear({ file: () => Promise.resolve(new Uint8Array(41)) }, row);
  expect(() => { wear.wear(geometry(4), 0); }).toThrow('does not match');
  expect(() => { wear.wear(geometry(3), 2); }).toThrow('does not match');
  await expect(loadVertexWear({ file: () => Promise.reject(new Error('Required cover is missing')) }, row)).rejects.toThrow('missing');
  await expect(loadVertexWear({ file: () => Promise.resolve(new Uint8Array(41)) }, { ...row, attributes: [] })).rejects.toThrow();
});

test('Driftwood declares its island cover per tier for every baked part', () => {
  for (const tier of ['phone', 'desktop'] as const) expect(ISLAND_COVER_FILES[tier].parts.length).toBeGreaterThan(1);
});

test('a baked tile set wears its declared file: the ground as part 0, then each tile in order', async () => {
  const product = { file: () => Promise.resolve(Uint8Array.from({ length: 41 }, (_, i) => i)) };
  const wear = { files: { phone: row, desktop: row }, ground: true, looks: [] }, ground = geometry(3), tile = new Mesh(geometry(2));
  await wearBakedTiles(product, wear, 'phone', ground, [tile]);
  expect(Array.from(ground.getAttribute('aCoverSide').array)).toEqual([28, 29, 30]); expect(Array.from(tile.geometry.getAttribute('aCoverSide').array)).toEqual([39, 40]);
  await expect(wearBakedTiles(product, wear, 'phone', null, [tile])).rejects.toThrow('world ground');
  await expect(wearBakedTiles(product, { ...wear, ground: false }, 'phone', null, [new Mesh(geometry(2))])).rejects.toThrow('does not match');
});
