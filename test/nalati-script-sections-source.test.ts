import { expect, test } from 'vitest';
import * as v from 'valibot';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { NALATI_SCRIPT_SECTIONS, nalatiScriptSections } from '../src/shards/nalati-grasslands/generators/scriptInventory';
import { originalSpeciesJson } from './fixtures/nalati-original-species';
import pin from './fixtures/nalati-script-sections-original.json' with { type: 'json' };

const original = v.parse(v.object({ program: v.object({ v2: v.object({ artifact: v.object({
  hash: v.string(), pages: v.number(), ioBytes: v.number(),
}) }) }) }), originalSpeciesJson('species.json')).program.v2;
const selected = v.looseObject({ id: v.literal('nalati.held-weapons.projection'), module: v.string(), pages: v.number(), ioBytes: v.number() });
function fullPin(sections: ReadonlyMap<string, unknown>): void {
  const bytes = new TextEncoder().encode(JSON.stringify([...sections]));
  expect(bytes.length).toBe(pin.bytes);
  expect(hashImmutableBytes(bytes)).toBe(pin.sha256);
}

test('explicit held projection preserves the complete original admission inventory', () => {
  fullPin(NALATI_SCRIPT_SECTIONS);
  fullPin(nalatiScriptSections(original));
});

test('only the selected held executable consumes supplied artifact fields', () => {
  const artifact = { hash: '1'.repeat(64), pages: original.artifact.pages + 1, ioBytes: original.artifact.ioBytes + 64 };
  const sections = nalatiScriptSections({ artifact });
  const rows = v.parse(v.array(v.unknown()), sections.get('actors/return-scripts'));
  let changed = 0;
  for (const row of rows) {
    if (!v.is(selected, row)) continue;
    expect(row.module).toBe(`blobs/wasm/${artifact.hash}.wasm`);
    expect(row.pages).toBe(artifact.pages);
    expect(row.ioBytes).toBe(artifact.ioBytes);
    row.module = `blobs/wasm/${original.artifact.hash}.wasm`;
    row.pages = original.artifact.pages;
    row.ioBytes = original.artifact.ioBytes;
    changed++;
  }
  expect(changed).toBe(1);
  // v.unknown preserves the owned row identities, so reversing only these fields
  // must restore the complete original document, including all other executables.
  fullPin(sections);
});

test('owned result mutations cannot change another construction or retained default', () => {
  const sections = nalatiScriptSections(original);
  const rows = v.parse(v.array(v.unknown()), sections.get('actors/return-scripts'));
  for (const row of rows) if (v.is(selected, row)) row.module = 'changed';
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify([...sections])))).not.toBe(pin.sha256);
  fullPin(NALATI_SCRIPT_SECTIONS);
  fullPin(nalatiScriptSections(original));
});
