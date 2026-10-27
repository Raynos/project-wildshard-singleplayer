// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the checkout the committed tables live in.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { genSource } from '../scripts/gen-source.mjs';
import { SOURCE_GENERATORS, selectSourceGenerators } from '../scripts/source-generators.mjs';

test('a staged path selects only the gen:source rows it feeds', () => {
  const ids = (path: string): string[] => selectSourceGenerators([path]).map(row => row.id);
  expect(ids('src/game/weapons/starterBow.json')).toEqual(['starter-weapons']);
  expect(ids('src/shards/pine-hollow/manifest.json')).toEqual(['shard-slugs', 'shards', 'boot-tables']);
  expect(ids('public/assets/music/calm/music.json')).toEqual(['boot-audio', 'boot-tables', 'packs']);
  expect(ids('src/engine/core/Game.ts')).toEqual([]);
  expect(ids('src/game/bag/starter.generated.ts')).toEqual(['starter-bag']);
  expect(ids('src/shards/pine-hollow/generators/sections.ts')).toEqual(['pine-hollow-section-schemas']);
});

test('every registry output is listed once and committed rows own tracked inputs only', () => {
  const outputs = SOURCE_GENERATORS.flatMap(row => row.outputs);
  expect(new Set(outputs).size).toBe(outputs.length);
  expect(outputs).toHaveLength(17);
  for (const row of SOURCE_GENERATORS.filter(entry => entry.committed)) expect(row.inputs.some(glob => glob === 'public/assets/**'), row.id).toBe(false);
});

test('--stage regenerates only the committed tables a commit feeds, and they are current', async () => {
  const root = resolve(import.meta.dirname, '..');
  await expect(genSource(root, { check: true, committed: true, changed: ['src/game/weapons/starterBow.json', 'src/shards/pine-hollow/manifest.json'] }))
    .resolves.toEqual({ touched: [], owned: ['src/game/weapons/starter.generated.ts', 'src/game/shard/slugs.generated.ts', 'src/game/shard/slugs.generated.json'] });
});
