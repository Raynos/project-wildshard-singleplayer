import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { validateDefinedSection } from '../src/sdk/sections';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';

test('Driftwood publishes every legacy alias as an admitted logical blob name', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle'), custom = loaded.output.custom;
  const row = custom?.sections.find(value => value.name === 'custom/assets');
  if (custom === undefined || row === undefined) throw new Error('Asset registry absent');
  const bytes = custom.files.get(row.path), schema = custom.files.get(row.schema);
  if (bytes === undefined || schema === undefined) throw new Error('Asset registry bytes absent');
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  validateDefinedSection(schema, value);
  const registry = v.parse(SECTIONS['custom/assets'], value);
  const names = new Set(loaded.output.namedFiles?.map(file => file.name));
  expect(Object.keys(registry.byUrl).length).toBeGreaterThan(100);
  for (const name of Object.values(registry.byUrl)) expect(names.has(name)).toBe(true);
  const files = loaded.output.namedFiles ?? [];
  expect(new Set(files.map(file => file.hash)).size).toBe(files.length);
  expect(() => v.parse(SECTIONS['custom/assets'], { byUrl: { broken: null } })).toThrow();
  console.info(`Driftwood custom assets: ${row.bytes} bytes, ${files.length} unique named blobs`);
}, 30000);
