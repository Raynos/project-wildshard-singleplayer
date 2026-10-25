// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { hashImmutableBytes, encodeCanonicalJson } from '../src/sdk/immutable';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareSceneDrawRows, drawSceneRows } from '../src/game/shardfile/sceneDraws';
import { SKY_MEADOW_BLOB, SKY_MEADOW_BLOBS, SKY_MEADOW_FILE, SKY_MEADOW_DATA_FILE } from '../src/shards/far-reach/generators/meadowScene';
import { SKY_SCENE_BLOBS } from '../src/shards/far-reach/generators/worldScenes';

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
const scene = parseSceneBuffers(JSON.parse(new TextDecoder().decode(SKY_MEADOW_BLOB.bytes)));
const emitted = emitNamedBlobs(SKY_MEADOW_BLOBS);
const binary = SKY_MEADOW_BLOBS.find(row => row.file.kind === 'bin');
if (binary === undefined) throw new Error('Missing packed meadow');
const packed = binary;

test('packed meadow preserves the independent original byte and scene inventory', () => {
  const buffers = scene.buffers.map(({ file, byteLength, byteOffset, ...row }) => {
    if (file !== SKY_MEADOW_DATA_FILE || byteLength === undefined || byteOffset === undefined || row.bytes !== undefined)
      throw new Error('Expected bounded binary meadow channel');
    const bytes = packed.bytes.subarray(byteOffset, byteOffset + byteLength);
    expect(bytes.byteLength).toBe(byteLength);
    return { ...row, rawBytes: byteLength, hash: hashImmutableBytes(bytes) };
  });
  // Independently captured before replacing any original inline channels.
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ ...scene, buffers }))))
    .toBe('40da5ba563427616f78270333061b204d02e680daf10d96dd390a9ac9a3fdeb7');
  expect(scene.buffers).toHaveLength(132);
  expect(scene.draws).toHaveLength(124);
  // Two u16 channel ends need two padding bytes each before f32 storage.
  expect(packed.bytes.byteLength).toBe(1736792);
  expect(SKY_MEADOW_BLOB.file.gpu).toBe(1736788);
  expect(SKY_MEADOW_BLOB.file.dependencies).toEqual([packed.file.hash]);
  expect(SKY_MEADOW_BLOBS).toHaveLength(2);
  expect(SKY_MEADOW_BLOBS.every(blob => SKY_SCENE_BLOBS.includes(blob))).toBe(true);
  expect(SKY_MEADOW_BLOB.bytes.byteLength).toBe(138635);
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
