// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareSceneDrawRows, drawSceneRows } from '../src/game/shardfile/sceneDraws';
import { SKY_MEADOW_BLOB, SKY_MEADOW_BLOBS, SKY_MEADOW_FILE, SKY_MEADOW_DATA_FILE, skyMeadowBlobs } from '../src/shards/far-reach/generators/meadowScene';
import { bakeMeadowBlades } from '../src/shards/far-reach/generators/meadowBlades';
import { meadowHash } from '../src/shards/far-reach/generators/meadowHash';
import { predecessorMeadowHash } from './fixtures/sky-meadow-hash';
import { originalSkyScenes } from './fixtures/sky-scene-source';


const { blobs: SKY_SCENE_BLOBS } = await originalSkyScenes();

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const emitted = emitNamedBlobs(SKY_MEADOW_BLOBS);
const binary = SKY_MEADOW_BLOBS.find(row => row.file.kind === 'bin');
if (binary === undefined) throw new Error('Missing packed meadow');
const packed = binary;

test('reusing pure path noise preserves complete meadow and scene bytes', () => {
  // An injected wrapper follows the original per-path calls, including every
  // single-precision hash operation, rather than the built-in pure shortcut.
  const reference = skyMeadowBlobs(bakeMeadowBlades((x, y) => meadowHash(x, y)));
  expect(reference.binary.bytes.byteLength).toBe(packed.bytes.byteLength);
  expect(reference.binary.bytes.every((byte, index) => byte === packed.bytes[index])).toBe(true);
  expect(reference.scene.bytes.byteLength).toBe(SKY_MEADOW_BLOB.bytes.byteLength);
  expect(reference.scene.bytes.every((byte, index) => byte === SKY_MEADOW_BLOB.bytes[index])).toBe(true);
});

test('packed meadow retains bounded channels and current scene ownership', () => {
  // Rebuild the independent predecessor encoding to check bounded channel storage.
  const before = skyMeadowBlobs(bakeMeadowBlades(predecessorMeadowHash));
  const prior = parseSceneBuffers(JSON.parse(new TextDecoder().decode(before.scene.bytes))), priorPacked = before.binary;
  for (const { file, byteLength, byteOffset, ...row } of prior.buffers) {
    if (file !== SKY_MEADOW_DATA_FILE || byteLength === undefined || byteOffset === undefined || row.bytes !== undefined)
      throw new Error('Expected bounded binary meadow channel');
    const bytes = priorPacked.bytes.subarray(byteOffset, byteOffset + byteLength);
    expect(bytes.byteLength).toBe(byteLength);
  }
  expect(before.scene.file.dependencies).toEqual([priorPacked.file.hash]);
  // the shipped (FR6) pair keeps the same shape: one packed channel file the scene file depends on
  expect(SKY_MEADOW_BLOB.file.dependencies).toEqual([packed.file.hash]);
  expect(SKY_MEADOW_BLOBS).toHaveLength(2);
  for (const blob of SKY_MEADOW_BLOBS) {
    const owned = SKY_SCENE_BLOBS.find(row => row.file.name === blob.file.name);
    if (owned === undefined) throw new Error('Missing original meadow world file');
    expect(owned.file).toEqual(blob.file);
    expect(hashImmutableBytes(owned.bytes)).toBe(blob.file.hash);
  }
});

function product(mode: 'complete' | 'missing' | 'truncated') {
  const read = vi.fn((hash: string) => {
    const bytes = emitted.assets.get(hash);
    if (bytes === undefined) throw new Error('Missing verified fixture file');
    return Promise.resolve(mode === 'truncated' && hash === packed.file.hash ? bytes.subarray(0, -1) : bytes);
  });
  const shardfile = { ...emptyShardfile({ slug: 'meadow-binary', name: 'Meadow', author: 'Fixture', revision: 1, seed: 1 }),
    plumbing: { namespace: 'far', input: [], debug: [], knobs: [{ id: 'far.meadowBlades' as const, phone: 1600, desktop: 3200 }] } };
  const value = createShardProduct({ slug: 'meadow-binary', revision: 1, shardfile, sections: new Map(),
    files: new Map(emitted.files.flatMap(file => file.name === undefined || mode === 'missing' && file.kind === 'bin' ? []
      : [[file.name, { hash: file.hash, url: file.hash }]])), read });
  return { value, read };
}
const draws = [{ kind: 'buffered', file: SKY_MEADOW_FILE, material: 'grass' }];

test('actual product admission reads the packed meadow once and retires every geometry once', async () => {
  const admitted = product('complete');
  await prepareSceneDrawRows(admitted.value, draws);
  await prepareSceneDrawRows(admitted.value, draws);
  expect(admitted.read.mock.calls.filter(([hash]) => hash === packed.file.hash)).toHaveLength(1);
  const scope = new Scope('meadow-binary'), material = new MeshBasicMaterial(), parent = new Group();
  try {
    drawSceneRows(admitted.value, draws, parent, scope, new Map([['grass', material]]));
    expect(parent.children[0]?.children).toHaveLength(124);
    const geometries = new Set<Mesh['geometry']>();
    parent.traverse(node => { if (isMesh(node)) geometries.add(node.geometry); });
    expect(geometries.size).toBe(248);
    const disposals = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
    scope.dispose(); scope.dispose();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  } finally { scope.dispose(); material.dispose(); }
});

test('meadow admission refuses absent or truncated packed storage before drawing', async () => {
  await expect(prepareSceneDrawRows(product('missing').value, draws)).rejects.toThrow('Missing scene buffer binary file');
  await expect(prepareSceneDrawRows(product('truncated').value, draws)).rejects.toThrow('binary length differs');
});
