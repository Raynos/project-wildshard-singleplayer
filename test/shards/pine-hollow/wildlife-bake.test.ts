import { describe, expect, it } from 'vitest';
import { BufferAttribute, InstancedMesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete native byte blocks without matcher traversal.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs the byte-exact half where the bake was made.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { unshuffleLanes } from '@wildshard/game/plugin/geometry';
import { KIND, WILD_BAKE_KINDS, WILD_ROWS, WildlifeMesh, useWildShapes, wildShapes, wildlifeGlbShapes, WILDLIFE_BAKE_URL } from '../../../src/shards/pine-hollow/models/wildlife';
import committed from '../../../src/shards/pine-hollow/data/wildlife.json' with { type: 'json' };
import { bakeWildlifeRows } from '../../../src/shards/pine-hollow/generators/bake-pine-wildlife.mjs';
import { pineWildlifeBake } from '../../../src/shards/pine-hollow/generators/wildlife';
import * as identities from '../../../src/shards/pine-hollow/data/wildlifeKinds';
import type { SkyRig } from '@wildshard/engine/world/skyRig';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/wildlife.bin', import.meta.url)))));
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

describe('Pine Hollow bakes its procedural wildlife offline (G285)', () => {
  // Math.sin / hypot in the mottling and the ellipsoids: byte-exact where the bake was made (macOS)
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-wildlife.mjs)', () => {
    const { rows, bin } = bakeWildlifeRows();
    expect(rows).toEqual(committed);
    expect(Buffer.from(shipped()).equals(bin)).toBe(true);
  });

  it('authors the four models through bake(scene) with every native channel and triangle byte-exact', async () => {
    expect(identities.KIND).toEqual(KIND);
    expect(identities.WILD_BAKE_KINDS).toEqual(WILD_BAKE_KINDS);
    const baked = pineWildlifeBake(), part = baked.pieces[0];
    if (part === undefined) throw new Error('Wildlife library omitted');
    expect(baked.pieces).toHaveLength(1);
    expect(part.name).toBe('pine.wildlife');
    expect(part.kinds.map(row => row.name)).toEqual(WILD_BAKE_KINDS.map(kind => `wildlife-${String(kind)}`));
    expect(baked.colliders).toEqual({ scene: [], props: [], pieces: [{ piece: 'pine.wildlife', colliders: [] }] });
    // These are moving model-library shapes, not static placements or a substitute terrain tile.
    expect(baked.shardfile.tiles).toHaveLength(0);
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(part.glb).buffer, '');
    const models: InstancedMesh[] = [];
    loaded.scene.traverse(node => { if (instanced(node)) models.push(node); });
    expect(models).toHaveLength(4);
    const shapes = wildShapes(shipped());
    const admitted = wildlifeGlbShapes(new Map(models.map((mesh, i) => [part.kinds[i]?.name ?? '', mesh])));
    expect(WILDLIFE_BAKE_URL).toBe('/assets/pine-hollow/baked/wildlife.glb');
    for (const [i, kind] of WILD_BAKE_KINDS.entries()) {
      const mesh = models[i], shape = shapes.get(kind);
      if (mesh === undefined || shape === undefined) throw new Error('Missing wildlife kind');
      expect(mesh.count).toBe(1);
      const actual = admitted.get(kind);
      if (actual === undefined) throw new Error('Missing admitted kind');
      for (const key of ['pos', 'nor', 'col', 'pivot', 'info', 'tex', 'idx'] as const) {
        expect(Buffer.from(actual[key].buffer, actual[key].byteOffset, actual[key].byteLength).equals(
          new Uint8Array(shape[key].buffer, shape[key].byteOffset, shape[key].byteLength)), `${String(kind)} ${key}`).toBe(true);
      }
      for (const [name, expected] of [
        ['position', shape.pos], ['normal', shape.nor], ['color', shape.col],
        ['_pivot', shape.pivot], ['_info', shape.info], ['_tex', shape.tex],
      ] as const) {
        const attribute = mesh.geometry.getAttribute(name);
        if (!(attribute instanceof BufferAttribute)) throw new Error(`Missing packed wildlife channel ${name}`);
        expect(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength).equals(
          new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength)), `${String(kind)} ${name}`).toBe(true);
      }
      const index = mesh.geometry.getIndex();
      if (index === null) throw new Error('Missing wildlife triangles');
      expect(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength).equals(
        new Uint8Array(shape.idx.buffer, shape.idx.byteOffset, shape.idx.byteLength))).toBe(true);
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
  });

  it('refuses incomplete or malformed authored wildlife without falling back to the private binary', async () => {
    const part = pineWildlifeBake().pieces[0];
    if (part === undefined) throw new Error('Wildlife library omitted');
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(part.glb).buffer, '');
    const models: InstancedMesh[] = [];
    loaded.scene.traverse(node => { if (instanced(node)) models.push(node); });
    const nodes = new Map(models.map((mesh, i) => [part.kinds[i]?.name ?? '', mesh]));
    expect(() => wildlifeGlbShapes(new Map())).toThrow(/missing authored kind/u);
    const first = nodes.get('wildlife-0');
    if (first === undefined) throw new Error('Missing raven');
    first.geometry.deleteAttribute('_pivot');
    expect(() => wildlifeGlbShapes(nodes)).toThrow(/invalid authored _pivot/u);
    for (const mesh of models) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
  });

  it('decodes into the four kinds in order, triangles in range, and the one shared draw holds them all', () => {
    const shapes = wildShapes(shipped());
    expect([...shapes.keys()]).toEqual(WILD_BAKE_KINDS);
    for (const { kind, vertices, indices } of WILD_ROWS.kinds) {
      const s = shapes.get(kind);
      expect(s?.pos.length).toBe(vertices * 3);
      expect(s?.info.length).toBe(vertices * 4);
      expect(indices % 3).toBe(0);
      expect(Array.from(s?.idx ?? []).every((i) => i < vertices)).toBe(true);
      // every vertex carries its own kind (the vertex shader collapses the others)
      expect(Array.from(s?.info ?? []).filter((_, i) => i % 4 === 1).every((k) => k === kind)).toBe(true);
    }
    useWildShapes(shipped());
    const sky: Pick<SkyRig, 'setupMaterial'> = { setupMaterial: () => undefined };
    const mesh = new WildlifeMesh(sky as SkyRig, 4);
    expect(mesh.vertexCount).toBe(WILD_ROWS.kinds.reduce((n, k) => n + k.vertices, 0));
    expect(mesh.mesh.geometry.getIndex()?.array).toBeInstanceOf(Uint16Array);
    expect(WILD_ROWS.kinds.at(-1)?.kind).toBe(KIND.hare);
  });
});
