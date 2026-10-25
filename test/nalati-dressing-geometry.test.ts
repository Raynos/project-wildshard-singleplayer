// oxlint-disable-next-line import/no-nodejs-modules -- Verify the complete retained native wire files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The original wire uses Node zlib level 9.
import { deflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining geometry producer in isolation.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { bakeDressing } from '../src/shards/nalati-grasslands/generators/dressingGeometryRows';
import { encodeNalatiPart } from '../src/shards/nalati-grasslands/generators/placeWire';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import pins from './fixtures/nalati-place-wires.json' with { type: 'json' };

function wire() { return encodeNalatiPart(bakeDressing(), bytes => new Uint8Array(deflateSync(bytes, { level: 9 }))); }

test('geometry-only construction preserves every original dressing wire byte', () => {
  const files = wire();
  for (const [path, bytes] of [['public/assets/nalati/baked/dressing.bin', files.binary],
    ['src/shards/nalati-grasslands/data/dressingGeos.json', files.document]] as const) {
    const pin = pins.find(row => row.path === path);
    if (pin === undefined) throw new Error('Missing original dressing wire pin');
    expect({ path, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(pin);
    expect(Buffer.compare(bytes, readFileSync(path))).toBe(0);
  }
});

test('later geometry builds retain independent complete bytes', () => {
  const first = bakeDressing(), original = hashImmutableBytes(first.bin);
  first.bin.fill(0);
  const second = bakeDressing();
  expect(hashImmutableBytes(second.bin)).toBe(original);
  expect(second.rows).toEqual(first.rows);
});

test('native geometry construction has no scene material or runtime dependency', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingGeometryRows.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing native geometry bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect([...chunk.imports, ...chunk.dynamicImports]).toEqual([]);
    expect(chunk.code).not.toContain('PainterlyMaterial');
  }
});
