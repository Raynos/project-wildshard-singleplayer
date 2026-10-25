// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated native painter output fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the image proof under the repository's tmp directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { nineMapFiles } from '../src/shards/nine-dragon-stack/generators/mapAssembly.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import settings from '../src/shards/nine-dragon-stack/look/map.json' with { type: 'json' };
import before from './fixtures/nine-map-files.json' with { type: 'json' };

// Cold construction happens before the timed assertion, as in the cast/world
// program proofs; every scene and compressed geometry byte remains covered.
const files = await nineMapFiles();

test('source map assembly preserves every original scene and packed geometry byte', () => {
  const outputs = [files.get('map/assembly.json'), files.get('map/geometry.bin')];
  for (const [index, bytes] of outputs.entries()) {
    const original = before[index];
    if (original === undefined || bytes === undefined) throw new Error('Missing predecessor map oracle');
    expect(bytes.byteLength, original.path).toBe(original.bytes);
    expect(hashImmutableBytes(bytes), original.path).toBe(original.hash);
  }
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
