// oxlint-disable-next-line import/no-nodejs-modules -- Read the original committed native lattice for exact painter parity.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { BufferGeometry } from 'three';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { buildPainterlyGeometry, buildPainterlySlab } from '../src/shards/nalati-grasslands/generators/terrainPainter';
import { TERRAIN_PAINT_SOURCE } from '../src/shards/nalati-grasslands/generators/nalatiGroundSource';
import { CHUNK_SIZE, CHUNK_DEPTH, TERRAIN_RES } from '../src/engine/core/config';
import original from './fixtures/nalati-painter-inputs.json' with { type: 'json' };
import { terrainSceneBlobs } from '../src/shards/nalati-grasslands/generators/terrainScene';

function identity(geometry: BufferGeometry): unknown {
  const channel = (name: string) => {
    const value = name === 'index' ? geometry.getIndex() : geometry.getAttribute(name);
    if (value === null) throw new Error('Missing native index');
    return { name, storage: value.array.constructor.name, count: value.count, width: value.itemSize, normalized: value.normalized,
      hash: hashImmutableBytes(new Uint8Array(value.array.buffer, value.array.byteOffset, value.array.byteLength)) };
  };
  const box = geometry.boundingBox, sphere = geometry.boundingSphere;
  const point = ({ x, y, z }: { readonly x: number; readonly y: number; readonly z: number }) => [x, y, z];
  return { channels: [...Object.keys(geometry.attributes), 'index'].map(channel),
    box: box === null ? null : { min: point(box.min), max: point(box.max) },
    sphere: sphere === null ? null : { center: point(sphere.center), radius: sphere.radius } };
}

// Captured from 2416816408 before changing the painter's field/grid boundary.
test('explicit native inputs retain all predecessor terrain channels, bounds, turns and blobs', () => {
  const native = readNativeTerrain(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')));
  const field = { ...native, trails: () => TERRAIN_PAINT_SOURCE.terrain.trails };
  const steps = buildPainterlyGeometry(field, TERRAIN_PAINT_SOURCE); let step = steps.next(), turns = 0;
  while (step.done !== true) { turns++; step = steps.next(); }
  const ground = step.value, slab = buildPainterlySlab(field, TERRAIN_PAINT_SOURCE);
  try {
    const result = { turns, ground: identity(ground), slab: identity(slab), blobs: terrainSceneBlobs(field, TERRAIN_PAINT_SOURCE).map(blob => ({ name: blob.file.name, length: blob.bytes.byteLength, hash: hashImmutableBytes(blob.bytes) })) };
    expect(result).toEqual(original);
    expect(native.grid.res).toBe(TERRAIN_RES);
    expect(native.grid.size).toBe(CHUNK_SIZE);
    expect(TERRAIN_PAINT_SOURCE.slabDepth).toBe(CHUNK_DEPTH);
  } finally { ground.dispose(); slab.dispose(); }
});

test('the painter samples its supplied lattice, normal field and slab depth', () => {
  const heights: [number, number][] = [], normals: number[] = [];
  const field = { grid: { res: 5, size: 12 }, trails: () => [],
    heightAt: (x: number, z: number) => { heights.push([x, z]); return 2; },
    normalAt: (_x: number, _z: number, epsilon?: number): [number, number, number] => { normals.push(epsilon ?? 0); return [0, 1, 0]; } };
  const source: typeof TERRAIN_PAINT_SOURCE = { ...TERRAIN_PAINT_SOURCE, slabDepth: 60,
    groundColor: (_x, _z, _height, _slope, _terrain, out) => { out[0] = 0.2; out[1] = 0.3; out[2] = 0.4; return out; } };
  const steps = buildPainterlyGeometry(field, source); let result = steps.next();
  expect(result.done).toBe(false); result = steps.next();
  if (result.done !== true) throw new Error('Small field should complete in its original single turn');
  const ground = result.value;
  expect(heights).toEqual(Array.from({ length: 25 }, (_, i) => [-6 + i % 5 * 3, -6 + Math.floor(i / 5) * 3]));
  const slab = buildPainterlySlab(field, source);
  try {
    const position = ground.getAttribute('position');
    expect(position.count).toBe(25);
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([-6, 2, -6]);
    expect([position.getX(24), position.getY(24), position.getZ(24)]).toEqual([6, 2, 6]);
    expect(ground.getIndex()?.count).toBe(4 * 4 * 6);
    expect(normals).toHaveLength(4 * 257);
    expect(new Set(normals)).toEqual(new Set([1.5]));
    const wall = slab.getAttribute('position');
    expect(Array.from(wall.array.slice(-12))).toEqual([-6, -60, -6, 6, -60, -6, 6, -60, 6, -6, -60, 6]);
    const failure = new Error('supplied sampler refused');
    expect(() => buildPainterlyGeometry({ ...field, heightAt: () => { throw failure; } }, source).next()).toThrow(failure);
    expect(() => buildPainterlySlab({ ...field, normalAt: () => { throw failure; } }, source)).toThrow(failure);
  } finally { ground.dispose(); slab.dispose(); }
});
