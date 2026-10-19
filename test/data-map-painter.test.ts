// oxlint-disable-next-line import/no-nodejs-modules -- Validate declared render payloads on disk.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay under the repository's tmp directory.
import { resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshGPUInstancing } from '@gltf-transform/extensions';
import { expect, test } from 'vitest';
import { MapRaster, mapPixel, stylizeMap } from '../scripts/map-painter.mjs';
import { decodeTerrainTile, terrainTileHeight } from '../src/format/terrainTileBytes';
import terrain from '../src/shards/_template/data/terrain.json' with { type: 'json' };
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import { mapTilesHash } from '../scripts/map-hash.mjs';

const grey = [[120, 120, 120], [120, 120, 120], [120, 120, 120]];
const triangle = [[200, 4, 200], [150, 4, 200], [200, 4, 150]];
test('map frame retains the full cell with +Z north and -X east', () => {
  expect(mapPixel(250, 250)).toEqual([0, 0]);
  expect(mapPixel(-250, -250)).toEqual([1000, 1000]);
  expect(mapPixel(0, 0)).toEqual([500, 500]);
  const raster = new MapRaster(100);
  raster.triangle(triangle, grey);
  expect(raster.height[12 * 100 + 12]).toBe(4 * 65536);
  expect(raster.height[87 * 100 + 87]).toBe(-2147483648);
});
test('depth, clipping and triangle winding preserve placed coverage', () => {
  const raster = new MapRaster(100, { clipAbove: 10 });
  raster.triangle(triangle, grey);
  raster.triangle(triangle.map(([x, _y, z]) => [x ?? 0, 50, z ?? 0]), grey);
  expect(raster.height[12 * 100 + 12]).toBe(4 * 65536);
  raster.triangle(triangle.map(([x, _y, z]) => [x ?? 0, 8, z ?? 0]).reverse(), grey);
  expect(raster.height[12 * 100 + 12]).toBe(8 * 65536);
});
test('actual template render tile keeps its placement and collision diagonal', () => {
  const tile = terrain.terrain.tiles.find(row => row.lod === 0 && row.x === 3 && row.z === 3);
  if (tile === undefined) throw new Error('Missing template render tile');
  const data = decodeTerrainTile(readFileSync(`src/shards/_template/assets/${tile.file}`));
  const raster = new MapRaster(100);
  raster.terrain(data);
  for (let y = 50; y < 62; y++) for (let x = 50; x < 62; x++) {
    const wx = 250 - (x + 0.5) * 5, wz = 250 - (y + 0.5) * 5;
    expect((raster.height[y * 100 + x] ?? 0) / 65536).toBeCloseTo(terrainTileHeight(data, wx, wz), 3);
  }
});
test('styling preserves every occupied pixel and deterministic bytes', () => {
  const raster = new MapRaster(100); raster.triangle(triangle, grey);
  const style = { kind: 'ground', void: 'transparent', classes: [{ match: '#787878', fill: '#cccccc' }] };
  const first = stylizeMap(raster, style);
  expect(stylizeMap(raster, style)).toEqual(first);
  for (let at = 0; at < raster.height.length; at++) expect(first[at * 4 + 3]).toBe(raster.height[at] === -2147483648 ? 0 : 255);
});
test('instanced GLB placements and fresh stamps survive deterministic regeneration', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/data-map-test-')), dir = resolve(root, 'src/shards/fixture');
  mkdirSync(resolve(dir, 'look'), { recursive: true });
  const doc = new Document(), buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0, 0, 10, 10, 0, 0])).setBuffer(buffer);
  const primitive = doc.createPrimitive().setAttribute('POSITION', positions);
  const mesh = doc.createMesh().addPrimitive(primitive);
  const ext = doc.createExtension(EXTMeshGPUInstancing).setRequired(true);
  const translation = doc.createAccessor().setType('VEC3').setArray(new Float32Array([100, 8, -100, -100, 12, 100])).setBuffer(buffer);
  const node = doc.createNode().setMesh(mesh).setTranslation([5, 0, 5]).setExtension('EXT_mesh_gpu_instancing', ext.createInstancedMesh().setAttribute('TRANSLATION', translation));
  doc.createScene().addChild(node);
  const file = resolve(dir, 'scene.glb'), io = new NodeIO().registerExtensions([EXTMeshGPUInstancing]);
  try {
    writeFileSync(file, await io.writeBinary(doc));
    writeFileSync(resolve(dir, 'look/map.json'), JSON.stringify({ why: 'fixture', inputs: ['scene.glb'], painter: { version: 1, glbs: ['scene.glb'] }, style: { kind: 'ground', void: 'transparent', classes: [{ match: '#ffffff', fill: '#cccccc' }] } }));
    const first = await paintDataMap(root, 'fixture');
    const pixel = (x: number, z: number): number => { const [u = 0, v = 0] = mapPixel(x, z); return Math.floor(v) * 1000 + Math.floor(u); };
    expect(first.raster.height[pixel(107, -93)]).toBe(8 * 65536);
    expect(first.raster.height[pixel(-93, 107)]).toBe(12 * 65536);
    expect(first.raster.height[pixel(0, 0)]).toBe(-2147483648);
    const image = resolve(root, 'public/assets/fixture/map/top.webp'), bytes = readFileSync(image);
    expect(first.stamp.tilesHash).toBe(mapTilesHash(dir));
    expect((await paintDataMap(root, 'fixture')).stamp).toEqual(first.stamp);
    expect(readFileSync(image)).toEqual(bytes);
    node.setTranslation([6, 0, 5]); writeFileSync(file, await io.writeBinary(doc));
    const moved = await paintDataMap(root, 'fixture');
    expect(moved.stamp.tilesHash).not.toBe(first.stamp.tilesHash);
    expect(moved.stamp.tilesHash).toBe(mapTilesHash(dir));
    expect(moved.stamp.pixelHash).not.toBe(first.stamp.pixelHash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
