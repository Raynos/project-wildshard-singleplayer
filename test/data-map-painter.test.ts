// oxlint-disable-next-line import/no-nodejs-modules -- Validate declared render payloads on disk.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay under the repository's tmp directory.
import { resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshGPUInstancing } from '@gltf-transform/extensions';
import { expect, test } from 'vitest';
import * as schema from 'valibot';
import { MapRaster, mapPixel, stylizeMap } from '../scripts/map-painter.mjs';
import { decodeTerrainTile, terrainTileHeight } from '../src/format/terrainTileBytes';
import terrain from '../src/shards/_template/data/terrain.json' with { type: 'json' };
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import { mapTilesHash } from '../scripts/map-hash.mjs';
import { paintMapScenes } from '../scripts/map-scenes.mjs';
import { mapRest } from '../scripts/bake-map-rest.mjs';
import { parseClientChannels } from '../src/format/clientChannels';
import isletScene from '../src/shards/far-reach/data/isletScenes.generated.json' with { type: 'json' };
import isletMotion from '../src/shards/far-reach/data/isletMotion.generated.json' with { type: 'json' };
import { nalatiMapAssembly } from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';
import nalatiPlacesJson from '../src/shards/nalati-grasslands/boot/placeRuntime.generated.json' with { type: 'json' };
import { nineMapAssembly } from '../src/shards/nine-dragon-stack/generators/mapAssembly.mjs';
import { pineMapAssembly } from '../src/shards/pine-hollow/generators/mapAssembly.mjs';
import pinePhysics from '../src/shards/pine-hollow/data/physicsRows.json' with { type: 'json' };
import nineWorld from '../src/shards/nine-dragon-stack/data/worldRows.generated.json' with { type: 'json' };

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
  const mesh = doc.createMesh('model').addPrimitive(primitive);
  const ext = doc.createExtension(EXTMeshGPUInstancing).setRequired(true);
  const translation = doc.createAccessor().setType('VEC3').setArray(new Float32Array([100, 8, -100, -100, 12, 100])).setBuffer(buffer);
  const node = doc.createNode('model').setMesh(mesh).setTranslation([5, 0, 5]).setExtension('EXT_mesh_gpu_instancing', ext.createInstancedMesh().setAttribute('TRANSLATION', translation));
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
    const recipe = { scene: { root: 'root', nodes: [{ kind: 'group', id: 'root', position: [100, 3, -100], children: ['part'] },
      { kind: 'mesh', id: 'part', geometry: 'model', position: [0, 5, 0] }] }, imports: [] };
    const assembly = new MapRaster();
    await paintMapScenes(assembly, { pools: ['scene.glb'], recipes: [{ file: 'recipe.json' }] }, {}, {
      input: () => file, json: () => recipe, bytes: () => new Uint8Array(),
    });
    expect(assembly.height[pixel(102, -98)]).toBe(8 * 65536);
    expect(assembly.height[pixel(-93, 107)]).toBe(-2147483648);
    await expect(paintMapScenes(new MapRaster(), { recipes: [{ file: 'recipe.json' }] }, {}, {
      input: () => file, json: () => recipe, bytes: () => new Uint8Array(),
    })).rejects.toThrow('Missing declared map geometry');
    const unplaced = { scene: { root: 'part', nodes: [{ kind: 'mesh', id: 'part', geometry: 'model', instances: 2 }] } };
    await expect(paintMapScenes(new MapRaster(), { pools: ['scene.glb'], recipes: [{ file: 'recipe.json' }] }, {}, {
      input: () => file, json: () => unplaced, bytes: () => new Uint8Array(),
    })).rejects.toThrow('Missing rest instance matrices');
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

// The same initial mover observations used by showRest fill every visual slot.
test('Sky resting matrices include every connector and exact group pose', () => {
  const snapshot = mapRest(isletScene.scene, parseClientChannels(isletMotion.channels), isletMotion.rest);
  expect(mapRest(isletScene.scene, parseClientChannels(isletMotion.channels), isletMotion.rest)).toEqual(snapshot);
  for (const [id, count] of Object.entries(isletMotion.counts)) {
    const row = snapshot.nodes[id];
    expect(row?.matrices).toHaveLength(count * 16);
    expect(row?.matrices?.every(Number.isFinite)).toBe(true);
  }
  for (const pose of isletMotion.rest.filter(row => !row.id.endsWith('.gate'))) {
    const id = pose.id.replace('far.', '');
    expect(snapshot.nodes[id]?.position).toEqual([pose.position.x, pose.position.y, pose.position.z]);
  }
  expect(snapshot.nodes['gates']?.matrices?.filter((_, index) => index % 16 !== 15).every(value => value === 0)).toBe(true);
  expect(() => mapRest(isletScene.scene, parseClientChannels(isletMotion.channels), [])).toThrow('Missing map rest pose');
  expect(() => mapRest(isletScene.scene, [], isletMotion.rest)).toThrow('Incomplete map rest instance slots');
});

test('Nalati map assembly covers every POI model copy at its admitted pose', async () => {
  const { assembly } = await nalatiMapAssembly();
  const nalatiPlaces = schema.parse(schema.object({ places: schema.object({ rows: schema.array(schema.object({ name: schema.string(), instances: schema.array(schema.tuple([schema.string(),
    schema.object({ placements: schema.array(schema.object({ x: schema.number(), y: schema.number(), z: schema.number() })) })])) })) }) }), nalatiPlacesJson);
  try {
    for (const place of nalatiPlaces.places.rows.filter(row => !row.name.startsWith('actor:'))) {
      for (const [id, model] of place.instances) {
        const name = `poi:${place.name}:model:${id}`, copies = assembly.nodes.find(row => row.name === name);
        expect(copies?.instances ?? 0).toBe(model.placements.length);
        for (const [i, pose] of model.placements.entries()) {
          expect(copies?.matrices.slice(i * 16 + 12, i * 16 + 15)).toEqual([pose.x, pose.y, pose.z].map(Math.fround));
        }
      }
    }
    expect(assembly.inventory['balbals']).toBe(12);
    expect(assembly.inventory['kokpar-riders']).toBe(6);
    expect(assembly.inventory['cloth']).toBe(1);
    expect(assembly.inventory['dressing:stone']).toBeGreaterThan(19000);
    for (const node of assembly.nodes) expect(node.matrices.every(Number.isFinite)).toBe(true);
    expect(Object.entries(assembly.inventory).filter(([name]) => /^spruce:\d+:trunk$/u.test(name)).reduce((sum, [, n]) => sum + n, 0)).toBe(146);
  } finally { for (const shape of assembly.shapes) shape.geometry.dispose(); }
});

test('Nine map contains every facade copy, queued set and rest mover', async () => {
  const { assembly } = await nineMapAssembly();
  try {
    for (const row of nineWorld.rows.facade.drawn) {
      const node = assembly.nodes.find(candidate => candidate.name === `facade:${row.id}`);
      expect(node?.instances).toBe(row.count);
      for (let i = 0; i < row.count; i++) expect(node?.matrices.slice(i * 16, (i + 1) * 16).map(value => value + 0))
        .toEqual(nineWorld.records.slice(row.poses + i * 19, row.poses + i * 19 + 16).map(value => Math.fround(value) + 0));
    }
    for (const row of nineWorld.rows.sets) expect(assembly.inventory[`set:${row.name}`]).toBe(row.frames.length);
    expect(assembly.inventory['portal-rings']).toBe(5);
    expect(assembly.inventory['dragon-hooks']).toBe(3);
    expect(assembly.inventory['facade-windows']).toBeGreaterThan(9000);
    expect(assembly.nodes.filter(node => node.name.startsWith('mover:'))).toHaveLength(4);
    for (const node of assembly.nodes) expect(node.matrices.every(Number.isFinite)).toBe(true);
  } finally { for (const shape of assembly.shapes) shape.geometry.dispose(); }
});

test('Pine rest assembly preserves every floor and native forest placement', async () => {
  const { assembly, trees, floor } = await pineMapAssembly();
  expect(trees).toHaveLength(pinePhysics.shelterTrees.length);
  for (const tree of trees) expect(pinePhysics.shelterTrees.some(row => row[0] === tree.x && row[1] === tree.z && row[2] === tree.r)).toBe(true);
  for (const [kind, rows] of Object.entries(floor.layout)) {
    const node = assembly.nodes.find(row => row.name === `floor:${kind}`);
    expect(node?.instances).toBe(rows.length);
    expect(node?.matrices.map(value => value === 0 ? 0 : value)).toEqual(rows.flatMap(row => Array.from(Float32Array.from(row.matrix), value => value === 0 ? 0 : value)));
  }
  expect(assembly.nodes.some(row => row.name.startsWith('weld:cabins.living:'))).toBe(true);
  expect(assembly.nodes.some(row => row.name.includes('cabins.desktop.true'))).toBe(true);
  expect(assembly.inventory['beaver-pool']).toBe(1);
  expect(assembly.inventory['pond']).toBe(1);
  expect(assembly.nodes.every(row => row.matrices.every(Number.isFinite))).toBe(true);
  for (const shape of assembly.shapes) shape.geometry.dispose();
});
