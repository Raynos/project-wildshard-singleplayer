// oxlint-disable-next-line import/no-nodejs-modules -- Verify the complete retained native wire files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The original wire uses Node zlib level 9.
import { deflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining geometry producer in isolation.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { COVER_INPUTS, coverBinName, nalatiCoverBake } from '../src/shards/nalati-grasslands/generators/coverBake.mjs';
import { nalatiPredecessorCoverRows } from './fixtures/nalati-cover';
import { build } from 'vite';
import { bakeDressing } from '../src/shards/nalati-grasslands/generators/dressingGeometryRows';
import { encodeNalatiPart } from '../src/shards/nalati-grasslands/generators/placeWire';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import pins from './fixtures/nalati-place-wires.json' with { type: 'json' };
import coverPins from './fixtures/nalati-cover-files.json' with { type: 'json' };

function wire() { return encodeNalatiPart(bakeDressing(), bytes => new Uint8Array(deflateSync(bytes, { level: 9 }))); }

test('geometry-only construction preserves every original dressing wire byte', () => {
  const files = wire();
  for (const [path, bytes] of [['test/fixtures/nalati-dressing.bin', files.binary],
    ['test/fixtures/nalati-dressing-geos.json', files.document]] as const) {
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


// GR6: the build constructs the cover; its shape banks ship as the retired job wrote them (lane-shuffled level-9 deflate),
// and with the rows in its URL shape its outputs keep every original byte, and an atlas that differs from its painted model refuses.
const coverInputs = new Map(COVER_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
const coverRead = (inputs: ReadonlyMap<string, Uint8Array>) => (url: string): Uint8Array => { const bytes = inputs.get(url); if (bytes === undefined) throw new Error(`Missing cover input ${url}`); return bytes; };
test('the build-time cover keeps every original cover file byte', async () => {
  const made = await nalatiCoverBake(coverRead(coverInputs)), files = new Map<string, Uint8Array>();
  for (const tier of ['phone', 'desktop'] as const) {
    const bank = made.bins.get(coverBinName(tier));
    if (bank === undefined) throw new Error(`Missing ${tier} cover shapes`);
    files.set(`public/assets/nalati/baked/cover-${tier}.bin`, bank);
  }
  // the rows as the retired job wrote them (its URL shape banks and its own script as each model's file)
  const json = new TextEncoder().encode(`${JSON.stringify(nalatiPredecessorCoverRows, null, 2)}\n`);
  files.set('src/shards/nalati-grasslands/boot/cover.generated.json', json); files.set('src/shards/nalati-grasslands/data/cover.generated.json', json);
  for (const name of ['boulder-1', 'boulder-2', 'boulder-3']) { const url = `/assets/nalati/baked/cover-${name}.webp`; files.set(`public${url}`, coverRead(coverInputs)(url)); }
  expect([...files.keys()].sort()).toEqual(Object.keys(coverPins).sort());
  for (const [file, pin] of Object.entries(coverPins)) {
    const bytes = files.get(file);
    if (bytes === undefined) throw new Error(`Missing cover file ${file}`);
    expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }, file).toEqual(pin);
  }
});
test('a committed cover atlas that differs from its painted model refuses', async () => {
  const url = '/assets/nalati/baked/cover-boulder-2.webp', bytes = coverRead(coverInputs)(url).slice();
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
  await expect(nalatiCoverBake(coverRead(new Map([...coverInputs, [url, bytes]])))).rejects.toThrow('Committed cover atlas differs');
});
