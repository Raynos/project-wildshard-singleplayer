// oxlint-disable-next-line import/no-nodejs-modules -- Compare emitted immutable bytes, not platform-specific float snapshots.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The bake consumes the committed native terrain authority.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Material, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { nalatiGroundSource, bakeNalatiGround } from '../scripts/bake/nalatiGroundSource';

const native = readFileSync(new URL('../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('Nalati native painted ground bake', () => {
  it('bakes exact native heights/indices and every painted channel into deterministic L0/L1 GLBs', async () => {
    const original = digest(native), source = nalatiGroundSource(native);
    expect(source.resolution).toBe(256); expect(source.positions.length / 3).toBe(65536);
    expect(source.indices.length / 3).toBe(130050);
    const view = new DataView(native.buffer, native.byteOffset, native.byteLength);
    for (let i = 0; i < 65536; i++) if (source.positions[i * 3 + 1] !== view.getFloat32(24 + i * 4, true)) throw new Error(`Native height changed at ${i}`);
    expect(Object.fromEntries(Object.entries(source.attributes).map(([name, channel]) => [name, channel.itemSize]))).toEqual({ normal: 3, color: 3, surf: 4, rdir: 2, zone: 3 });
    const first = bakeNalatiGround(source), second = bakeNalatiGround(nalatiGroundSource(native));
    expect(first.filter(row => row.tile.lod === 0)).toHaveLength(64);
    expect(first.filter(row => row.tile.lod === 1)).toHaveLength(16);
    expect(first.map(row => digest(row.bytes))).toEqual(second.map(row => digest(row.bytes)));
    expect(digest(native)).toBe(original);
    // Both LODs preserve the same original surface, including cliffs and entry holes/cuts.
    // Check shared emitted boundary vertices including all channels, with Float32 wire precision.
    for (const lod of [0, 1]) {
      const edges = new Map<string, number[]>(); let comparisons = 0;
      for (const { tile } of first.filter(row => row.tile.lod === lod)) for (let i = 0; i < tile.positions.length / 3; i++) {
        const x = tile.positions[i * 3], z = tile.positions[i * 3 + 2];
        if (x !== tile.bounds.min[0] && x !== tile.bounds.max[0] && z !== tile.bounds.min[2] && z !== tile.bounds.max[2]) continue;
        const values = [Math.fround(tile.positions[i * 3 + 1] ?? 0), ...Object.values(tile.attributes).flatMap(channel => Array.from(channel.values.subarray(i * channel.itemSize, (i + 1) * channel.itemSize), Math.fround))];
        const key = `${x}/${z}`, previous = edges.get(key);
        if (previous !== undefined) { expect(values).toEqual(previous); comparisons++; } else edges.set(key, values);
      }
      expect(comparisons).toBeGreaterThan(1000);
    }
    const row = first[0]; if (row === undefined) throw new Error('Missing baked ground');
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(row.bytes).buffer, '');
    let meshes = 0;
    loaded.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry: unknown = object.geometry;
      if (!(geometry instanceof BufferGeometry)) throw new Error('Missing loaded ground geometry');
      meshes++;
      for (const [semantic, name] of [['_surf', 'surf'], ['_rdir', 'rdir'], ['_zone', 'zone']] as const) {
        const expected = row.tile.attributes[name]; if (expected === undefined) throw new Error('Missing painted channel');
        const actual: unknown = geometry.getAttribute(semantic);
        if (!(actual instanceof BufferAttribute)) throw new Error('Missing loaded painted channel');
        expect(actual.itemSize).toBe(expected.itemSize);
        expect(Array.from(actual.array)).toEqual(Array.from(expected.values, Math.fround));
      }
      geometry.dispose();
      const material: unknown = object.material;
      for (const value of Array.isArray(material) ? material : [material]) {
        if (!(value instanceof Material)) throw new Error('Missing loaded ground material');
        value.dispose();
      }
    });
    expect(meshes).toBe(1);
    expect(first.every(entry => entry.cost.draws === 1 && entry.cost.decoded > 0 && entry.cost.gpu > 0)).toBe(true);
  }, 120_000); // Two complete native-world bakes share CPU in the parallel gate; elapsed time is not an assertion.

  it('refuses a non-native grid before painting', () => {
    const changed = Uint8Array.from(native); new DataView(changed.buffer).setUint32(16, 1337, true);
    expect(() => nalatiGroundSource(changed)).toThrow('original native WSTR256');
  });
});
