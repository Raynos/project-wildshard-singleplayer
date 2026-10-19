import { BufferGeometry, Float32BufferAttribute } from 'three';
import waterRows from '../src/shards/nalati-grasslands/data/water.generated.json' with { type: 'json' };
import { waterSceneBlob, terrainSceneBlobs } from '../src/shards/nalati-grasslands/generators/terrainScene';
import { expect, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the retained native terrain input of the offline baker.
import { readFileSync } from 'node:fs';
import { bakeNalatiWorldRows } from '../src/shards/nalati-grasslands/generators/nalatiWorldRows';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { TERRAIN } from '../src/shards/nalati-grasslands/generators/terrainRecipe';
import { buildPainterlyGeometry, buildPainterlySlab } from '../src/shards/nalati-grasslands/generators/terrainPainter';
import { TERRAIN_PAINT_SOURCE } from '../src/shards/nalati-grasslands/generators/nalatiGroundSource';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseWorldScene } from '../src/format/clientChannels';
import terrainScene from '../src/shards/nalati-grasslands/data/terrainScene.json' with { type: 'json' };

const Geometry = v.object({ meshes: v.array(v.object({ primitives: v.array(v.object({ attributes: v.record(v.string(), v.number()) })) })) });

test('bakes repeatable native ground tiles with every painter channel and the unchanged collision witness', () => {
  const native = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  const first = bakeNalatiWorldRows(native, [], 'nalati.ground');
  const second = bakeNalatiWorldRows(native, [], 'nalati.ground');
  expect(second.files).toEqual(first.files);
  expect(second.tiles).toEqual(first.tiles);
  const collision = first.assets.get(first.nativeGround.file);
  if (collision === undefined) throw new Error('Missing native collision witness');
  expect(hashImmutableBytes(collision)).toBe(hashImmutableBytes(native));
  expect(first.critical).toContain(first.nativeGround.file);
  expect(new Set(first.tiles.map(tile => `${tile.lod}/${tile.x}/${tile.z}`)).size).toBe(first.tiles.length);
  expect(first.tiles.some(tile => tile.lod === 0)).toBe(true);
  expect(first.tiles.some(tile => tile.lod === 1)).toBe(true);
  for (const row of first.files) {
    const bytes = first.assets.get(row.hash);
    if (bytes === undefined) throw new Error('Missing baked tile payload');
    expect(hashImmutableBytes(bytes)).toBe(row.hash);
    const repeated = second.assets.get(row.hash);
    if (repeated === undefined) throw new Error('Missing repeated tile payload');
    expect(hashImmutableBytes(repeated)).toBe(row.hash);
    if (row.kind !== 'glb') continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const json = new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true)));
    const gltf = v.parse(Geometry, JSON.parse(json));
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      expect(Object.keys(primitive.attributes)).toEqual(expect.arrayContaining(['POSITION', 'NORMAL', 'COLOR_0', '_SURF', '_RDIR', '_ZONE']));
    }
  }
}, 30_000);


test('restores both native terrain draws with exact typed channels and index storage', async () => {
  expect(parseWorldScene(terrainScene).scene.nodes.map(node => node.id)).toEqual(['root', 'ground', 'slab']);
  const native = readNativeTerrain(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')));
  const field = { ...native, ready: () => Promise.resolve(true), trails: () => TERRAIN.trails, trailDistance: TERRAIN.trailDistance };
  const builder = buildPainterlyGeometry(field, TERRAIN_PAINT_SOURCE);
  let step = builder.next();
  while (step.done !== true) step = builder.next();
  const originals = new Map([['world/terrain/ground.glb', step.value], ['world/terrain/slab.glb', buildPainterlySlab(field, TERRAIN_PAINT_SOURCE)]]);
  try {
    const blobs = terrainSceneBlobs(field, TERRAIN_PAINT_SOURCE);
    expect(blobs.map(blob => blob.file.name)).toEqual([...originals.keys()]);
    for (const blob of blobs) {
      const name = blob.file.name;
      if (name === undefined) throw new Error('Terrain blob needs its logical name');
      const original = originals.get(name);
      if (original === undefined) throw new Error('Unexpected terrain draw');
      const intake = createOwnedGeometry(name);
      await intake.load(blob.bytes);
      const restored = intake.take();
      try {
        expect(Object.keys(restored.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
        for (const channel of Object.keys(original.attributes)) {
          const actual = restored.getAttribute(channel), expected = original.getAttribute(channel);
          expect(actual.array.constructor).toBe(expected.array.constructor);
          expect(actual.itemSize).toBe(expected.itemSize);
          expect(actual.normalized).toBe(expected.normalized);
          expect(hashImmutableBytes(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength)))
            .toBe(hashImmutableBytes(new Uint8Array(expected.array.buffer, expected.array.byteOffset, expected.array.byteLength)));
        }
        expect(restored.getIndex()?.array.constructor).toBe(original.getIndex()?.array.constructor);
        expect(restored.getIndex()?.array).toEqual(original.getIndex()?.array);
        restored.computeBoundingSphere();
        expect(restored.boundingSphere).toEqual(original.boundingSphere);
      } finally { restored.dispose(); }
    }
  } finally { for (const geometry of originals.values()) geometry.dispose(); }
}, 30_000);


test('moves the water draw out of private JSON without changing its GPU channels', async () => {
  const original = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(waterRows.position, 3))
    .setAttribute('aWater', new Float32BufferAttribute(waterRows.water, 4)).setIndex(waterRows.index);
  const intake = createOwnedGeometry('world/water.glb');
  try {
    await intake.load(waterSceneBlob(waterRows).bytes);
    const restored = intake.take();
    try {
      expect(Object.keys(restored.attributes)).toEqual(Object.keys(original.attributes));
      for (const channel of ['position', 'aWater']) {
        const a = restored.getAttribute(channel), b = original.getAttribute(channel);
        expect(a.itemSize).toBe(b.itemSize);
        expect(hashImmutableBytes(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)))
          .toBe(hashImmutableBytes(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)));
      }
      expect(restored.getIndex()?.array.constructor).toBe(original.getIndex()?.array.constructor);
      expect(restored.getIndex()?.array).toEqual(original.getIndex()?.array);
    } finally { restored.dispose(); }
  } finally { original.dispose(); }
});
