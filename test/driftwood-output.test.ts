import { expect, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the ordinary build's exact emitted schema, never rebuild the author.
import { readFile } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an already admitted output inventory path.
import { resolve } from 'node:path';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { builtProduct } from './fixtures/builtProduct';
import { validateDefinedSection } from '../src/sdk/sections';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { BAKED_COVE } from './fixtures/driftwood-baked-cove';

test('Driftwood fixed draws and island cover files name admitted product blobs (no legacy URL table)', async () => {
  const root = builtProduct('driftwood-isle'), product = await loadHeadlessProduct(root), output = outputDescriptor(product.shardfile);
  const row = output?.index.sections.find(value => value.name === 'custom/fixedLayouts');
  if (output === undefined || row === undefined) throw new Error('Fixed layouts absent');
  expect(output.index.sections.some(value => value.name === 'custom/assets')).toBe(false);
  const declared = output.index.schemas.find(value => value.path === row.schema);
  if (declared === undefined) throw new Error('Fixed layout schema absent');
  const schema = new Uint8Array(await readFile(resolve(root, declared.path)));
  expect(schema.byteLength).toBe(declared.bytes);
  expect(hashImmutableBytes(schema)).toBe(declared.hash);
  const value = product.section('custom/fixedLayouts');
  validateDefinedSection(schema, value);
  const layouts = v.parse(SECTIONS['custom/fixedLayouts'], value), files = output.index.files.filter(file => file.name !== undefined), names = new Set(files.map(file => file.name));
  for (const name of [...layouts.draws.map(draw => 'file' in draw ? draw.file : draw.slot), BAKED_COVE.wear?.files.phone.file, BAKED_COVE.wear?.files.desktop.file]) {
    expect(names.has(name), name).toBe(true);
    if (name === undefined) throw new Error('Missing expected fixed-layout blob');
    expect((await product.file(name)).byteLength).toBeGreaterThan(0);
  }
  expect(new Set(files.map(file => file.hash)).size).toBe(files.length);
}, 30000);
