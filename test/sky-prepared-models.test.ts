// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual source GLBs and the original native attribute oracle.
import { readFileSync } from 'node:fs';
import { Mesh, type BufferGeometry, type BufferAttribute, type InterleavedBufferAttribute, type Object3D } from 'three';
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
import { bakeKeeperFigure } from '../src/shards/far-reach/generators/keeperFigure';
import frames from '../src/shards/far-reach/data/skyIsleFrames.json' with { type: 'json' };

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const read = (url: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../public${url}`, import.meta.url)));
const words = (attribute: BufferAttribute | InterleavedBufferAttribute): number[] => Array.from({ length: attribute.count * attribute.itemSize }, (_, index) => attribute.getComponent(Math.floor(index / attribute.itemSize), index % attribute.itemSize));

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
  const bytes = await bakePreparedModels(read), again = await bakePreparedModels(read);
  expect(again).toStrictEqual(bytes);
  const ready = await readSourceModel(bytes);
  for (const name of SKY_HD) {
    const source = await readSourceModel(read(HD_URLS[name]));
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
    for (const channel of ['position', 'normal', 'uv']) expect(words(node.geometry.getAttribute(channel)), `${name}/${channel}`).toStrictEqual(words(expected.getAttribute(channel)));
    expect(node.geometry.getIndex()?.array, `${name}/index`).toStrictEqual(expected.getIndex()?.array);
    expect(node.geometry.getIndex()?.array).toBeInstanceOf(Uint32Array);
  }
}, 60_000);

it('bakes keeper pivots with released local channels, bounds, hierarchy and native motion attachment', async () => {
  const source = await readSourceModel(read(HD_URLS['keeper-hd']));
  const native = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
  if (native === null) throw new Error('Missing native keeper');
  const expected = releasedPivotNpcParts(KEEPER_ROW, native.geometry.clone());
  const parts = bakeKeeperFigure(native.geometry.clone());
  const actual = pivotNpcParts(KEEPER_ROW, { body: parts[0], head: parts[1], arm: parts[2], fore: parts[3] });
  const snapshot = (root: Object3D): unknown[] => {
    const out: unknown[] = [];
    root.traverse(node => { out.push({ position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray(),
      ...(isMesh(node) ? { index: node.geometry.index, box: node.geometry.boundingBox, sphere: node.geometry.boundingSphere,
        channels: Object.fromEntries(Object.entries(node.geometry.attributes).map(([name, attribute]) => [name, words(attribute)])) } : {}) }); });
    return out;
  };
  expect(snapshot(actual.root)).toStrictEqual(snapshot(expected.root));
  const glb = await readSourceModel(await bakePreparedModels(read));
  for (const [index, geometry] of parts.entries()) {
    const name = `keeper-pivot-${String(index)}`, node = glb.gltf.scene.getObjectByName(name);
    if (geometry.getAttribute('position').count === 0) { expect(node).toBeUndefined(); continue; }
    if (node === undefined || !isMesh(node)) throw new Error('Missing baked keeper pivot');
    expect(node.geometry.index).toBeNull();
    for (const [channel, attribute] of Object.entries(geometry.attributes)) expect(words(node.geometry.getAttribute(channel))).toStrictEqual(words(attribute));
    const sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error('Missing native pivot sphere');
    expect(node.userData['sphere']).toStrictEqual([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius]);
  }
}, 60_000);
