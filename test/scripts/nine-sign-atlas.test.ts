// oxlint-disable-next-line import/no-nodejs-modules -- Exact independent pre-conversion runtime reference hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only binary byte proofs use explicit buffer ownership.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the retained lossless KTX2 payload before browser decoding.
import { zstdDecompressSync, zstdCompressSync } from 'node:zlib';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute } from 'three';
import { createModelLibrary } from '../../src/game/plugin/geometry';
import { readSourceModel } from '../../src/sdk/bake/skinned';
import { parseKtx2 } from '../../src/format/product';
import { rawKtx2, bakeSignalSand } from '../../src/shards/sunscar-dunes/generators/sand';
import { signAtlasBlobs, SIGN_CHANNELS } from '../../src/shards/nine-dragon-stack/generators/signAtlasOutput';
import atlas from '../../src/shards/nine-dragon-stack/data/signAtlas.generated.json' with { type: 'json' };
import reference from '../fixtures/nine-sign-atlas.json' with { type: 'json' };

const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const digest = (value: unknown): string => hash(JSON.stringify(value));
const blobs = signAtlasBlobs();

test.each(['phone', 'desktop'] as const)('%s retains original WebKit pixels, cells, placements and spill', tier => {
  const row = atlas[tier], before = reference[tier];
  for (const name of ['mono', 'colour'] as const) {
    const bytes = Buffer.from(row[name].packed, 'base64'), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const offset = Number(view.getBigUint64(80, true)), size = Number(view.getBigUint64(88, true));
    const pixels = zstdDecompressSync(bytes.subarray(offset, offset + size));
    expect(view.getUint32(12, true)).toBe(name === 'mono' ? 9 : 43);
    expect(pixels.length).toBe(row[name].bytes);
    expect(hash(pixels)).toBe(before[name]);
    expect(parseKtx2(bytes).gpu).toBe(row[name].bytes);
    const admitted = blobs.find(blob => blob.file.name === `signs/atlas-${tier}-${name}.ktx2`);
    expect(admitted?.file.gpu).toBe(tier === 'phone' ? (name === 'mono' ? 2_796_203 : 2_796_204) : (name === 'mono' ? 11_184_811 : 11_184_812));
  }
  for (const key of ['cells', 'placed', 'lights', 'keys'] as const) expect(digest(row[key])).toBe(before[key]);
  expect(row.placed).toHaveLength(1037);
  expect(Object.keys(row.cells)).toHaveLength(115);
});

test.each(['phone', 'desktop'] as const)('%s restores all 401 original buffers through the existing pool host', async tier => {
  const rows = atlas[tier], before: Readonly<Record<string, string>> = reference[tier].geometry;
  const metadata = blobs.find(blob => blob.file.name === `signs/atlas-${tier}.json`);
  if (metadata === undefined) throw new Error('Missing sign metadata');
  const pools = v.parse(v.object({ pools: v.array(v.object({ name: v.string() })) }), JSON.parse(new TextDecoder().decode(metadata.bytes))).pools;
  const source = Object.entries(rows.geometries);
  for (let start = 0; start < source.length; start += 100) {
    const parts = source.slice(start, start + 100), blob = blobs.find(b => b.file.name === pools[start / 100]?.name);
    if (blob === undefined) throw new Error('Missing baked sign pool');
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: 'sign-pool', parts: parts.map(([name]) => name), channels: SIGN_CHANNELS }] }, 'Nine sign test', {},
    async () => (await readSourceModel(blob.bytes)).gltf);
    await library.preload();
    for (const [name, original] of parts) {
      expect(digest(original)).toBe(before[name]);
      const geometry = library.geometry(name, { borrow: true });
      if (geometry === null) throw new Error(`Missing restored sign ${name}`);
      expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const [channel, attribute] of Object.entries(original.attributes)) {
        const actual = geometry.getAttribute(channel);
        if (!(actual instanceof BufferAttribute)) throw new Error('Unexpected sign storage');
        expect(actual.array).toBeInstanceOf(Float32Array); expect(actual.itemSize).toBe(attribute.width); expect(actual.normalized).toBe(false);
        expect(Buffer.from(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength).toString('base64')).toBe(attribute.data);
      }
      const index = geometry.index;
      if (index === null) throw new Error('Missing sign index');
      expect(index.array).toBeInstanceOf(Uint32Array);
      expect(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength).toString('base64')).toBe(original.index);
      expect(geometry.boundingBox).toBeNull();
      expect(geometry.boundingSphere === null ? null : [...geometry.boundingSphere.center, geometry.boundingSphere.radius]).toEqual(original.sphere);
    }
  }
}, 30_000);

test('existing Signal sand R8 maps use the same raw texture residency law', () => {
  const sand = bakeSignalSand();
  for (const data of [sand.trail, sand.shadow]) {
    const size = Math.sqrt(data.length), bytes = rawKtx2(size, 1, data, zstdCompressSync);
    expect(parseKtx2(bytes).gpu).toBe(data.length);
  }
});
