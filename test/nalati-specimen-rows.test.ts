// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete original specimen declaration and source inputs.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine real omitted-input producers to owned scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { nalatiSpecimenRows } from '../src/shards/nalati-grasslands/generators/specimenRows';
import { SpecimenCatalogueSchema, SpecimenMaterialSchema } from '../src/format/specimenCatalogue';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

const project = 'src/shards/nalati-grasslands/';
const catalogue: unknown = JSON.parse(readFileSync(`${project}data/campCatalogue.json`, 'utf8'));
const materials: unknown = JSON.parse(readFileSync(`${project}data/campMaterials.json`, 'utf8'));
if (!v.is(SpecimenCatalogueSchema, catalogue) || !v.is(v.record(v.string(), SpecimenMaterialSchema), materials)) throw new Error('Invalid original Nalati declarations');
const original: unknown = JSON.parse(readFileSync('test/fixtures/nalati-specimens-original.json', 'utf8'));
const packed = v.parse(v.record(v.string(), v.unknown()), JSON.parse(readFileSync(`${project}data/placeSpecimens.json`, 'utf8')));
const make = () => nalatiSpecimenRows(catalogue, materials, packed);
const pins = new Map([
  [`${project}data/specimens.generated.json`, '301801ce71966a97e7526c7298b441f9c590c5213aa4052897d7ef748c132771'],
  [`${project}boot/specimenParams.generated.d.ts`, 'ff4f0176c7a72949da2b7941ed3c4c12cbd55e78d73e2eaebde48a0798eae464'],
  [`${project}data/specimens.generated.d.json.ts`, '654c5543c7ef22cf75a7999dc5d4212865ee54addeb79a29c3f907687b8e9fb3'],
]);

test('supplied packed metadata retains every original declaration byte with detached ownership', () => {
  const before = JSON.stringify([catalogue, materials, packed]);
  expect(packed['bin']).toBe('808944903de01633e494e089320031416badcf7617b4d71f1fed2968b11bd462');
  const first = make(), bytes = new TextEncoder().encode(`${JSON.stringify(first, null, 2)}\n`);
  expect(bytes.byteLength).toBe(110932);
  expect(hashImmutableBytes(bytes)).toBe(pins.get(`${project}data/specimens.generated.json`));
  expect(Buffer.compare(bytes, readFileSync('test/fixtures/nalati-specimens-original.json'))).toBe(0);
  expect(first.catalogue).not.toBe(catalogue); expect(first.packed['rows']).not.toBe(packed['rows']);
  const poi = first.materials['poi']; if (poi === undefined) throw new Error('Missing original POI material');
  Reflect.set(poi, 'rim', 99);
  Reflect.set(first.packed, 'bytes', 0);
  expect(JSON.stringify(make())).toBe(JSON.stringify(original));
  expect(JSON.stringify([catalogue, materials, packed])).toBe(before);
  expect(() => nalatiSpecimenRows(catalogue.filter(row => row.key !== 'kokparRider'), materials, packed)).toThrow('Missing original Nalati rider asset');
});

test('the specimen value composer stays in one config-safe chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`${project}generators/specimenRows.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing specimen author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect([...chunk.imports, ...chunk.dynamicImports]).toEqual([]);
  }
});

for (const omitted of [true, false]) test(`sealed specimen publisher ${omitted ? 'refuses its missing composer' : 'preserves every original output'}`, async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'camp-specimen-catalogue');
  if (job === undefined) throw new Error('Missing retained specimen publisher');
  const helper = `${project}generators/specimenRows.ts`;
  expect(job.inputRoots).toContain(helper);
  const cacheDir = mkdtempSync(resolve('tmp/nalati-specimen-values-'));
  try {
    if (omitted) {
      const descriptor = { ...job, inputRoots: job.inputRoots.filter(path => path !== helper) };
      const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
      const catalog = v.parse(v.looseObject({ jobs: v.array(v.unknown()) }), JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
      catalog.jobs = catalog.jobs.map(row => typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? descriptor : row);
      writeFileSync(resolve(root, catalogPath), JSON.stringify(catalog));
      await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    } else {
      const made = await generateShardJob(root, job, { cacheDir, forceCompare: true });
      try {
        expect(Object.keys(made.hashes).sort()).toEqual([...job.outputs].sort());
        for (const path of job.outputs) expect(made.hashes[path], path).toBe(hashImmutableBytes(readFileSync(path)));
        for (const [path, hash] of pins) expect(made.hashes[path], path).toBe(hash);
      } finally { made.release(); }
    }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
