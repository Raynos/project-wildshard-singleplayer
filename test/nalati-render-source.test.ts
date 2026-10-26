// oxlint-disable-next-line import/no-nodejs-modules -- The committed terrain input feeds the exact offline source constructor.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { nalatiRenderTileSources } from '../src/shards/nalati-grasslands/generators/renderTileSources';
import { hashImmutableBytes } from '../src/sdk/immutable';
import originals from './fixtures/nalati-render-source-files.json' with { type: 'json' };

const native = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
const originalNative = hashImmutableBytes(native);
// One genuine construction supplies all original files; timed assertions preserve complete pins.
const made = await nalatiRenderTileSources(native);

test('the explicit terrain source reproduces all 73 complete original publications', () => {
  expect(originals).toHaveLength(73);
  expect([...made.files.keys()].sort((a, b) => a.localeCompare(b)))
    .toEqual(originals.map(row => row.path).sort((a, b) => a.localeCompare(b)));
  expect(made.tiles).toBe(64);
  expect(made.nativeGround).toBe(originalNative);
  expect(made.bytes).toBe(originals.reduce((sum, row) => sum + row.bytes, 0));
  for (const pin of originals) {
    const bytes = made.files.get(pin.path);
    if (bytes === undefined) throw new Error(`Missing original render source ${pin.path}`);
    expect(bytes.byteLength, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
  expect(hashImmutableBytes(native)).toBe(originalNative);
});

test('independent construction owns its bytes after an earlier result is mutated', async () => {
  const metadata = made.files.get('data/renderTiles.json');
  if (metadata === undefined) throw new Error('Missing render metadata loan');
  const before = metadata.slice(); metadata.fill(0);
  try {
    const rebuilt = await nalatiRenderTileSources(native);
    expect(rebuilt.files).not.toBe(made.files);
    for (const pin of originals) {
      const bytes = rebuilt.files.get(pin.path);
      if (bytes === undefined) throw new Error('Missing rebuilt render source');
      expect(bytes).not.toBe(made.files.get(pin.path));
      expect(bytes.byteLength, pin.path).toBe(pin.bytes);
      expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
    }
    expect(hashImmutableBytes(native)).toBe(originalNative);
  } finally { metadata.set(before); }
});

test('missing and malformed native terrain refuse before publication', async () => {
  await expect(nalatiRenderTileSources(new Uint8Array())).rejects.toThrow();
  const corrupted = native.slice(); corrupted[0] = (corrupted[0] ?? 0) ^ 1;
  await expect(nalatiRenderTileSources(corrupted)).rejects.toThrow();
  expect(hashImmutableBytes(native)).toBe(originalNative);
});
