import { expect, test } from 'vitest';
import * as v from 'valibot';
import { defineSection, emitDefinedSections, validateDefinedSection } from '../src/sdk/sections';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { validateCustomSchema, validateCustomSchemaPaced } from '../src/game/shardfile/customSchema';

const schema = v.strictObject({ label: v.string(), enabled: v.optional(v.boolean(), false), rows: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))) });
const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(value));

test('paced schema admission keeps strict acceptance and stops on owner cancellation', async () => {
  const section = defineSection('custom/paced', schema, { label: 'Camp', rows: [2] });
  const good = { label: 'Camp', enabled: false, rows: [2] };
  let paints = 0;
  const pause = (): Promise<void> => { paints++; return Promise.resolve(); };
  expect(await validateCustomSchemaPaced(section.jsonSchema, good, pause)).toBe(good);
  expect(paints).toBeGreaterThan(1);
  for (const bad of [{ ...good, rows: ['2'] }, { ...good, rows: [-1] }, { ...good, extra: true }, { rows: [] }]) {
    expect(() => validateCustomSchema(section.jsonSchema, bad)).toThrow();
    await expect(validateCustomSchemaPaced(section.jsonSchema, bad, pause)).rejects.toThrow();
  }
  await expect(validateCustomSchemaPaced(section.jsonSchema, good, () => Promise.reject(new Error('Owner disposed')))).rejects.toThrow('Owner disposed');
  const asyncSchema = { $schema: 'http://json-schema.org/draft-07/schema#', $async: true, type: 'object' };
  await expect(validateCustomSchemaPaced(asyncSchema, {}, pause)).rejects.toThrow('asynchronous');
});

test('runtime and authoring validators share strict draft-07 refusal semantics', () => {
  const section = defineSection('custom/probe', schema, { label: 'Camp', rows: [2] });
  const validateBuild = (value: unknown) => validateDefinedSection(bytes(section.jsonSchema), value);
  const validateRuntime = (value: unknown) => validateCustomSchema(section.jsonSchema, value);
  const good = { label: 'Camp', enabled: false, rows: [2] };
  expect(validateBuild(good)).toEqual(validateRuntime(good));
  for (const bad of [{ ...good, rows: ['2'] }, { ...good, rows: [-1] }, { ...good, extra: true }, { rows: [] }]) {
    expect(() => validateBuild(bad)).toThrow();
    expect(() => validateRuntime(bad)).toThrow();
  }
});

test('custom sections emit independently validated canonical files', () => {
  const section = defineSection('custom/example', schema, { label: 'Camp', rows: [2, 3] });
  const emitted = emitDefinedSections([section]);
  const entry = emitted.sections.find(row => row.name === 'custom/example');
  expect(entry).toMatchObject({ name: 'custom/example', path: 'sections/custom/example.json', schema: 'schemas/custom/example.schema.json' });
  if (entry === undefined) throw new Error('Missing emitted section');
  const valueBytes = emitted.files.get(entry.path), schemaBytes = emitted.files.get(entry.schema);
  if (valueBytes === undefined || schemaBytes === undefined) throw new Error('Missing emitted files');
  const value: unknown = JSON.parse(new TextDecoder().decode(valueBytes));
  expect(validateDefinedSection(schemaBytes, value)).toEqual({ label: 'Camp', enabled: false, rows: [2, 3] });
  expect(() => validateDefinedSection(schemaBytes, { label: 'Camp', enabled: false, rows: [-1] })).toThrow('refuses its schema');
  expect(() => validateDefinedSection(schemaBytes, { label: 'Camp', rows: [], extra: true })).toThrow('refuses its schema');
  expect(() => validateDefinedSection(schemaBytes, { label: 'Camp', rows: ['2'] })).toThrow('refuses its schema');
  expect(new TextDecoder().decode(valueBytes)).toBe(encodeCanonicalJson(value));
  expect(emitDefinedSections([section, defineSection('custom/another', v.string(), 'Other')]).sections.map(row => row.name)).toEqual(['custom/another', 'custom/example']);
});

test('custom declarations refuse code, unrepresentable schemas and path collisions', () => {
  expect(() => defineSection('custom/../escape', v.string(), 'x')).toThrow('name');
  expect(() => defineSection('world/terrain', v.string(), 'x')).toThrow('name');
  expect(() => defineSection('custom/code', v.unknown(), () => 1)).toThrow('plain JSON');
  expect(() => defineSection('custom/date', v.unknown(), new Date())).toThrow('plain JSON');
  expect(() => defineSection('custom/check', v.pipe(v.number(), v.check(n => n > 0)), 1)).toThrow();
  expect(() => defineSection('custom/transform', v.pipe(v.string(), v.transform(value => value.length)), 'abc')).toThrow();
  let reads = false;
  const accessor = { get label() { reads = true; return 'Camp'; } };
  expect(() => defineSection('custom/getter', v.unknown(), accessor)).toThrow('plain JSON');
  expect(reads).toBe(false);
  const cyclic: { next?: object } = {}; cyclic.next = cyclic;
  expect(() => defineSection('custom/cycle', v.unknown(), cyclic)).toThrow('plain JSON');
  const section = defineSection('custom/example', schema, { label: 'Camp', rows: [] });
  expect(() => emitDefinedSections([section, section])).toThrow('Duplicate');
  section.value.rows.push(-1);
  expect(() => emitDefinedSections([section])).toThrow('refuses its schema');
});

test('on-disk schema admission refuses corruption, external code and async validators', () => {
  const draft = 'http://json-schema.org/draft-07/schema#';
  expect(() => validateDefinedSection(new Uint8Array([255]), {})).toThrow();
  expect(() => validateDefinedSection(bytes({ $schema: draft, $ref: 'https://example.invalid/schema.json' }), {})).toThrow();
  expect(() => validateDefinedSection(bytes({ $schema: draft, $async: true, type: 'object' }), {})).toThrow('asynchronous');
  expect(() => validateDefinedSection(bytes({ $schema: draft, type: 'string', inventedCheck: true }), 'x')).toThrow();
  expect(() => validateDefinedSection(new TextEncoder().encode('{"$schema":"http://json-schema.org/draft-07/schema#","type":"string","type":"number"}'), 1)).toThrow('canonical');
});
