import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { FilesSchema } from '../src/format/shardSections';
import { NearPlaceholderSchema, nearPlaceholderCost, nearPlaceholderRoots, NEAR_PLACEHOLDER_LIMITS } from '../src/format/nearPlaceholder';
import { validateNearPlaceholderAssets } from '../src/format/nearPlaceholderAssets';
import { encodeTerrainTile } from '../src/format/terrainTileBytes';
import { BufferAttribute, BufferGeometry, Matrix4, MeshStandardMaterial } from 'three';
import { staticGlb } from '../src/sdk/bake/glb';

type FileRow = v.InferOutput<typeof FilesSchema>[number];
const hash = (n: number): string => n.toString(16).padStart(64, '0');
function file(n: number, kind: FileRow['kind'], dependencies: string[] = []): FileRow {
  return { hash: hash(n), kind, compressed: 100, decoded: 200, gpu: 300, triangles: 2, draws: 1, dependencies, critical: false };
}
const emptyCommons = { commonsCosts: {}, commonsWire: {} };
const terrain = Array.from({ length: 16 }, (_, n) => ({ x: n % 4, z: Math.floor(n / 4), file: hash(n + 1) }));
const terrainFiles = terrain.map((_tile, n) => file(n + 1, 'binary'));

describe('G342 immutable visual near-placeholder contracts', () => {
  it('admits a complete L1 grid or content-only mesh world and retains exact JSON rows', () => {
    const row = { version: 1, terrain, content: [hash(17)] };
    expect(v.parse(NearPlaceholderSchema, row)).toEqual(row);
    expect(nearPlaceholderRoots(v.parse(NearPlaceholderSchema, row))).toEqual([...terrain.map(tile => tile.file), hash(17)]);
    expect(v.parse(NearPlaceholderSchema, { version: 1, terrain: [], content: [hash(17)] }).content).toEqual([hash(17)]);
    expect(nearPlaceholderRoots(undefined)).toEqual([]);
  });
  it('refuses partial grids, duplicate addresses/roots, URLs, collider fields and callable rows', () => {
    const valid = { version: 1, terrain, content: [hash(17)] };
    for (const row of [{ ...valid, terrain: terrain.slice(1) },
      { ...valid, terrain: [...terrain.slice(1), terrain[1]] },
      { ...valid, content: [hash(17), hash(17)] }, { ...valid, content: ['/assets/near.glb'] },
      { ...valid, colliders: [] }, { ...valid, content: () => [hash(17)] },
      { ...valid, terrain: [], content: [] }]) expect(v.safeParse(NearPlaceholderSchema, row).success).toBe(false);
  });
  it('deduplicates dependencies across content meshes and charges every decoded/GPU byte', () => {
    const near = v.parse(NearPlaceholderSchema, { version: 1, terrain, content: [hash(17), hash(18)] });
    const costs = nearPlaceholderCost(near, { files: [...terrainFiles, file(17, 'glb', [hash(19)]), file(18, 'glb', [hash(19)]), file(19, 'ktx2')], requires: emptyCommons });
    expect(costs.terrain).toEqual({ resident: 8000, compressed: 1600, triangles: 32, draws: 16 });
    expect(costs.content).toEqual({ resident: 1500, compressed: 300, triangles: 6, draws: 3 });
    expect(costs.total.resident).toBe(9500);
  });
  it('charges declared commons once and refuses missing cost/wire metadata', () => {
    const shared = `commons:${hash(19)}`, near = v.parse(NearPlaceholderSchema, { version: 1, terrain: [], content: [hash(17), hash(18)] });
    const files = [file(17, 'glb', [shared]), file(18, 'glb', [shared])];
    const requires = { commonsCosts: { [hash(19)]: { decoded: 400, gpu: 500, triangles: 0, draws: 0 } }, commonsWire: { [hash(19)]: 100 } };
    expect(nearPlaceholderCost(near, { files, requires }).total.resident).toBe(1900);
    expect(() => nearPlaceholderCost(near, { files, requires: emptyCommons })).toThrow('commons cost');
  });
  it('refuses missing, wrong-kind, executable, critical and cyclic dependencies before allocation', () => {
    const near = v.parse(NearPlaceholderSchema, { version: 1, terrain: [], content: [hash(17)] });
    expect(() => nearPlaceholderCost(near, { files: [], requires: emptyCommons })).toThrow('GLB');
    expect(() => nearPlaceholderCost(near, { files: [file(17, 'binary')], requires: emptyCommons })).toThrow('GLB');
    expect(() => nearPlaceholderCost(near, { files: [file(17, 'glb', [hash(18)])], requires: emptyCommons })).toThrow('missing dependency');
    expect(() => nearPlaceholderCost(near, { files: [file(17, 'glb', [hash(18)]), file(18, 'wasm')], requires: emptyCommons })).toThrow('visual assets');
    expect(() => nearPlaceholderCost(near, { files: [{ ...file(17, 'glb'), critical: true }], requires: emptyCommons })).toThrow('GLB');
    expect(() => nearPlaceholderCost(near, { files: [file(17, 'glb', [hash(18)]), file(18, 'glb', [hash(17)])], requires: emptyCommons })).toThrow('cycle');
  });
  it('bounds terrain and content using the reviewed limits rather than author-provided cost exemptions', () => {
    const near = v.parse(NearPlaceholderSchema, { version: 1, terrain: [], content: [hash(17)] });
    const exact = { ...file(17, 'glb'), decoded: NEAR_PLACEHOLDER_LIMITS.contentBytes, gpu: 0 };
    expect(nearPlaceholderCost(near, { files: [exact], requires: emptyCommons }).total.resident).toBe(NEAR_PLACEHOLDER_LIMITS.contentBytes);
    expect(() => nearPlaceholderCost(near, { files: [{ ...exact, gpu: 1 }], requires: emptyCommons })).toThrow('residency limit');
    const terrainOnly = v.parse(NearPlaceholderSchema, { version: 1, terrain, content: [] });
    const oversized = terrainFiles.map(row => {
      const copy = structuredClone(row); copy.decoded = NEAR_PLACEHOLDER_LIMITS.terrainBytes; copy.gpu = 0; return copy;
    });
    expect(() => nearPlaceholderCost(terrainOnly, { files: oversized, requires: emptyCommons })).toThrow('residency limit');
  });
  it('validates actual L1 visual heights/colours and rejects missing, relocated or collider-only payloads', () => {
    const near = v.parse(NearPlaceholderSchema, { version: 1, terrain, content: [] });
    const assets = new Map(terrain.map(tile => [tile.file, encodeTerrainTile({ resolution: 17, size: 125,
      x: -250 + tile.x * 125, z: -250 + tile.z * 125, heights: new Float32Array(17 ** 2), colours: new Float32Array(17 ** 2 * 3) })]));
    expect(() => validateNearPlaceholderAssets(near, assets)).not.toThrow();
    expect(() => validateNearPlaceholderAssets(near, new Map())).toThrow('Missing');
    const first = terrain[0]; if (first === undefined) throw new Error('Missing terrain fixture');
    const changed = new Map(assets);
    changed.set(first.file, encodeTerrainTile({ resolution: 17, size: 125, x: -125, z: -250, heights: new Float32Array(17 ** 2), colours: new Float32Array(17 ** 2 * 3) }));
    expect(() => validateNearPlaceholderAssets(near, changed)).toThrow('declared');
    changed.set(first.file, encodeTerrainTile({ resolution: 17, size: 125, x: -250, z: -250, heights: new Float32Array(17 ** 2) }));
    expect(() => validateNearPlaceholderAssets(near, changed)).toThrow('coloured');
  });
  it('checks real transformed GLB vertices instead of trusting declared accessor bounds', () => {
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)).setIndex([0, 1, 2]);
    const material = new MeshStandardMaterial(), near = v.parse(NearPlaceholderSchema, { version: 1, terrain: [], content: [hash(17)] });
    try {
      const valid = staticGlb([{ geometry, material, castShadow: false }]);
      expect(() => validateNearPlaceholderAssets(near, new Map([[hash(17), valid]]))).not.toThrow();
      const outside = staticGlb([{ geometry, material, instances: [new Matrix4().makeTranslation(251, 0, 0)], castShadow: false }]);
      expect(() => validateNearPlaceholderAssets(near, new Map([[hash(17), outside]]))).toThrow('cell bounds');
    } finally { geometry.dispose(); material.dispose(); }
  });
});
