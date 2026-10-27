// oxlint-disable-next-line import/no-nodejs-modules -- Pin the existing committed native wire bytes independently of the producer.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real native source closure.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the original four-byte lane transform independently.
import { deflateSync, inflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { encodeNalatiPart } from '../src/shards/nalati-grasslands/generators/placeWire';
import { committedPlaces } from './fixtures/nalati-committed-places';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import beforeWires from './fixtures/nalati-place-wires.json' with { type: 'json' };
import { nativePlaceFile } from './fixtures/nalati-native-place-files';

const original = committedPlaces();
const compress = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateSync(bytes, { level: 9 }));
// The source product owns current-machine metadata. Independent frozen wire
// tests below still require every complete original metadata/binary pin.
for (const [name, document] of [['places', 'places.json'], ['specimens', 'placeSpecimens.json'], ['dressing', 'nalati-dressing-geos.json']] as const) {
  test(`the pure ${name} wire preserves every committed geometry and metadata byte`, () => {
    const before = original[name], inputHash = hashImmutableBytes(before.raw);
    const encoded = encodeNalatiPart({ rows: before.rows.rows, bin: before.raw }, compress);
    const binaryPath = name === 'dressing' ? 'test/fixtures/nalati-dressing.bin' : `public/assets/nalati/baked/${name}.bin`;
    const documentPath = name === 'dressing' ? `test/fixtures/${document}` : `src/shards/nalati-grasslands/data/${document}`;
    const binary = name === 'dressing' ? readFileSync(binaryPath) : nativePlaceFile(`${name}.bin`), rows = readFileSync(name === 'places' ? 'test/fixtures/nalati-places-original.json' : name === 'specimens' ? 'test/fixtures/nalati-packed-specimens-original.json' : documentPath);
    for (const [path, actual, committed] of [[binaryPath, encoded.binary, binary], [documentPath, encoded.document, rows]] as const) {
      const expected = beforeWires.find(row => row.path === path);
      if (expected === undefined) throw new Error('Missing predecessor wire oracle');
      expect({ path, bytes: actual.byteLength, hash: hashImmutableBytes(actual) }).toEqual(expected);
      expect(hashImmutableBytes(committed)).toBe(expected.hash);
    }
    expect(hashImmutableBytes(before.raw)).toBe(inputHash);
    expect(encoded.binary.buffer === before.raw.buffer).toBe(false);
  });
}

test('wire lanes select only the original view and preserve the source backing', () => {
  const backing = new Uint8Array([99, 0, 1, 2, 3, 4, 5, 6, 7, 88]), before = backing.slice();
  const encoded = encodeNalatiPart({ rows: [], bin: backing.subarray(1, 9) }, compress);
  expect(new Uint8Array(inflateSync(encoded.binary))).toEqual(new Uint8Array([0, 4, 1, 5, 2, 6, 3, 7]));
  expect(backing).toEqual(before);
});

test('incomplete words retain the native producer refusal', () => {
  expect(() => encodeNalatiPart({ rows: [], bin: new Uint8Array(3) }, compress)).toThrow('the bake is not whole words');
});

test('the authoring wire bundles without publication or runtime services', async () => {
  const built = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/placeWire.ts'), formats: ['es'], fileName: 'place-wire' },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const output = Array.isArray(built) ? built[0] : built;
  if (output === undefined || !('output' in output)) throw new Error('Missing authoring wire bundle');
  const chunks = output.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('Missing wire chunk');
  expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
  expect([...chunk.imports, ...chunk.dynamicImports].sort()).toEqual(['node:crypto']);
  expect(() => assertConfigBoundary([...chunk.imports, 'node:fs'])).toThrow('must use injected build capabilities');
});

for (const omitted of ['placeWire', 'dressingGeometryRows', null] as const) {
  test(`the native places source ${omitted === null ? 'keeps the complete wire and geometry closure' : `refuses the omitted ${omitted} producer`}`, async () => {
    const result = build({ configFile: false, logLevel: 'silent',
      plugins: omitted === null ? [] : [{ name: 'missing-native-places-source', enforce: 'pre',
        resolveId(source) { if (source === `./${omitted}`) throw new Error(`Missing native places source ${omitted}`); } }],
      build: { write: false, minify: false,
        lib: { entry: resolve('src/shards/nalati-grasslands/generators/placesProgram.ts'), formats: ['es'] },
        rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
    if (omitted !== null) {
      await expect(result).rejects.toThrow(`Missing native places source ${omitted}`);
    } else {
      const output = await result, built = Array.isArray(output) ? output[0] : output;
      if (built === undefined || !('output' in built)) throw new Error('Missing native places bundle');
      const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
      for (const chunk of chunks) {
        expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
        for (const name of ['placeWire', 'dressingGeometryRows']) {
          expect(Object.keys(chunk.modules).some(path => path.endsWith(`/generators/${name}.ts`)), name).toBe(true);
        }
      }
    }
  });
}

test('the places publisher and all four handoffs remain retired', () => {
  const retired = beforeWires.slice(0, 4).map(row => row.path);
  for (const file of retired) expect(existsSync(file), file).toBe(false);
});
