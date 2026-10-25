// oxlint-disable-next-line import/no-nodejs-modules -- Exact independent pre-conversion runtime reference hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the retained lossless KTX2 payload before browser decoding.
import { zstdDecompressSync, zstdCompressSync } from 'node:zlib';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute } from 'three';
import { createModelLibrary } from '../../src/game/plugin/geometry';
import { readSourceModel } from '../../src/sdk/bake/skinned';
import { parseKtx2 } from '../../src/format/product';
import { rawKtx2, bakeSignalSand } from '../../src/shards/sunscar-dunes/generators/sand';
import { signAtlasBlobs } from '../../src/shards/nine-dragon-stack/generators/signAtlasOutput';
import { parseNativeSignAtlas } from '../../src/shards/nine-dragon-stack/generators/nativeSignMetadata';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the original atlas bytes without a generated JSON type program.
import { readFileSync } from 'node:fs';
import { nineSignBlobs } from '../fixtures/nine-sign-blobs';
import binaryReference from '../fixtures/nine-sign-binary.json' with { type: 'json' };
import reference from '../fixtures/nine-sign-atlas.json' with { type: 'json' };

const finite=v.pipe(v.number(),v.finite());
const atlas=(()=>{
  const value:unknown=JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/signAtlas.generated.json','utf8'));
  return parseNativeSignAtlas(value);
})();

const glyphTier = v.object({ size: finite, packed: v.array(v.string()),
  layout: v.object({ cell: finite, fontPx: finite, spread: finite, skeletonSpread: finite }),
  rects: v.record(v.string(), v.object({ u0: finite, v0: finite, u1: finite, v1: finite })),
});
const glyphs = (() => {
  const value: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/glyphs.generated.json', 'utf8'));
  return v.parse(v.object({ phone: glyphTier, desktop: glyphTier }), value);
})();

const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const digest = (value: unknown): string => hash(JSON.stringify(value));
const read = (file: string): Uint8Array => new Uint8Array(readFileSync(`src/shards/nine-dragon-stack/data/${file}`));
const blobs = await nineSignBlobs();
const slice = (bytes: Uint8Array, row: { byteOffset: number; byteLength: number }): Uint8Array => bytes.slice(row.byteOffset, row.byteOffset + row.byteLength);

test('native metadata refuses missing tiers, invalid ranges and non-finite light rows', () => {
  expect(() => parseNativeSignAtlas({ phone: atlas.phone })).toThrow();
  expect(() => parseNativeSignAtlas({ ...atlas, phone: { ...atlas.phone, geometries: { invalid: { attributes: {}, index: { byteOffset: -1, byteLength: 4 }, sphere: null } } } })).toThrow();
  expect(() => parseNativeSignAtlas({ ...atlas, desktop: { ...atlas.desktop, lights: [{ at: [0, 0, 0], color: [1, 1, 1], w: 1, h: 1, power: Number.NaN, spill: 0 }] } })).toThrow();
});

test('portable sign assembly retains every original named byte and cost', () => {
  expect(blobs.map(row => row.file)).toStrictEqual(binaryReference.files);
  expect(signAtlasBlobs(read).map(row => row.file)).toStrictEqual(binaryReference.files);
});

test('portable sign assembly reads every supplied native input and keeps the original product', () => {
  const alias = (file: string): string => `provided/${file}`;
  const tier = (key: 'phone' | 'desktop') => ({ ...atlas[key], buffer: alias(atlas[key].buffer),
    mono: { ...atlas[key].mono, packed: alias(atlas[key].mono.packed) },
    colour: { ...atlas[key].colour, packed: alias(atlas[key].colour.packed) } });
  const field = (key: 'phone' | 'desktop') => ({ ...glyphs[key], packed: glyphs[key].packed.map(alias) });
  const reads: string[] = [];
  const supplied = signAtlasBlobs(file => {
    expect(file.startsWith('provided/')).toBe(true); reads.push(file);
    return read(file.slice('provided/'.length));
  }, { atlas: { phone: tier('phone'), desktop: tier('desktop') }, glyphs: { phone: field('phone'), desktop: field('desktop') } });
  expect(new Set(reads).size).toBe(11);
  expect(supplied.map(row => row.file)).toStrictEqual(binaryReference.files);
});

test.each(['phone', 'desktop'] as const)('%s retains original WebKit pixels, cells, placements and spill', tier => {
  const row = atlas[tier], before = reference[tier];
  for (const name of ['mono', 'colour'] as const) {
    const bytes = read(row[name].packed), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
  const rows = atlas[tier], before: Readonly<Record<string, string>> = binaryReference.geometry[tier], binary = read(rows.buffer);
  const metadata = blobs.find(blob => blob.file.name === `signs/atlas-${tier}.json`);
  if (metadata === undefined) throw new Error('Missing sign metadata');
  const { pools, channels } = v.parse(v.object({ pools: v.array(v.object({ name: v.string() })),
    channels: v.array(v.object({ name: v.string(), source: v.string(), width: v.number(), parts: v.optional(v.array(v.string())) })) }), JSON.parse(new TextDecoder().decode(metadata.bytes)));
  const source = Object.entries(rows.geometries);
  for (let start = 0; start < source.length; start += 100) {
    const parts = source.slice(start, start + 100), blob = blobs.find(b => b.file.name === pools[start / 100]?.name);
    if (blob === undefined) throw new Error('Missing baked sign pool');
    const names = parts.map(([name]) => name), localChannels = channels.flatMap(({ parts: channelParts, ...row }) => {
      const scopedParts = channelParts?.filter(part => names.includes(part));
      return scopedParts?.length === 0 ? [] : [{ ...row, ...(scopedParts === undefined ? {} : { parts: scopedParts }) }];
    });
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: 'sign-pool', parts: names, channels: localChannels }] }, 'Nine sign test', {},
    async () => (await readSourceModel(blob.bytes)).gltf);
    await library.preload();
    for (const [name, original] of parts) {
      expect(digest({attributes:Object.fromEntries(Object.entries(original.attributes).map(([key, a]) => [key,{width:a.width,data:hash(slice(binary,a.data))}])),index:hash(slice(binary,original.index)),sphere:original.sphere})).toBe(before[name]);
      const geometry = library.geometry(name, { borrow: true });
      if (geometry === null) throw new Error(`Missing restored sign ${name}`);
      expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const [channel, attribute] of Object.entries(original.attributes)) {
        const actual = geometry.getAttribute(channel);
        if (!(actual instanceof BufferAttribute)) throw new Error('Unexpected sign storage');
        expect(actual.array).toBeInstanceOf(Float32Array); expect(actual.itemSize).toBe(attribute.width); expect(actual.normalized).toBe(false);
        expect(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength)).toEqual(slice(binary, attribute.data));
      }
      const index = geometry.index;
      if (index === null) throw new Error('Missing sign index');
      expect(index.array).toBeInstanceOf(Uint32Array);
      expect(new Uint8Array(index.array.buffer, index.array.byteOffset, index.array.byteLength)).toEqual(slice(binary, original.index));
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
