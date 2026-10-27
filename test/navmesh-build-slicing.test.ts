import { expect, test } from 'vitest';
import { addTile, buildTile, createNavMesh } from 'navcat';
import { buildNavmesh } from '../src/engine/physics/navmesh';
import type { NavigationLayerData } from '../src/format/navigationBytes';
import type { WorkSlice } from '../src/engine/core/workSlice';

function layer(): NavigationLayerData {
  return { radius: .3, height: 1.8, climb: .5, cellSize: .2, cellHeight: .1,
    origin: [0, 0, 0], tileSize: 4, tiles: [0, 1].map(x => ({
      tileX: x, tileY: 0, tileLayer: 0, bounds: [x * 4, 0, 0, x * 4 + 1, 0, 1],
      vertices: [x * 4, 0, 0, x * 4 + 1, 0, 0, x * 4, 0, 1],
      polys: [{ vertices: [0, 1, 2], neis: [0, 0, 0], flags: 1, area: 0 }],
      detailMeshes: [{ verticesBase: 0, verticesCount: 0, trianglesBase: 0, trianglesCount: 1 }],
      detailVertices: [], detailTriangles: [0, 1, 2, 0],
    })) };
}

function original(source: NavigationLayerData) {
  const mesh = createNavMesh();
  mesh.origin = source.origin; mesh.tileWidth = mesh.tileHeight = source.tileSize;
  for (const tile of source.tiles) addTile(mesh, buildTile({ ...tile, cellSize: source.cellSize,
    cellHeight: source.cellHeight, walkableHeight: source.height, walkableRadius: source.radius, walkableClimb: source.climb }));
  return mesh;
}

test('an unspent navigation slice builds every ordered tile before another microtask', async () => {
  const source = layer(), observations: number[] = [];
  let checks = 0;
  const slice: WorkSlice = { due: () => false, yield: () => Promise.reject(new Error('Unexpected yield')),
    check: () => { checks++; } };
  queueMicrotask(() => { observations.push(checks); });
  const nav = await buildNavmesh([source], 123, slice);
  expect(observations).toEqual([source.tiles.length]);
  expect(checks).toBe(source.tiles.length);
  expect(nav.bytes).toBe(123);
  expect(nav.layers[0]?.mesh).toEqual(original(source));
});

test('a real navigation pause blocks subsequent tiles and preserves the complete mesh', async () => {
  const source = layer();
  let checks = 0, resume: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  const slice: WorkSlice = { due: () => true, yield: () => gate,
    check: () => { checks++; return checks === 1 ? gate : undefined; } };
  const pending = buildNavmesh([source], 321, slice);
  await Promise.resolve();
  expect(checks).toBe(1);
  if (resume === undefined) throw new Error('Missing navigation pause');
  resume();
  const nav = await pending;
  expect(checks).toBe(source.tiles.length);
  expect(nav.layers[0]?.mesh).toEqual(original(source));
});

test('a navigation pause refusal still rejects the build before publication', async () => {
  const failure = new Error('Retired navigation owner');
  let checks = 0;
  const slice: WorkSlice = { due: () => true, yield: () => Promise.reject(failure),
    check: () => { checks++; return Promise.reject(failure); } };
  await expect(buildNavmesh([layer()], 0, slice)).rejects.toBe(failure);
  expect(checks).toBe(1);
});
