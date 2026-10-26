// oxlint-disable-next-line import/no-nodejs-modules -- Verify all stored pixels after native KTX2 decompression.
import { zstdDecompressSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Material, Mesh } from 'three';
import * as v from 'valibot';
import { parseGlb, parseKtx2 } from '../src/sdk/assets';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { readImagePixels } from '../src/sdk/bake/image';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiModelParts } from '../src/shards/nalati-grasslands/generators/modelParts';
import { nalatiModelSourceParts } from '../src/shards/nalati-grasslands/generators/modelSourceParts';
import pins from './fixtures/nalati-model-paint.json' with { type: 'json' };
import partPins from './fixtures/nalati-model-parts.json' with { type: 'json' };
import { textureMipBytes } from '../src/format/contentBounds';
import { originalPaintedModel } from './fixtures/nalati-painted-models';

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
function isMaterial(value: unknown): value is Material { return value instanceof Material; }
function geometryOf(value: unknown): BufferGeometry {
  if (!(value instanceof Mesh)) throw new Error('Missing original painted mesh');
  const geometry: unknown = value.geometry;
  if (!isGeometry(geometry)) throw new Error('Missing original painted geometry');
  return geometry;
}

test.each(pins)('separates $file with every original geometry byte and decoded atlas pixel', async pin => {
  const input = await originalPaintedModel(pin.file);
  expect(input.byteLength).toBe(pin.bytes); expect(hashImmutableBytes(input)).toBe(pin.sha256);
  const beforeHash = hashImmutableBytes(input), source = nalatiModelSourceParts(input), parts = await nalatiModelParts(input);
  const partPin = partPins.find(row => row.file === pin.file); if (partPin === undefined) throw new Error('Missing complete model-part pin');
  expect(parts.geometry.length).toBe(partPin.geometry.compressed); expect(hashImmutableBytes(parts.geometry)).toBe(partPin.geometry.hash);
  expect(hashImmutableBytes(input)).toBe(beforeHash);
  expect(parts.geometry.buffer).not.toBe(input.buffer);
  expect(source.geometry.buffer).not.toBe(input.buffer);
  expect(source.geometry.buffer).not.toBe(parts.geometry.buffer);
  expect(Buffer.compare(source.geometry, parts.geometry)).toBe(0);
  expect(() => parseGlb(parts.geometry)).not.toThrow();
  const original = await readSourceModel(input), current = await readSourceModel(parts.geometry);
  const originalMesh = original.gltf.scene.children[0], currentMesh = current.gltf.scene.children[0];
  if (!(originalMesh instanceof Mesh) || !(currentMesh instanceof Mesh)) throw new Error('Missing complete painted primitive');
  const before = geometryOf(originalMesh), after = geometryOf(currentMesh);
  try {
    expect(Object.keys(after.attributes)).toEqual(Object.keys(before.attributes));
    for (const [key, attribute] of Object.entries(before.attributes)) {
      const actual = after.getAttribute(key);
      if (!(attribute instanceof BufferAttribute) || !(actual instanceof BufferAttribute)) throw new Error('Missing painted attribute');
      expect(actual.array.constructor).toBe(attribute.array.constructor);
      expect(actual.itemSize).toBe(attribute.itemSize); expect(actual.normalized).toBe(attribute.normalized);
      expect(Buffer.compare(Buffer.from(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength),
        Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength))).toBe(0);
    }
    expect(after.index?.array).toEqual(before.index?.array);
    expect(after.boundingBox).toEqual(before.boundingBox); expect(after.boundingSphere).toEqual(before.boundingSphere);
    expect(currentMesh.matrix.toArray()).toEqual(originalMesh.matrix.toArray());
    const originalMaterial: unknown = originalMesh.material;
    const material: unknown = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial;
    if (!isMaterial(material)) throw new Error('Missing original painted material');
    const texture = original.texture(material);
    if (texture === null) {
      expect(partPin.atlas).toBeNull();
      expect(source.webp).toBeNull();
      expect(parts.atlas).toBeNull(); expect(Buffer.compare(parts.geometry, input)).toBe(0);
    } else {
      const webp = source.webp; if (webp === null) throw new Error('Missing original WebP atlas');
      expect(webp.buffer).not.toBe(input.buffer);
      expect(Buffer.compare(webp, texture.image)).toBe(0);
      expect(texture.sampler).toEqual({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
      const atlas = parts.atlas; if (atlas === null) throw new Error('Missing separate atlas');
      const atlasPin = partPin.atlas; if (atlasPin === null) throw new Error('Missing complete atlas pin');
      expect(atlas.length).toBe(atlasPin.compressed); expect(hashImmutableBytes(atlas)).toBe(atlasPin.hash);
      expect(() => parseKtx2(atlas)).not.toThrow();
      const pixels = await readImagePixels(texture.image), view = new DataView(atlas.buffer, atlas.byteOffset, atlas.byteLength);
      expect(atlasPin.gpu).toBe(textureMipBytes(pixels.width, pixels.height, 1 + Math.floor(Math.log2(Math.max(pixels.width, pixels.height))), false));
      expect(view.getUint32(12, true)).toBe(43); expect(view.getUint32(20, true)).toBe(pixels.width); expect(view.getUint32(24, true)).toBe(pixels.height);
      const start = Number(view.getBigUint64(80, true)), length = Number(view.getBigUint64(88, true));
      const decoded = zstdDecompressSync(atlas.subarray(start, start + length));
      expect(decoded.length).toBe(pixels.pixels.length);
      expect(Buffer.compare(decoded, Buffer.from(pixels.pixels.buffer, pixels.pixels.byteOffset, pixels.pixels.byteLength))).toBe(0);
    }
  } finally { before.dispose(); after.dispose(); }
});

test('refuses malformed extents, incomplete atlas declarations and a changed sampler without mutating inputs', async () => {
  const pin = pins[0]; if (pin === undefined) throw new Error('Missing original model pin');
  const bytes = await originalPaintedModel(pin.file);
  await expect(nalatiModelParts(bytes.subarray(1))).rejects.toThrow();
  const view = new DataView(bytes.buffer), size = view.getUint32(12, true);
  const document = v.parse(v.looseObject({ samplers: v.array(v.looseObject({ magFilter: v.number() })) }), JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size))));
  const sampler = document.samplers[0]; if (sampler === undefined) throw new Error('Missing original sampler');
  sampler.magFilter = 9728;
  const json = new TextEncoder().encode(JSON.stringify(document));
  expect(json.length).toBeLessThanOrEqual(size);
  const changed = bytes.slice(); changed.fill(32, 20, 20 + size); changed.set(json, 20);
  await expect(nalatiModelParts(changed)).rejects.toThrow();
  const wrongLength = bytes.slice(); new DataView(wrongLength.buffer).setUint32(8, bytes.length - 4, true);
  await expect(nalatiModelParts(wrongLength)).rejects.toThrow('header');
});

test('refuses shared atlas views and dangling declarations before texture compilation', async () => {
  const pin = pins[0]; if (pin === undefined) throw new Error('Missing original model pin');
  const bytes = await originalPaintedModel(pin.file);
  const size = new DataView(bytes.buffer).getUint32(12, true);
  const schema = v.looseObject({ bufferViews: v.array(v.looseObject({ byteOffset: v.number() })), accessors: v.array(v.looseObject({ bufferView: v.number() })) });
  type Document = v.InferOutput<typeof schema>;
  const corrupt = (change: (document: Document) => void): Uint8Array => {
    const document = v.parse(schema, JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size))));
    change(document);
    const json = new TextEncoder().encode(JSON.stringify(document));
    if (json.length > size) throw new Error('Fixture JSON exceeds original padding');
    const changed = bytes.slice(); changed.fill(32, 20, 20 + size); changed.set(json, 20); return changed;
  };
  const broken = [
    corrupt(document => { Reflect.deleteProperty(document, 'textures'); }),
    corrupt(document => { const last = document.bufferViews.at(-1); if (last === undefined) throw new Error('Missing atlas view'); last.byteOffset = 0; }),
    corrupt(document => { const first = document.accessors[0]; if (first === undefined) throw new Error('Missing geometry accessor'); first.bufferView = document.bufferViews.length - 1; }),
  ];
  for (const input of broken) await expect(nalatiModelParts(input)).rejects.toThrow();
  expect(hashImmutableBytes(bytes)).toBe(pin.sha256);
});
