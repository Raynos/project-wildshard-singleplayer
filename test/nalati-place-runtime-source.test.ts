// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original byte and confine actual isolated producers.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare sealed fixture roots below repository tmp.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { preparePlaceRuntime, placeRuntimeRows, type PlaceRuntimeInput } from '../src/shards/nalati-grasslands/generators/placeRuntimeSource.mjs';
import { jsonBytes } from '../scripts/bake-output.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import pins from './fixtures/nalati-place-runtime-files.json' with { type: 'json' };

const prefix = 'src/shards/nalati-grasslands/';
function read(name: PlaceRuntimeInput): unknown { const input: unknown = JSON.parse(readFileSync(`${prefix}${name}`, 'utf8')); return input; }

test('pure runtime preparation preserves all seven complete output pins and input records', () => {
  const inputs = new Map<PlaceRuntimeInput, unknown>();
  for (const name of ['data/campCatalogue.json', 'data/places.json', 'data/dressingGeos.json', 'data/worldView.json', 'data/modelMetrics.json', 'data/staticCapture.json', 'data/poiPaint.json'] as const) inputs.set(name, read(name));
  const select = (name: PlaceRuntimeInput): unknown => inputs.get(name);
  const before = JSON.stringify([...inputs]);
  const files = preparePlaceRuntime(select, jsonBytes);
  expect([...files.keys()].map(name => `${prefix}${name}`).sort()).toEqual(Object.keys(pins).sort());
  for (const [path, hash] of Object.entries(pins)) {
    const bytes = files.get(path.slice(prefix.length));
    if (bytes === undefined) throw new Error(`Missing original runtime output ${path}`);
    expect(hashImmutableBytes(bytes), path).toBe(hash);
    const original = readFileSync(path);
    expect(hashImmutableBytes(original), path).toBe(hash);
    expect(Buffer.compare(bytes, original), path).toBe(0);
  }
  expect(JSON.stringify([...inputs])).toBe(before);
});

test('structured preparation keeps metadata and independent owned floor bytes', () => {
  const normalize = (value: unknown): unknown => { const result: unknown = JSON.parse(new TextDecoder().decode(jsonBytes(value))); return result; };
  const first = placeRuntimeRows(read, normalize);
  const prepared = v.parse(v.looseObject({ floorSources: v.array(v.unknown()) }), JSON.parse(readFileSync(`${prefix}data/placeRuntime.generated.json`, 'utf8')));
  const { floorSources, ...runtime } = prepared;
  expect(first.runtime).toEqual(runtime);
  expect(first.metrics).toEqual(read('data/modelMetrics.json'));
  expect(first.capture).toEqual(read('data/staticCapture.json'));
  expect(first.shapeBook).toEqual(JSON.parse(readFileSync(`${prefix}data/shapeBook.generated.json`, 'utf8')));
  expect(first.floors.map(floor => floor.name)).toEqual(floorSources.map(row => v.parse(v.object({ name: v.string() }), row).name));
  for (const [index, floor] of first.floors.entries()) {
    const row = v.parse(v.object({ source: v.string() }), floorSources[index]);
    expect(Buffer.compare(floor.bytes, readFileSync(`${prefix}${row.source}`))).toBe(0);
    floor.bytes.fill(0);
  }
  const second = placeRuntimeRows(read, normalize);
  for (const [index, floor] of second.floors.entries()) {
    const row = v.parse(v.object({ source: v.string() }), floorSources[index]);
    expect(Buffer.compare(floor.bytes, readFileSync(`${prefix}${row.source}`))).toBe(0);
  }
});

test('original asset and binary coverage refusals remain', () => {
  expect(() => preparePlaceRuntime(name => name === 'data/campCatalogue.json' ? [] : read(name), jsonBytes)).toThrow('Missing asset declaration');
  for (const file of ['data/places.json', 'data/dressingGeos.json'] as const) {
    expect(() => preparePlaceRuntime(name => {
      if (name !== file) return read(name);
      const row = v.parse(v.looseObject({ bytes: v.number() }), read(name));
      return { ...row, bytes: row.bytes + 4 };
    }, jsonBytes)).toThrow('rows do not cover their binary');
  }
  expect(() => preparePlaceRuntime(name => name === 'data/modelMetrics.json' ? new Uint8Array([1]) : read(name), jsonBytes)).toThrow('BINARY-JSON');
});

test('the preparation source bundles as one config-safe chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`${prefix}generators/placeRuntimeSource.mjs`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing runtime preparation bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect([...chunk.imports, ...chunk.dynamicImports]).toEqual([]);
  }
});

for (const omit of [true, false]) {
  test(`sealed runtime producer ${omit ? 'refuses the missing pure source' : 'preserves every original output'}`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-place-runtime');
    if (job === undefined) throw new Error('Missing retained place-runtime producer');
    const source = `${prefix}generators/placeRuntimeSource.mjs`;
    expect(job.inputRoots).toContain(source);
    const cacheDir = mkdtempSync(resolve('tmp/nalati-runtime-pure-'));
    try {
      if (omit) {
        const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== source) };
        const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
        const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }), JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
        writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row => typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? descriptor : row) }));
        await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
      } else {
        const made = await generateShardJob(root, job, { cacheDir, forceCompare: true });
        try { expect(made.hashes).toEqual(pins); } finally { made.release(); }
      }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}
