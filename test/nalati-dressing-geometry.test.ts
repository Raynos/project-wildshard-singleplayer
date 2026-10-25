// oxlint-disable-next-line import/no-nodejs-modules -- Verify the complete retained native wire files.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The original wire uses Node zlib level 9.
import { deflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining geometry producer in isolation.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { build } from 'vite';
import { bakeDressing } from '../src/shards/nalati-grasslands/generators/dressingGeometryRows';
import { encodeNalatiPart } from '../src/shards/nalati-grasslands/generators/placeWire';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import pins from './fixtures/nalati-place-wires.json' with { type: 'json' };
import coverPins from './fixtures/nalati-cover-files.json' with { type: 'json' };

function wire() { return encodeNalatiPart(bakeDressing(), bytes => new Uint8Array(deflateSync(bytes, { level: 9 }))); }

test('geometry-only construction preserves every original dressing wire byte', () => {
  const files = wire();
  for (const [path, bytes] of [['public/assets/nalati/baked/dressing.bin', files.binary],
    ['src/shards/nalati-grasslands/data/dressingGeos.json', files.document]] as const) {
    const pin = pins.find(row => row.path === path);
    if (pin === undefined) throw new Error('Missing original dressing wire pin');
    expect({ path, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(pin);
    expect(Buffer.compare(bytes, readFileSync(path))).toBe(0);
  }
});

test('later geometry builds retain independent complete bytes', () => {
  const first = bakeDressing(), original = hashImmutableBytes(first.bin);
  first.bin.fill(0);
  const second = bakeDressing();
  expect(hashImmutableBytes(second.bin)).toBe(original);
  expect(second.rows).toEqual(first.rows);
});

test('native geometry construction has no scene material or runtime dependency', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingGeometryRows.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing native geometry bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect([...chunk.imports, ...chunk.dynamicImports]).toEqual([]);
    expect(chunk.code).not.toContain('PainterlyMaterial');
  }
});


for (const omit of [true, false]) {
  test(`the native cover reader ${omit ? 'refuses omitted geometry source' : 'preserves every original file without dressing handoffs'}`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-cover');
    if (job === undefined) throw new Error('Missing native cover producer');
    const source = 'src/shards/nalati-grasslands/generators/dressingGeometryRows.ts';
    expect(job.inputRoots).toContain(source);
    expect(job.inputRoots).not.toContain('src/shards/nalati-grasslands/data/dressingGeos.json');
    expect(job.inputRoots).not.toContain('public/assets/nalati/baked/dressing.bin');
    const cacheDir = mkdtempSync(resolve('tmp/nalati-cover-owned-'));
    try {
      if (omit) {
        const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== source) };
        const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
        const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }), JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
        writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row => typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? descriptor : row) }));
        await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
      } else {
        const made = await generateShardJob(root, job, { cacheDir, forceCompare: true });
        try {
          expect(Object.keys(made.hashes).sort()).toEqual([...job.outputs].sort());
          expect(Object.keys(made.hashes).sort()).toEqual(Object.keys(coverPins).sort());
          for (const [file, pin] of Object.entries(coverPins)) {
            expect(made.hashes[file], file).toBe(pin.hash);
            const original = readFileSync(file);
            expect({ bytes: original.length, hash: hashImmutableBytes(original) }, file).toEqual(pin);
          }
        } finally { made.release(); }
      }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}
