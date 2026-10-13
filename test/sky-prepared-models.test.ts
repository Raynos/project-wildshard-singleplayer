// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual source GLBs and the original native attribute oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every native byte without allocating millions of boxed numbers.
import { Buffer } from 'node:buffer';
import { Mesh, BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type Object3D } from 'three';
import { expect, it } from 'vitest';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { fitGeometry, pivotNpcParts } from '../src/game/plugin/geometry';
import { hdGeometry } from './fixtures/sky-native-model-intake';
import { bakePreparedModels } from '../src/shards/far-reach/generators/preparedModels';
import { HD_URLS, SKY_HD, type SkyHdName } from '../src/shards/far-reach/data/files';
import { TREE_MODELS, TREES } from '../src/shards/far-reach/data/trees';
import { LECTERN } from '../src/shards/far-reach/data/bookStand';
import { DAIS } from '../src/shards/far-reach/data/layout';
import { releasedPivotNpcParts } from './fixtures/pivot-npc-released';
import { KEEPER_ROW } from '../src/shards/far-reach/data/keeperLook';
import { parseNpcRow } from '@wildshard/format/npcs';
import { bakeKeeperFigure } from '../src/shards/far-reach/generators/keeperFigure';
import frames from '../src/shards/far-reach/data/skyIsleFrames.json' with { type: 'json' };

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const read = (url: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../public${url}`, import.meta.url)));
const words = (attribute: BufferAttribute | InterleavedBufferAttribute): number[] => Array.from({ length: attribute.count * attribute.itemSize }, (_, index) => attribute.getComponent(Math.floor(index / attribute.itemSize), index % attribute.itemSize));
const equalBytes = (actual: Uint8Array | Float32Array | Uint32Array, expected: Uint8Array | Float32Array | Uint32Array): boolean =>
  Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength).equals(Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength));
function expectChannel(actual: BufferAttribute | InterleavedBufferAttribute, expected: BufferAttribute | InterleavedBufferAttribute, label: string): void {
  expect(actual.itemSize, label).toBe(expected.itemSize); expect(actual.count, label).toBe(expected.count);
  if (actual instanceof BufferAttribute && expected instanceof BufferAttribute && actual.array instanceof Float32Array && expected.array instanceof Float32Array && !actual.normalized && !expected.normalized)
    expect(equalBytes(actual.array, expected.array), label).toBe(true);
  else expect(words(actual), label).toStrictEqual(words(expected));
}
const sources = new Map<SkyHdName, ReturnType<typeof readSourceModel>>();
function sourceModel(name: SkyHdName): ReturnType<typeof readSourceModel> {
  const prior = sources.get(name); if (prior !== undefined) return prior;
  const next = readSourceModel(read(HD_URLS[name])); sources.set(name, next); return next;
}
let prepared: ReturnType<typeof readSourceModel> | undefined;
function preparedModel(): ReturnType<typeof readSourceModel> {
  // Remain inside the first test's unchanged 60-second deadline. Both real
  // producer executions are retained; the keeper case reuses their parsed output.
  prepared ??= (async () => {
    const bytes = await bakePreparedModels(read), again = await bakePreparedModels(read);
    expect(equalBytes(again, bytes), 'repeat producer bytes').toBe(true);
    return readSourceModel(bytes);
  })();
  return prepared;
}


// The original native callers' operation order, including the separate dais squash.
function nativeFrame(name: SkyHdName, geometry: BufferGeometry): BufferGeometry {
  const frame = frames.find(row => row.model === name);
  if (frame !== undefined) { geometry.translate(-frame.tx, -frame.deck, -frame.tz); geometry.scale(frame.k, frame.k, frame.k); return geometry; }
  const tree = TREE_MODELS.find(id => id === name);
  if (tree !== undefined) return fitGeometry(geometry, { size: TREES[tree].height, by: 'height', floor: -0.15, centre: 'base' });
  if (name === 'post-hd') return fitGeometry(geometry, { size: 1.9, by: 'height', floor: 0, centre: 'base' });
  if (name === 'crown-stone' || name === 'crown-stone-b') return fitGeometry(geometry, { size: 1, by: 'height', floor: 0, centre: 'base' });
  if (name === 'lectern-hd' || name === 'lantern-hd') return fitGeometry(geometry, { size: name === 'lectern-hd' ? LECTERN.height : LECTERN.lantern, by: 'height', floor: 0, centre: 'base' });
  if (name === 'crown-dais') {
    fitGeometry(geometry, { size: DAIS.r * 2, by: 'span', floor: 0, centre: 'base' }); geometry.computeBoundingBox();
    geometry.scale(1, 0.42 / Math.max(1e-3, geometry.boundingBox?.max.y ?? 1), 1);
  }
  return geometry;
}

it('emits every hero model with the exact native normalized and fitted vertex channels', async () => {
  const ready = await preparedModel();
  for (const name of SKY_HD) {
    const source = await sourceModel(name);
    const original = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
    if (original === null) throw new Error(`Original ${name} has no indexed painted mesh`);
    const expected = nativeFrame(name, original.geometry), node = ready.gltf.scene.getObjectByName(name);
    if (node === undefined || !isMesh(node)) throw new Error(`Prepared ${name} is absent`);
    expected.computeBoundingSphere();
    const sphere = expected.boundingSphere;
    if (sphere === null) throw new Error(`Original ${name} has no fitted sphere`);
    const bounds: unknown = Reflect.get(node.userData, 'sphere');
    expect(bounds, `${name}/sphere`).toStrictEqual([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius]);
    expect(Object.keys(node.geometry.attributes).sort(), name).toEqual(['normal', 'position', 'uv']);
    for (const channel of ['position', 'normal', 'uv']) expectChannel(node.geometry.getAttribute(channel), expected.getAttribute(channel), `${name}/${channel}`);
    const actualIndex = node.geometry.getIndex()?.array, expectedIndex = expected.getIndex()?.array;
    if (!(actualIndex instanceof Uint32Array) || !(expectedIndex instanceof Uint32Array)) throw new Error(`${name}: native uint32 indices required`);
    expect(equalBytes(actualIndex, expectedIndex), `${name}/index`).toBe(true);
  }
}, 60_000);

it('bakes keeper pivots with released local channels, bounds, hierarchy and native motion attachment', async () => {
  const source = await sourceModel('keeper-hd');
  const native = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
  if (native === null) throw new Error('Missing native keeper');
  const row = parseNpcRow(KEEPER_ROW);
  const expected = releasedPivotNpcParts(row, native.geometry.clone());
  const parts = bakeKeeperFigure(native.geometry.clone());
  const actual = pivotNpcParts(row, { body: parts[0], head: parts[1], arm: parts[2], fore: parts[3] });
  const collect = (root: Object3D): Object3D[] => { const nodes: Object3D[] = []; root.traverse(node => { nodes.push(node); }); return nodes; };
  const actualNodes = collect(actual.root), expectedNodes = collect(expected.root);
  expect(actualNodes).toHaveLength(expectedNodes.length);
  for (const [index, node] of actualNodes.entries()) {
    const reference = expectedNodes[index]; if (reference === undefined) throw new Error('Missing released pivot node');
    expect(node.position.toArray()).toStrictEqual(reference.position.toArray());
    expect(node.rotation.toArray()).toStrictEqual(reference.rotation.toArray());
    expect(node.scale.toArray()).toStrictEqual(reference.scale.toArray());
    expect(isMesh(node)).toBe(isMesh(reference));
    if (isMesh(node) && isMesh(reference)) {
      expect(node.geometry.index).toStrictEqual(reference.geometry.index);
      expect(node.geometry.boundingBox).toStrictEqual(reference.geometry.boundingBox);
      expect(node.geometry.boundingSphere).toStrictEqual(reference.geometry.boundingSphere);
      expect(Object.keys(node.geometry.attributes)).toStrictEqual(Object.keys(reference.geometry.attributes));
      for (const [channel, attribute] of Object.entries(reference.geometry.attributes)) expectChannel(node.geometry.getAttribute(channel), attribute, `pivot ${index}/${channel}`);
    }
  }
  const glb = await preparedModel();
  for (const [index, geometry] of parts.entries()) {
    const name = `keeper-pivot-${String(index)}`, node = glb.gltf.scene.getObjectByName(name);
    if (geometry.getAttribute('position').count === 0) { expect(node).toBeUndefined(); continue; }
    if (node === undefined || !isMesh(node)) throw new Error('Missing baked keeper pivot');
    expect(node.geometry.index).toBeNull();
    for (const [channel, attribute] of Object.entries(geometry.attributes)) expectChannel(node.geometry.getAttribute(channel), attribute, `${name}/${channel}`);
    const sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error('Missing native pivot sphere');
    expect(node.userData['sphere']).toStrictEqual([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius]);
  }
}, 60_000);
