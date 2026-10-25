import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { NINE_SCENE_BLOBS } from './fixtures/nine-product-inputs';
import { cardScene } from '../src/shards/nine-dragon-stack/generators/presentation';
import { admitSceneBuffers } from '../src/game/shardfile/sceneBuffers';
import before from './fixtures/nine-presentation-bytes.json' with { type: 'json' };

test('Nine presentation keeps every original channel word and draw reference', () => {
  const binary = NINE_SCENE_BLOBS.filter(blob => blob.file.kind === 'bin' && blob.file.name?.startsWith('world/cards/') === true);
  const files = new Map(binary.map(blob => [blob.file.name, blob]));
  const descriptors = NINE_SCENE_BLOBS.filter(blob => blob.file.kind === 'json' && blob.file.name?.startsWith('world/cards/') === true);
  const actual = descriptors.map(blob => {
    const row = parseSceneBuffers(JSON.parse(new TextDecoder().decode(blob.bytes)));
    const dependencies = new Set<string>();
    const buffers = row.buffers.map(({ bytes, file, ...rest }) => {
      expect(bytes).toBeUndefined();
      const source = files.get(file);
      if (source === undefined) throw new Error(`Missing binary presentation ${file}`);
      expect(source.bytes.byteLength).toBe(rest.byteLength);
      dependencies.add(source.file.hash);
      return { ...rest, hash: hashImmutableBytes(source.bytes) };
    });
    expect(blob.file.dependencies).toEqual([...dependencies]);
    return { name: blob.file.name, scene: { ...row, buffers } };
  });
  expect(actual).toEqual(before.map(({ name, scene }) => ({ name, scene })));
  // The full immutable admission also refuses aliased bytes or duplicate hashes.
  expect(() => emitNamedBlobs([...binary, ...descriptors])).not.toThrow();
  expect(before.reduce((sum, row) => sum + row.characters, 0)).toBe(477948);
  expect(before.reduce((sum, row) => sum + row.scene.buffers.reduce((bytes, buffer) => bytes + buffer.byteLength, 0), 0)).toBe(358428);
});

test('presentation sharing distinguishes word bits and instancing and consumes sources once', () => {
  const files = new Map<string, Uint8Array>();
  const publish = (bytes: Uint8Array): string => {
    const file = `channels/${hashImmutableBytes(bytes)}.bin`;
    files.set(file, Uint8Array.from(bytes)); return file;
  };
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  geometry.setAttribute('copy', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  geometry.setAttribute('negative', new BufferAttribute(new Float32Array([-0, 0, 0]), 3));
  geometry.setAttribute('instance', new InstancedBufferAttribute(new Float32Array([0, 0, 0]), 3));
  geometry.setIndex([0, 0, 0, 0, 0, 0]);
  const disposed = vi.spyOn(geometry, 'dispose'), retired = vi.spyOn(material, 'dispose');
  const row = cardScene([new Mesh(geometry, material)], 'sharing', publish);
  expect(row.buffers).toHaveLength(4);
  const attributes = new Map(row.attributes.map(attribute => [attribute.id, attribute]));
  expect(attributes.get('0.position')?.buffer).toBe(attributes.get('0.copy')?.buffer);
  expect(attributes.get('0.position')?.buffer).not.toBe(attributes.get('0.negative')?.buffer);
  expect(attributes.get('0.position')?.buffer).not.toBe(attributes.get('0.instance')?.buffer);
  expect(files.size).toBe(2);
  expect(disposed).toHaveBeenCalledTimes(1); expect(retired).toHaveBeenCalledTimes(1);
});

test('empty presentation channels stay valid without publishing empty blobs', () => {
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(), 3)); geometry.setIndex([]);
  const publish = vi.fn((): string => { throw new Error('Empty binary files refuse'); });
  const row = cardScene([new Mesh(geometry, material)], 'empty', publish);
  expect(publish).not.toHaveBeenCalled();
  expect(row.buffers.every(buffer => buffer.bytes === '')).toBe(true);
  expect(() => admitSceneBuffers(row)).not.toThrow();
});
