// oxlint-disable-next-line import/no-nodejs-modules -- Complete native geometry channels need strict typed-array equality.
import { deepStrictEqual } from 'node:assert';
// oxlint-disable-next-line import/no-nodejs-modules -- This producer proof reads its one committed AO input, never a generated handoff.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { CONTENT_CAPS } from '../src/format/contentBounds';
import { validateEntrywayClearance } from '../src/format/entryClearance';
import { prepareAssetDecoders, visitGlbTriangles } from '../src/format/product';
import { Entry } from '../src/sdk/entries';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { driftwoodCoarseTiles } from '../src/shards/driftwood-isle/generators/coarseTiles';
import { originalPiers } from '../src/shards/driftwood-isle/generators/driftwoodPiers';
import { driftwoodFixedSource } from '../src/shards/driftwood-isle/generators/fixedSource';
import { pierDeckAt } from '../src/shards/driftwood-isle/generators/pierLayout';

const ao = new Uint8Array(readFileSync('public/assets/models/driftwood-blender/voxel-ao.bin'));
let coarse: ReturnType<typeof driftwoodCoarseTiles>;
beforeAll(async () => { await prepareAssetDecoders(); coarse = driftwoodCoarseTiles(ao); });

test('every occupied coarse parent stays hash-bound, within the original budgets and clear of all four roads', () => {
  expect(new Set(coarse.tiles.map(tile => `${tile.x}/${tile.z}`)).size).toBe(coarse.tiles.length);
  for (const tile of coarse.tiles) {
    expect(tile.files.length).toBeGreaterThan(0);
    expect(tile.compressed).toBeLessThanOrEqual(CONTENT_CAPS.l1.compressed);
    expect(tile.decoded + tile.gpu).toBeLessThanOrEqual(CONTENT_CAPS.l1.resident);
    expect(tile.triangles).toBeLessThanOrEqual(CONTENT_CAPS.l1.triangles);
    expect(tile.draws).toBeLessThanOrEqual(CONTENT_CAPS.l1.draws);
    for (const hash of tile.files) {
      const bytes = coarse.assets.get(hash);
      if (bytes === undefined) throw new Error('Missing real coarse tile bytes');
      expect(hashImmutableBytes(bytes)).toBe(hash);
      expect(coarse.models.some(model => model.lod === 1 && model.x === tile.x && model.z === tile.z && model.file === hash)).toBe(true);
    }
  }
  expect(() => validateEntrywayClearance({ entryways: Entry.midpoints().map(entry => entry.toEntryData()), water: [],
    props: { version: 1, family: 'pbr', tiles: coarse.models, models: [], panels: [], far: null, colliders: [], textures: [] } }, coarse.assets)).not.toThrow();
});

test('all four authored pier decks have actual surfaces throughout their distant parent tiles', () => {
  const piers = originalPiers();
  try {
    const samples = piers.rows.flatMap(row => {
      const at = row.world; if (at === null) return [];
      const matrix = new Matrix4().makeRotationY(at.rot).setPosition(at.x, at.deckY, at.z);
      const start = (row.params.seaRamp?.run ?? 0) + 1, end = (row.params.landing?.rampFrom ?? row.params.length) - 1;
      return Array.from({ length: 9 }, (_, i) => {
        const along = start + (end - start) * i / 8;
        return { id: row.id, point: new Vector3(0, pierDeckAt(row.params, along), along).applyMatrix4(matrix), covered: false };
      });
    });
    expect(samples.length).toBe(36);
    for (const bytes of coarse.assets.values()) visitGlbTriangles(bytes, triangle => {
      const [a, b, c] = triangle;
      if (a === undefined || b === undefined || c === undefined) throw new Error('Missing coarse triangle');
      const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(denominator) < 1e-9) return;
      for (const sample of samples) {
        const p = sample.point, u = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / denominator;
        const v = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / denominator, w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-5 && Math.abs(a.y * u + b.y * v + c.y * w - p.y) < 0.04) sample.covered = true;
      }
    });
    expect(samples.filter(sample => !sample.covered).map(sample => ({ id: sample.id, point: sample.point.toArray() }))).toEqual([]);
  } finally { for (const geometry of piers.geometry.values()) geometry.dispose(); }
});

test('coarse placement facts leave the complete original near pier geometry and world ownership unchanged', () => {
  const fixed = driftwoodFixedSource(ao), original = originalPiers();
  try {
    deepStrictEqual(fixed.piers, original.rows);
    for (const [id, geometry] of original.geometry) {
      const actual = fixed.geometries.get(id);
      if (actual === undefined) throw new Error(`Missing original pier geometry ${id}`);
      deepStrictEqual(actual.index, geometry.index);
      deepStrictEqual(actual.attributes, geometry.attributes);
      expect(fixed.world.has(id)).toBe(false);
    }
  } finally {
    for (const geometry of fixed.geometries.values()) geometry.dispose();
    for (const geometry of original.geometry.values()) geometry.dispose();
  }
});
