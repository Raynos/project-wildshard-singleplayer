// oxlint-disable-next-line import/no-nodejs-modules -- Exact array bytes without instrumented deep matchers.
import { Buffer } from 'node:buffer';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakeProps } from '@wildshard/sdk/bake/props';
import { bake, WholeShape } from '@wildshard/sdk/bake';
import { emptyShardfile } from '@wildshard/sdk/author';
import { ShardfileSchema } from '@wildshard/format/shardSchema';
import { PropsSchema } from '@wildshard/format/props';
import { validatePropDrawBounds } from '@wildshard/format/product';
import { assembleWholeGeometryViews } from '@wildshard/game/plugin/geometry';
import { terrainResidency } from '../src/game/shardfile/residency';

const geometry = (): THREE.BufferGeometry => new THREE.BufferGeometry()
  .setAttribute('position', new THREE.Float32BufferAttribute([-4, 0, -250.75, 2, 0, -250.5, 2, 0, -249.25, -4, 0, -249.25], 3))
  .setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  .setAttribute('water', new THREE.Float32BufferAttribute([1, 2, 3, 4, 5, 6, 7, 8], 2))
  .setIndex(new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
const shape = () => new THREE.Mesh(geometry(), new THREE.MeshStandardMaterial());
it('preserves the fixed-cell refusal by default and rejects undeclared, nonfinite and excessive overhang', () => {
  const whole = { id: 'water', mesh: shape(), transform: new THREE.Matrix4(), partition: true as const };
  expect(() => bakeProps({ static: new THREE.Group(), whole: [whole] })).toThrow(/outside/u);
  for (const overhang of [-1, Infinity, Number.NaN, 1.01, 0.5]) expect(() => bakeProps({ static: new THREE.Group(), whole: [{ ...whole, overhang }] })).toThrow();
  for (const overhang of [-1, Infinity, Number.NaN, 1.01]) expect(() => v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], overhang })).toThrow();
});
it('keeps source bytes and a single original draw, owns outside centroids at the edge, and admits charged draw bounds', async () => {
  const sourceMesh = shape(), scene = new THREE.Scene();
  scene.add(new WholeShape('water', sourceMesh, { partition: true, nativeAttributes: true, overhang: 1 }));
  const baked = bake(scene, { slug: 'overhang-fixture' });
  const props = baked.props; if (props === null) throw new Error('Missing props');
  expect(props.props.overhang).toBe(1);
  expect(props.tiles.length).toBeGreaterThan(0);
  expect(props.tiles.every(tile => tile.z === 0 && tile.drawBounds !== undefined)).toBe(true);
  const source = v.parse(ShardfileSchema, { ...emptyShardfile({ slug: 'overhang-fixture', name: 'Overhang', author: 'Test', revision: 1, seed: 1 }),
    props: props.props, files: props.files, tiles: props.tiles, library: props.library, far: props.far });
  expect(() => validatePropDrawBounds(source, props.assets)).not.toThrow();
  expect(() => v.parse(ShardfileSchema, { ...source, props: { ...props.props, overhang: 0.5 } })).toThrow('shardfile semantic rules');
  expect(() => validatePropDrawBounds({ ...source, props: { ...props.props, overhang: 0.5 } }, props.assets)).toThrow(/draw bounds/u);
  const shrunk = structuredClone(source);
  for (const tile of shrunk.tiles) tile.drawBounds = { ...tile.bounds };
  expect(() => validatePropDrawBounds(shrunk, props.assets)).toThrow(/draw bounds/u);
  const refs = new Set(props.props.tiles.flatMap(tile => [tile.file, ...tile.additionalFiles ?? []])), nodes: THREE.Mesh[] = [];
  const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
  for (const ref of refs) {
    const bytes = props.assets.get(ref); if (bytes === undefined) throw new Error('Missing subset');
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    parsed.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
  }
  const assembled = assembleWholeGeometryViews(nodes), original = assembled.get('water');
  if (original === undefined) throw new Error('Missing original draw');
  expect(assembled.size).toBe(1);
  for (const name of Object.keys(sourceMesh.geometry.attributes)) {
    const a = original.geometry.getAttribute(name).array, b = sourceMesh.geometry.getAttribute(name).array;
    expect(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(new Uint8Array(b.buffer, b.byteOffset, b.byteLength))).toBe(true);
  }
  expect(Array.from(original.geometry.getIndex()?.array ?? [])).toEqual([0, 1, 2, 0, 2, 3]);
  expect(props.files.reduce((sum, file) => sum + file.compressed, 0)).toBe([...props.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0));
});
it('keeps absent and explicit zero bytes unchanged and includes the declared extent in residency', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const whole = { id: 'box', mesh, transform: new THREE.Matrix4(), partition: true as const };
  const before = bakeProps({ static: new THREE.Group(), whole: [whole] }), zero = bakeProps({ static: new THREE.Group(), whole: [{ ...whole, overhang: 0 }] });
  expect(zero.props).toEqual(before.props); expect(zero.tiles).toEqual(before.tiles); expect(zero.files).toEqual(before.files);
  for (const [ref, bytes] of before.assets) expect(Buffer.from(zero.assets.get(ref) ?? []).equals(bytes)).toBe(true);
  const without = terrainResidency(0, -400.75), withEdge = terrainResidency(0, -400.75, 1);
  expect(without.fine.has('0/4/0')).toBe(false); expect(withEdge.fine.has('0/4/0')).toBe(true);
  expect(() => terrainResidency(0, 0, 1.01)).toThrow();
});
