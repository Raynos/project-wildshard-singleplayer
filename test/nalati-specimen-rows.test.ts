// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete original specimen declaration and source inputs.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the owned source entry and confined omitted-input stage.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { nalatiSpecimenRows } from '../src/shards/nalati-grasslands/generators/specimenRows';
import { SpecimenCatalogueSchema, SpecimenMaterialSchema } from '../src/format/specimenCatalogue';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { NALATI_MAP_INPUTS, nalatiMapPixels } from '../src/shards/nalati-grasslands/generators/mapProgram';

const project = 'src/shards/nalati-grasslands/';
// This schema only validates values. Keep original key order for the complete historical wire pin.
function originalCatalogue(input:unknown):input is v.InferOutput<typeof SpecimenCatalogueSchema>{return v.is(SpecimenCatalogueSchema,input);}
const catalogue:unknown = JSON.parse(readFileSync(`${project}data/campCatalogue.json`, 'utf8'));
const materials:unknown = JSON.parse(readFileSync(`${project}data/campMaterials.json`, 'utf8'));
if(!originalCatalogue(catalogue)||!v.is(v.record(v.string(),SpecimenMaterialSchema),materials))throw new Error('Invalid original Nalati declarations');
const packed = v.parse(v.record(v.string(), v.unknown()), JSON.parse(readFileSync('test/fixtures/nalati-packed-specimens-original.json', 'utf8')));
const make = () => nalatiSpecimenRows(catalogue, materials, packed);
const retired = ['data/specimens.generated.json', 'boot/specimenParams.generated.d.ts', 'data/specimens.generated.d.json.ts'];

test('supplied packed metadata has detached ownership and does not mutate inputs', () => {
  const before = JSON.stringify([catalogue, materials, packed]);
  const first = make(), pristine = JSON.stringify(first);
  expect(first.catalogue).not.toBe(catalogue); expect(first.packed['rows']).not.toBe(packed['rows']);
  const poi = first.materials['poi']; if (poi === undefined) throw new Error('Missing original POI material');
  Reflect.set(poi, 'rim', 99);
  Reflect.set(first.packed, 'bytes', 0);
  expect(JSON.stringify(make())).toBe(pristine);
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

test('source-owned specimens keep the publisher handoffs retired', () => {
  for (const file of retired) expect(existsSync(`${project}${file}`), file).toBe(false);
});

// GR6: the map is a source program; without the specimen composer's camp catalogue it refuses
test('the map program refuses an omitted specimen composer input', async () => {
  const bank = new Map(NALATI_MAP_INPUTS.map(name => [name, new Uint8Array(readFileSync(name.startsWith('/') ? `public${name}` : `${project}${name}`))]));
  bank.delete('data/campCatalogue.json');
  await expect(nalatiMapPixels(bank)).rejects.toThrow('Undeclared Nalati map input');
});
