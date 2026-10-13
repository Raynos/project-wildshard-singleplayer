import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Full byte equality without typed-array deep traversal.
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assembleWholeGeometryViews, unshuffleLanes } from '@wildshard/game/plugin/geometry';
import { pineStreamBake } from '../../../src/shards/pine-hollow/generators/streams';
import { STREAM_ROWS, streamGeometry } from '../../../src/shards/pine-hollow/world/streams';
import committed from '../../../src/shards/pine-hollow/data/streams.json' with { type: 'json' };
import { bakeStreamRows, pineStreamGround } from '../../../src/shards/pine-hollow/generators/bake-pine-streams.mjs';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/streams.bin', import.meta.url)))));

describe('Pine Hollow bakes its running water offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-streams.mjs)', () => {
    const { rows, bin } = bakeStreamRows();
    expect(rows).toEqual(committed);
    expect(Buffer.from(shipped()).equals(bin)).toBe(true);
  });

  it('decodes into the one water mesh: position, uv, aWater, a 16-bit index, normals, bounds', () => {
    const g = streamGeometry(shipped());
    expect(Object.keys(g.attributes)).toEqual(['position', 'uv', 'aWater', 'normal']);
    expect(g.getAttribute('position').count).toBe(STREAM_ROWS.vertices);
    expect(g.getIndex()?.array).toBeInstanceOf(Uint16Array);
    expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(50);
    // the fall lands in the pond: the plunge is on the water, below the face's foot
    expect(STREAM_ROWS.plunge[1]).toBeLessThan(STREAM_ROWS.faceFoot[1]);
  });
});


it('bakes the actual water draw onto tiles and reconstructs all original channels and overhang vertices exactly', async () => {
  const authored = pineStreamBake(pineStreamGround()), props = authored.props;
  if (props === null) throw new Error('Water draw missing');
  expect(props.props.overhang).toBe(1); expect(authored.shardfile.tiles.length).toBeGreaterThan(1);
  expect(authored.colliders).toEqual({ scene: [], props: [], pieces: [] });
  const refs = new Set(props.props.tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? []))), nodes: THREE.Mesh[] = [];
  const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
  for (const ref of refs) {
    const bytes = authored.assets.get(ref); if (bytes === undefined) throw new Error('Water subset missing');
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    loaded.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
  }
  const assembled = assembleWholeGeometryViews(nodes), shape = assembled.get('pine-streams');
  if (shape === undefined) throw new Error('Original water draw missing');
  expect(assembled.size).toBe(1); expect(shape.matrix.equals(new THREE.Matrix4())).toBe(true);
  const original = streamGeometry(shipped()), actual = shape.geometry;
  expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
  for (const name of Object.keys(original.attributes)) {
    const a = actual.getAttribute(name), b = original.getAttribute(name);
    expect(a.itemSize).toBe(b.itemSize);
    expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)), name).toBe(true);
  }
  const a = actual.getIndex(), b = original.getIndex();
  if (a === null || b === null) throw new Error('Original water triangles missing');
  expect(a.array.constructor).toBe(b.array.constructor);
  expect(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).equals(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength))).toBe(true);
  actual.computeBoundingBox(); expect(actual.boundingBox?.min.z).toBe(-250.98057556152344);
  expect(() => assembleWholeGeometryViews(nodes.slice(1))).toThrow(/incomplete/u);
  expect(() => assembleWholeGeometryViews([...nodes, ...nodes])).toThrow(/duplicate/u);
});
