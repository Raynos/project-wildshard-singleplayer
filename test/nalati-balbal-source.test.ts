import { nalatiRuntime } from './fixtures/nalati-runtime';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the complete original balbal declaration oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the pure declaration bundle for the guard proof.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '../src/format/specimenCatalogue';
import { SceneBakedGeometrySchema } from '../src/format/sceneDressing';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiBalbalSpecimen } from '../src/shards/nalati-grasslands/generators/balbalSpecimen';

const root = 'src/shards/nalati-grasslands/data/';
const read = (file: string): unknown => JSON.parse(readFileSync(`${root}${file}`, 'utf8'));

test('native carving inputs preserve the complete original balbal catalogue and encounter sites', () => {
  const places = v.parse(v.object({ places: v.object({ rows: v.array(v.object({ name: v.string(),
    meshes: v.array(v.object({ geometry: SceneBakedGeometrySchema })) })) }) }), nalatiRuntime);
  const specimens = v.parse(v.object({ assets: v.object({ balbal: v.record(v.string(), v.unknown()) }), materials: v.object({ poi: v.unknown() }) }), JSON.parse(readFileSync('test/fixtures/nalati-specimens-original.json', 'utf8')));
  const metrics = v.parse(v.object({ sizes: v.object({ balbal: v.tuple([v.number(), v.number(), v.number()]) }) }), read('modelMetrics.json'));
  const bare = places.places.rows.find(row => row.name === 'actor:balbal:0:2977')?.meshes[0]?.geometry;
  const capped = places.places.rows.find(row => row.name === 'actor:balbal:1:2977')?.meshes[0]?.geometry;
  if (bare === undefined || capped === undefined) throw new Error('Missing native carving geometry');
  const make = () => nalatiBalbalSpecimen(bare, capped, specimens.assets.balbal, specimens.materials.poi, metrics.sizes.balbal[1]);
  const made = make(), catalogue = v.parse(SpecimenCatalogueSchema, made.catalogue);
  const bytes = new TextEncoder().encode(`${JSON.stringify({ ...made, catalogue }, null, 2)}\n`);
  const original = readFileSync('test/fixtures/nalati-balbal-original.json');
  expect(hashImmutableBytes(original)).toBe('2eb6117fd6b08dc2b6d8ac8c09b7c1e4e0aacbc77879154e2bfad810df48a948');
  expect(Buffer.compare(bytes, original)).toBe(0);
  made.sites.variantCycle.fill(9); made.generated.transform.scale = 9;
  expect(make().sites.variantCycle).toEqual([1, 0, 0]);
  expect(make().generated.transform.scale).toBe(2.15 / metrics.sizes.balbal[1]);
  expect(() => nalatiBalbalSpecimen(bare, capped, specimens.assets.balbal, specimens.materials.poi, 0)).toThrow('positive native model height');
  expect(() => v.parse(SpecimenCatalogueSchema, nalatiBalbalSpecimen({ ...bare, count: -1 }, capped, specimens.assets.balbal, specimens.materials.poi, metrics.sizes.balbal[1]).catalogue)).toThrow();
});

test('balbal declaration construction remains one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/balbalSpecimen.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing balbal declaration bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
