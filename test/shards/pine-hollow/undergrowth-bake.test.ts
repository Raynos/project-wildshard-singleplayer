import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute, InstancedMesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete typed geometry byte blocks.
import { Buffer } from 'node:buffer';
import { PINE_SEED, bakePineUndergrowth, pineUndergrowthBake } from '../../../src/shards/pine-hollow/generators/undergrowth';
import { PineSeedStream } from '../../../src/shards/pine-hollow/generators/seedStream';
import { Rng } from '@wildshard/engine/core/rng';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { UnderShapesSchema } from '../../../src/shards/pine-hollow/world/undergrowthKit';
import committed from '../../../src/shards/pine-hollow/data/undergrowth.json' with { type: 'json' };

const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

describe('Pine Hollow bakes its undergrowth shapes offline (G285)', () => {
  it('the committed shapes are exact against their generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-undergrowth.mjs)', () => {
    expect(bakePineUndergrowth()).toEqual(committed);
    // the shapes' streams are the level seed's, as the page's engine SEED is while the floor builds
    expect(PINE_SEED).toBe(PINE_HOLLOW.seed);
  });

  it('every shape is whole: f32-exact attributes, unit normals, triangles in range', () => {
    for (const [kind, s] of Object.entries(v.parse(UnderShapesSchema, committed))) {
      const n = s.position.length / 3;
      expect(n, kind).toBeGreaterThanOrEqual(4);
      expect(s.normal.length, kind).toBe(n * 3);
      expect(s.uv.length, kind).toBe(n * 2);
      expect(s.index.length % 3, kind).toBe(0);
      expect(s.index.every((i) => i < n), kind).toBe(true);
      expect([...s.position, ...s.normal, ...s.uv].every((x) => Math.fround(x) === x), kind).toBe(true);
      for (let i = 0; i < n; i++) expect(Math.hypot(s.normal[i * 3] ?? 0, s.normal[i * 3 + 1] ?? 0, s.normal[i * 3 + 2] ?? 0)).toBeCloseTo(1, 5);
    }
  });

  it('keeps the author streams exact against the native generator for all three seeds', () => {
    for (const offset of [606, 607, 608]) {
      const native = new Rng(PINE_SEED + offset), authored = new PineSeedStream(PINE_SEED + offset);
      for (let sample = 0; sample < 10000; sample++) {
        expect(authored.next()).toBe(native.next());
        expect(authored.range(-0.3, 0.3)).toBe(native.range(-0.3, 0.3));
      }
    }
  });

  it('bakes every shape through one Scene with original typed channels and index width', async () => {
    const baked = pineUndergrowthBake(), piece = baked.pieces[0];
    if (piece === undefined) throw new Error('Undergrowth library omitted');
    expect(baked.pieces).toHaveLength(1);
    expect(piece.name).toBe('pine.undergrowth');
    expect(piece.kinds.map(row => row.name)).toEqual(Object.keys(committed));
    expect(baked.shardfile.tiles).toHaveLength(0);
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(piece.glb).buffer, '');
    const meshes: InstancedMesh[] = [];
    loaded.scene.traverse(node => { if (instanced(node)) meshes.push(node); });
    expect(meshes).toHaveLength(6);
    for (const [i, shape] of Object.values(committed).entries()) {
      const mesh = meshes[i];
      if (mesh === undefined) throw new Error('Missing undergrowth shape');
      expect(mesh.count).toBe(1);
      for (const [channel, values] of [['position', shape.position], ['normal', shape.normal], ['uv', shape.uv]] as const) {
        const attribute = mesh.geometry.getAttribute(channel);
        if (!(attribute instanceof BufferAttribute)) throw new Error(`Missing ${channel}`);
        expect(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength).equals(
          new Uint8Array(Float32Array.from(values).buffer)), `${String(i)} ${channel}`).toBe(true);
      }
      const index = mesh.geometry.getIndex();
      if (index === null) throw new Error('Missing triangles');
      expect(index.array).toBeInstanceOf(Uint16Array);
      expect(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength).equals(
        new Uint8Array(Uint16Array.from(shape.index).buffer))).toBe(true);
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
  });
});
