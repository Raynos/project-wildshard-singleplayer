// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, MeshBasicMaterial, Points, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareSceneDrawRows, drawSceneRows } from '../src/game/shardfile/sceneDraws';
import { SIGNAL_EMITTERS } from '../src/shards/sunscar-dunes/generators/lightEmitters';
import { signalEmberBuffer, SIGNAL_EMBER_BLOBS } from '../src/shards/sunscar-dunes/generators/emberBuffers';

const isPoints = (node: Object3D | undefined): node is Points => node instanceof Points;
const originals = [
  ['world/fields/embers-4.json', 80, '529d283ea6c0842ac46078102f06de1c9b3a160f10b3d338b39715897e1c0933'],
  ['world/fields/embers-160.json', 3200, 'b9d1c439163e4c2f609253e71e91c5a3456361cf0dab333dc3c399c40cfab7be'],
  ['world/fields/embers-12.json', 240, 'a51fa4b987751bf283679ebd3de10e3b1159b71cd9f10345c221b6912cbd621d'],
  ['world/fields/embers-260.json', 5200, '5c7d7a0c53d773396ff085f3e448a927c1a09ab2ab8dcc277de192d5270532f6'],
] as const;
const files = new Set(SIGNAL_EMITTERS.rows.flatMap(row => row.draws.flatMap(draw => draw.kind === 'buffered' ? [draw.file] : [])));
const descriptors = SIGNAL_EMBER_BLOBS.filter(blob => files.has(blob.file.name ?? ''));
const dependencies = new Set(descriptors.flatMap(blob => blob.file.dependencies));
const sources = SIGNAL_EMBER_BLOBS.filter(blob => files.has(blob.file.name ?? '') || dependencies.has(blob.file.hash));
const emitted = emitNamedBlobs(sources);

test('all shipped ember fields keep the independent original byte and metadata inventories', () => {
  expect([...files]).toEqual(originals.map(([file]) => file));
  expect(descriptors).toHaveLength(4); expect(dependencies.size).toBe(4); expect(sources).toHaveLength(8);
  for (const [file, length, hash] of originals) {
    const descriptor = descriptors.find(blob => blob.file.name === file);
    if (descriptor === undefined) throw new Error('Missing shipped ember field');
    const scene = parseSceneBuffers(JSON.parse(new TextDecoder().decode(descriptor.bytes)));
    const buffers = scene.buffers.map(({ file: name, byteOffset, byteLength, ...row }) => {
      const binary = sources.find(blob => blob.file.name === name);
      if (binary === undefined || byteOffset === undefined || byteLength === undefined || row.bytes !== undefined)
        throw new Error('Missing original binary channel');
      const bytes = binary.bytes.subarray(byteOffset, byteOffset + byteLength);
      expect(bytes.byteLength).toBe(byteLength);
      return { ...row, length: bytes.byteLength, hash: hashImmutableBytes(bytes) };
    });
    expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ ...scene, buffers })))).toBe(hash);
    expect(descriptor.file.gpu).toBe(length);
    const binary = sources.find(blob => descriptor.file.dependencies.includes(blob.file.hash));
    expect(binary?.bytes.byteLength).toBe(length);
  }
});

function product(mode: 'complete' | 'missing' | 'truncated') {
  const read = vi.fn((hash: string) => {
    const bytes = emitted.assets.get(hash); if (bytes === undefined) throw new Error('Missing verified fixture bytes');
    return Promise.resolve(mode === 'truncated' && dependencies.has(hash) ? bytes.subarray(0, -1) : bytes);
  });
  const value = createShardProduct({ slug: 'ember-binary', revision: 1,
    shardfile: emptyShardfile({ slug: 'ember-binary', name: 'Embers', author: 'Fixture', revision: 1, seed: 1 }), sections: new Map(),
    files: new Map(emitted.files.flatMap(file => file.name === undefined || mode === 'missing' && file.kind === 'bin' ? [] : [[file.name, { hash: file.hash, url: file.hash }]])), read });
  return { value, read };
}
const draws = [...files].map(file => ({ kind: 'buffered', file, material: 'fire' }));

test('each packed ember field loads once and keeps native seeds, visibility and exact-once disposal', async () => {
  const admitted = product('complete');
  await prepareSceneDrawRows(admitted.value, draws); await prepareSceneDrawRows(admitted.value, draws);
  for (const hash of dependencies) expect(admitted.read.mock.calls.filter(([read]) => read === hash)).toHaveLength(1);
  const scope = new Scope('ember-binary'), material = new MeshBasicMaterial(), root = new Group();
  try {
    drawSceneRows(admitted.value, draws, root, scope, new Map([['fire', material]]));
    expect(root.children).toHaveLength(4);
    const disposals = root.children.map((group, index) => {
      const points = group.children[0], original = originals[index];
      if (!isPoints(points) || original === undefined) throw new Error('Missing original ember Points');
      const count = original[1] / 20;
      expect(points.frustumCulled).toBe(false);
      expect(Array.from(points.geometry.getAttribute('aIndex').array)).toEqual(Array.from(Float32Array.from({ length: count }, (_, i) => i)));
      expect(Array.from(points.geometry.getAttribute('aSeed').array)).toEqual(Array.from(Float32Array.from({ length: count }, (_, i) => (i * .618034) % 1)));
      expect(Array.from(points.geometry.getAttribute('position').array)).toEqual(Array.from(new Float32Array(count * 3)));
      return vi.spyOn(points.geometry, 'dispose');
    });
    scope.dispose(); scope.dispose(); for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  } finally { scope.dispose(); material.dispose(); }
});

test('packed ember admission refuses absent and truncated binary dependencies', async () => {
  await expect(prepareSceneDrawRows(product('missing').value, draws)).rejects.toThrow('Missing scene buffer binary file');
  await expect(prepareSceneDrawRows(product('truncated').value, draws)).rejects.toThrow('binary length differs');
});

test('an empty field retains its valid empty descriptor without a phantom binary file', () => {
  const file = signalEmberBuffer(0, 'empty'), blob = SIGNAL_EMBER_BLOBS.find(row => row.file.name === file);
  if (blob === undefined) throw new Error('Missing empty ember field');
  const scene = parseSceneBuffers(JSON.parse(new TextDecoder().decode(blob.bytes)));
  expect(scene.buffers.every(row => row.bytes === '' && row.file === undefined)).toBe(true);
  expect(blob.file.gpu).toBe(0); expect(blob.file.dependencies).toEqual([]);
  expect(SIGNAL_EMBER_BLOBS.some(row => row.file.name === 'world/fields/embers-0.bin')).toBe(false);
});
