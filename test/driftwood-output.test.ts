import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { validateDefinedSection } from '../src/sdk/sections';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { BAKED_COVE } from '../src/shards/driftwood-isle/generators/bakedCove';

test('Driftwood fixed draws and island cover files name admitted product blobs (no legacy URL table)', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle'), custom = loaded.output.custom;
  const row = custom?.sections.find(value => value.name === 'custom/fixedLayouts');
  if (custom === undefined || row === undefined) throw new Error('Fixed layouts absent');
  expect(custom.sections.some(value => value.name === 'custom/assets')).toBe(false);
  const bytes = custom.files.get(row.path), schema = custom.files.get(row.schema);
  if (bytes === undefined || schema === undefined) throw new Error('Fixed layout bytes absent');
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  validateDefinedSection(schema, value);
  const layouts = v.parse(SECTIONS['custom/fixedLayouts'], value), names = new Set(loaded.output.namedFiles?.map(file => file.name));
  for (const name of [...layouts.fixedDraws.map(draw => draw.file), BAKED_COVE.wear?.files.phone.file, BAKED_COVE.wear?.files.desktop.file]) expect(names.has(name), name).toBe(true);
  const files = loaded.output.namedFiles ?? [];
  expect(new Set(files.map(file => file.hash)).size).toBe(files.length);
}, 30000);
