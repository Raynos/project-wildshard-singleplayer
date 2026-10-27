import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Sphere } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { decodeRoadTile, encodeRoadTile, loadRoadTile, persistRoadTile, type RoadTileStore } from './roadTileArchive';
import type { RoadTileGeometry } from './roadTileGeometry';

function fixture(): RoadTileGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  geometry.setAttribute('color', new BufferAttribute(Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255]), 3, true));
  const index = Uint32Array.from([0, 1, 2, 2, 1, 0]); geometry.setIndex(new BufferAttribute(index, 1));
  return { geometry, plan: { source: index, lod: [150], bins: [{ sphere: new Sphere(), start: 0, count: 3,
    levels: [{ start: 3, count: 3 }], tile: { x: -1, z: 2 } }] }, bytes: { jsBytes: 93, gpuBytes: 69 } };
}

test('road backing round-trips scalar bytes, normalized colour and every LOD independently', () => {
  const original = fixture(), packed = encodeRoadTile(original), tile = decodeRoadTile(packed);
  expect(tile.bytes).toEqual(original.bytes);
  expect(tile.plan.bins[0]?.tile).toEqual({ x: -1, z: 2 });
  expect(tile.plan.bins[0]?.levels).toEqual([{ start: 3, count: 3 }]);
  expect(Array.from(tile.plan.source)).toEqual([0, 1, 2, 2, 1, 0]);
  const colour = tile.geometry.getAttribute('color');
  expect(colour.normalized).toBe(true); expect(colour.array).toBeInstanceOf(Uint8Array);
  packed.fill(0); original.geometry.getAttribute('position').setX(0, 500);
  expect(tile.geometry.getAttribute('position').getX(0)).toBe(0); expect(colour.array[0]).toBe(255);
  original.geometry.dispose(); tile.geometry.dispose();
});

test('invalid archive bounds and byte plans refuse before geometry publication', () => {
  const original = fixture(), packed = encodeRoadTile(original);
  const length = packed.slice(); new DataView(length.buffer).setUint32(0, 100_000, true);
  expect(() => decodeRoadTile(length)).toThrow('header length');
  expect(() => decodeRoadTile(packed.subarray(0, -1))).toThrow('size mismatch');
  expect(() => encodeRoadTile({ ...original, bytes: { jsBytes: 0, gpuBytes: 0 } })).toThrow('byte plan mismatch');
  original.geometry.dispose();
});

test('durable refs pin to their owner and reload rejects poisoned storage', async () => {
  const scope = new Scope('road archive'), child = scope.child('loaded'), original = fixture(), bodies = new Map<string, Uint8Array>();
  let pins = 0, released = 0;
  const store: RoadTileStore = {
    put: (hash, bytes) => { bodies.set(hash, Uint8Array.from(bytes)); return Promise.resolve(true); },
    get: hash => Promise.resolve(bodies.get(hash) ?? null),
    pin: () => { pins++; let active = true; return () => { if (active) { active = false; released++; } }; },
  };
  const ref = await persistRoadTile(scope, store, original);
  expect(pins).toBe(1); expect(released).toBe(0);
  const tile = await loadRoadTile(child, store, ref); expect(tile.bytes).toEqual(original.bytes);
  const poisoned = bodies.get(ref.hash); if (poisoned === undefined) throw new Error('Missing stored road tile');
  poisoned.fill(0);
  await expect(loadRoadTile(child, store, ref)).rejects.toThrow('archive unavailable');
  scope.dispose(); expect(released).toBe(1); original.geometry.dispose();
});

test('quota refusal releases the provisional pin and preserves original geometry', async () => {
  const scope = new Scope('road refusal'), original = fixture(); let releases = 0;
  const store: RoadTileStore = { get: () => Promise.resolve(null), put: () => Promise.resolve(false), pin: () => () => { releases++; } };
  await expect(persistRoadTile(scope, store, original)).rejects.toThrow('storage refused');
  expect(releases).toBe(1); expect(original.geometry.getAttribute('position').count).toBe(3);
  scope.dispose(); expect(releases).toBe(1); original.geometry.dispose();
});
