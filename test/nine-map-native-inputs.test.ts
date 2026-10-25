// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated source cache and inspect retired handoff absence.
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind each actual native root explicitly.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { generatedProjectMap } from '../src/sdk/projectMap';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineMap } from '../src/shards/nine-dragon-stack/generators/mapProgram';

mkdirSync('tmp', { recursive: true });
const cache = mkdtempSync(resolve('tmp/nine-map-native-'));
afterAll(() => { rmSync(cache, { recursive: true, force: true }); });
const roots = ['lab', 'authored/sign-atlas', 'authored/glyphs'].map(name => ({
  prefix: `/assets/nine-dragon/${name}/`, directory: resolve(`public/assets/nine-dragon/${name}`),
}));
const context = (omitted?: string) => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), '6'.repeat(64), new Map(), cache,
  roots.filter(root => root.prefix !== omitted));
// Admit the cold source once before the timed cases; both omitted native-root
// negatives and the full original image oracle keep their 30-second deadlines.
const pixels = await nineMap(context());

test.each(['/assets/nine-dragon/authored/sign-atlas/', '/assets/nine-dragon/authored/glyphs/'])('the source map refuses omitted native root %s', async native => {
  await expect(nineMap(context(native))).rejects.toThrow('Generation input needs exactly one declared root');
});

test('the source map retains the original complete image bytes and owned output inventory', async () => {
  expect(pixels.byteLength).toBe(4_000_000);
  const result = await generatedProjectMap({ pixels }, 'f'.repeat(64));
  expect(result.map.bytes.byteLength).toBe(16556);
  expect(hashImmutableBytes(result.map.bytes)).toBe('cbc4ca4ed3a0f116cd9d80adf2786e999e5e98c97ae9eea6dd0995d0da4d4e40');
  const hit = context();
  const again = await nineMap({ cached: step => hit.cached(step, () => { throw new Error('A hit must not regenerate'); }) });
  expect(hashImmutableBytes(again)).toBe(hashImmutableBytes(pixels));
});

test('Nine has no scheduler jobs and all retired map and practice source handoffs stay absent', () => {
  expect(discoverGeneration(resolve('.')).jobs.filter(job => job.shard === 'nine-dragon-stack').map(job => job.id)).toEqual([]);
  for (const name of ['generators/bake-map.mjs', 'generators/mapAssembly.mjs', 'generators/mapAssembly.d.mts',
    'look/map.baked.json', 'look/map.json', 'data/mapPalette.json', 'generators/practiceDecision.mjs',
    'generators/practiceDecision.d.mts', 'behaviour/practice.generated.json', 'behaviour/practice.generated.wasm']) {
    expect(existsSync(resolve('src/shards/nine-dragon-stack', name)), name).toBe(false);
  }
});
