// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated native painter output fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the image proof under the repository's tmp directory.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the retained native pack oracle while exercising the raw source operation.
import { deflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { nineMapAssemblyFrom } from '../src/shards/nine-dragon-stack/generators/mapAssemblySource';
import { nineCastFiles } from '../src/shards/nine-dragon-stack/generators/castsProgram';
import { admitNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/nativeSignAtlas';
import { admitNativeGlyphs } from '../src/shards/nine-dragon-stack/generators/nativeGlyphs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import settings from '../src/shards/nine-dragon-stack/data/map.json' with { type: 'json' };
import before from './fixtures/nine-map-files.json' with { type: 'json' };
import nativeInputs from '../src/shards/nine-dragon-stack/data/nativeSignAtlas.json' with { type: 'json' };
import glyphInputs from '../src/shards/nine-dragon-stack/data/nativeGlyphs.json' with { type: 'json' };

// Cold construction happens before the timed assertion, as in the cast/world
// program proofs; every scene and compressed geometry byte remains covered.
const read = (url: string): Uint8Array => new Uint8Array(readFileSync(resolve(`public${url}`)));
const casts = await nineCastFiles(read), raw = new Map([...casts].filter(([name]) => name.startsWith('raw/')).map(([name, bytes]) => [name.slice(4, -4), bytes]));
const native = admitNativeSignAtlas(new Map(nativeInputs.map(row => [row.name, read(row.input)])), nativeInputs);
const glyphs = admitNativeGlyphs(new Map(glyphInputs.map(row => [row.name, read(row.input)])), glyphInputs);
const source = await nineMapAssemblyFrom({ casts: raw, native, glyphs, read });
let files: ReadonlyMap<string, Uint8Array>;
try {
  const packed = source.assembly.pack();
  files = new Map([['map/assembly.json', packed.json], ['map/geometry.bin', new Uint8Array(deflateSync(packed.binary))]]);
} finally { for (const shape of source.assembly.shapes) { shape.geometry.dispose(); shape.material.dispose(); } }

test('source map assembly preserves every original scene and packed geometry byte', () => {
  const outputs = [files.get('map/assembly.json'), files.get('map/geometry.bin')];
  for (const [index, bytes] of outputs.entries()) {
    const original = before[index];
    if (original === undefined || bytes === undefined) throw new Error('Missing predecessor map oracle');
    expect(bytes.byteLength, original.path).toBe(original.bytes);
    expect(hashImmutableBytes(bytes), original.path).toBe(original.hash);
  }
});

test('the actual source assembly bundles without filesystem, publication or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/mapAssemblySource.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing Nine map source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

test('the complete source assembly paints the original native WebP bytes', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'nine-map-image-'));
  try {
    const dir = resolve(root, 'src/shards/nine-dragon-stack/look');
    mkdirSync(dir, { recursive: true });
    // All geometry/scene inputs are owned; this isolated root publishes only
    // the image/stamp and cannot read any retired source handoff.
    writeFileSync(resolve(dir, 'map.json'), JSON.stringify({ ...settings, inputs: [], painter: { version: 1, scenes: {
      packs: [{ file: 'map/geometry.bin', rows: { file: 'map/assembly.json', path: ['pack'] }, names: ['names'], deflated: true }],
      recipes: [{ file: 'map/assembly.json', path: ['scene'] }],
    } } }));
    await paintDataMap(root, 'nine-dragon-stack', { sources: files });
    const bytes = readFileSync(resolve(root, 'public/assets/nine-dragon-stack/map/top.webp'));
    const original = before[2];
    if (original === undefined) throw new Error('Missing original map image oracle');
    expect(bytes.byteLength).toBe(original.bytes);
    expect(hashImmutableBytes(bytes)).toBe(original.hash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
