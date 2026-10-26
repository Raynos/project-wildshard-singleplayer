// oxlint-disable-next-line import/no-nodejs-modules -- Pin the existing committed native wire bytes independently of the producer.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine sealed producer fixtures to the repository tmp directory.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the original four-byte lane transform independently.
import { deflateSync, inflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { encodeNalatiPart } from '../src/shards/nalati-grasslands/generators/placeWire';
import { committedPlaces } from './fixtures/nalati-committed-places';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { discoverGeneration, generateShardJob, generationInputs } from '../scripts/generate.mjs';
import beforeWires from './fixtures/nalati-place-wires.json' with { type: 'json' };
import { nativePlaceFile } from './fixtures/nalati-native-place-files';

const original = committedPlaces();
const compress = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateSync(bytes, { level: 9 }));
// A sealed native publisher owns current-machine metadata. Independent frozen
// wire tests below still require every complete original metadata/binary pin.
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

for (const omission of ['wire', 'geometry', null] as const) {
  test(`the native places publisher ${omission === null ? 'keeps all original registered outputs' : `refuses the omitted ${omission} producer`}`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-places');
    if (job === undefined) throw new Error('Missing native places producer');
    const wire = 'src/shards/nalati-grasslands/generators/placeWire.ts';
    const geometry = 'src/shards/nalati-grasslands/generators/dressingGeometryRows.ts';
    // The retained publisher owns a folder root. Expand its exact file inventory
    // before omission so that no enclosing root can silently restore the leaf.
    const roots = Object.keys(generationInputs(root, job.inputRoots));
    expect(roots).toContain(wire); expect(roots).toContain(geometry);
    const cacheDir = mkdtempSync(resolve('tmp', 'nalati-wire-stage-'));
    try {
      if (omission !== null) {
        const absent = omission === 'wire' ? wire : geometry;
        const descriptor = { ...job, inputRoots: roots.filter(file => file !== absent) };
        const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
        const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }),
          JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
        writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row =>
          typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? descriptor : row) }));
        await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
      } else {
        const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
        try {
          expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
          for (const file of job.outputs) {
            const actual = readFileSync(resolve(result.directory, file));
            expect(result.hashes[file], file).toBe(hashImmutableBytes(actual));
            const expected = file.endsWith('.json') ? nativePlaceFile(file.slice(file.lastIndexOf('/') + 1)) : undefined;
            if (expected !== undefined) {
              expect(Buffer.compare(actual, expected), file).toBe(0);
            } else {
              const pin = beforeWires.find(row => row.path === file);
              if (pin === undefined) throw new Error('Missing original native binary pin');
              expect(actual.byteLength, file).toBe(pin.bytes);
              expect(hashImmutableBytes(actual), file).toBe(pin.hash);
            }
          }
        } finally { result.release(); }
      }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}
