// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original shipping carving and prop word.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the pure author entry for the bundle boundary proof.
import { resolve } from 'node:path';
import { unzlibSync } from 'fflate';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { SceneBakedGeometrySchema } from '../src/format/sceneDressing';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiNativePlaceParts, nalatiPlaceParts } from '../src/shards/nalati-grasslands/generators/placeParts';

const root = 'src/shards/nalati-grasslands/';
const inputSchema = v.object({ places: v.object({ rows: v.array(v.object({ name: v.string(), meshes: v.array(v.object({
  offset: v.pipe(v.number(), v.integer(), v.minValue(0)), geometry: SceneBakedGeometrySchema,
})) })) }) });
const original = [
  ['actor:balbal:0:2977', 'balbal-carving-0.generated.bin', '822694b3287b5b09781e531c2edfbc5def284a757fc097dcc23061b09e79f85c'],
  ['actor:balbal:1:2977', 'balbal-carving-1.generated.bin', '45ac62fdf44b83dd06ed55de034577712732a535385de1718e16862279b4634f'],
  ['actor:goat', 'quest-prop.generated.bin', 'ec1282219cd79471dbbdfa8d58e801ebb4b95e73d44106f7e325eb0fc9028440'],
] as const;

test('all three detached parts preserve every shipping word, geometry row and source byte', () => {
  const runtime: unknown = JSON.parse(readFileSync(`${root}data/placeRuntime.generated.json`, 'utf8'));
  const metadata = v.parse(inputSchema, runtime);
  const lanes = unzlibSync(readFileSync('public/assets/nalati/baked/places.bin')), raw = new Uint8Array(lanes.length);
  for (let byte = 0; byte < 4; byte++) for (let word = 0; word < lanes.length / 4; word++) raw[word * 4 + byte] = lanes[byte * lanes.length / 4 + word] ?? 0;
  const before = hashImmutableBytes(raw), parts = nalatiPlaceParts(metadata, raw, original.map(([name]) => name));
  expect([...parts.keys()]).toEqual(original.map(([name]) => name));
  for (const [name, path, hash] of original) {
    const part = parts.get(name); if (part === undefined) throw new Error('Missing original part');
    const old = readFileSync(`${root}data/${path}`);
    expect(hashImmutableBytes(part.bytes), path).toBe(hash);
    expect(hashImmutableBytes(old), path).toBe(hash);
    expect(Buffer.compare(part.bytes, old), path).toBe(0);
    expect(part.geometry, path).toEqual(metadata.places.rows.find(row => row.name === name)?.meshes[0]?.geometry);
    part.bytes.fill(0);
  }
  expect(hashImmutableBytes(raw)).toBe(before);
});

test('padding, index words and every missing/ambiguous/out-of-range part retain strict admission', () => {
  const geometry = v.parse(SceneBakedGeometrySchema, { attrs: [['position', 'u8', 3, false]], count: 1, index: 'u16', indexCount: 3, box: false, expand: false });
  const row = { name: 'part', meshes: [{ offset: 4, geometry }] };
  const input = { places: { rows: [row] } }, raw = Uint8Array.from({ length: 24 }, (_, i) => i);
  expect(nalatiPlaceParts(input, raw, ['part']).get('part')?.bytes).toEqual(raw.slice(4, 20));
  expect(() => nalatiPlaceParts(input, raw, ['absent'])).toThrow('Missing or ambiguous');
  expect(() => nalatiPlaceParts(input, raw, ['part', 'part'])).toThrow('Duplicate');
  expect(() => nalatiPlaceParts({ places: { rows: [row, row] } }, raw, ['part'])).toThrow('Missing or ambiguous');
  expect(() => nalatiPlaceParts(input, new Uint8Array(3), ['part'])).toThrow('whole words');
  for (const offset of [-1, 3, 12]) expect(() => nalatiPlaceParts({ places: { rows: [{ ...row, meshes: [{ offset, geometry }] }] } }, raw, ['part'])).toThrow();
  expect(() => v.parse(inputSchema, {})).toThrow();
  const native = [{ name: 'unselected', meshes: [{ geometry }] }, { name: 'part', meshes: [{ geometry }] }];
  const words = Uint8Array.from({ length: 32 }, (_, i) => i);
  expect(nalatiNativePlaceParts(native, words, ['part']).get('part')?.bytes).toEqual(words.slice(16));
  expect(() => nalatiNativePlaceParts(native, words.slice(4), ['part'])).toThrow('complete raw span');
  expect(() => nalatiNativePlaceParts(native, words, ['missing'])).toThrow('Missing or ambiguous');
});

test('part extraction remains one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`${root}generators/placeParts.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing part author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
