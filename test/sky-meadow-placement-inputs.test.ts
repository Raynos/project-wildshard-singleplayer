// oxlint-disable-next-line import/no-nodejs-modules -- Read the fixed original placement and clearance declarations.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the defining source bundle and deliberate omission controls.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { discoverGeneration } from '../scripts/generate.mjs';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakeMeadowBlades } from '../src/shards/far-reach/generators/meadowBlades';
import { meadowHoles, meadowPaths } from '../src/shards/far-reach/generators/placements';
import { heroStoneDiscs } from '../src/shards/far-reach/generators/dressing';

const output = 'public/assets/far-reach/baked/851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f.bin';

test('owned meadow placement values preserve every original row and packed blade byte', () => {
  const original = v.parse(v.object({ meadow: v.object({ holes: v.array(v.array(v.number())), paths: v.array(v.array(v.number())) }) }),
    JSON.parse(readFileSync('src/shards/far-reach/data/placements.json', 'utf8')));
  const rows = (values: ReturnType<typeof meadowHoles>): number[][] => values.map(({ x, y, z, w }) => [x, y, z, w]);
  expect(rows(meadowHoles())).toEqual(original.meadow.holes);
  expect(rows(meadowPaths())).toEqual(original.meadow.paths);
  const bytes = bakeMeadowBlades();
  expect(bytes.byteLength).toBe(1_431_607);
  expect(hashImmutableBytes(bytes)).toBe('851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f');
});

test('authored dressing clearances retain every original disc and own their coordinate arrays', () => {
  const original = v.parse(v.object({ discs: v.array(v.tuple([v.number(), v.number(), v.number()])) }),
    JSON.parse(readFileSync('src/shards/far-reach/data/dressing.json', 'utf8')));
  const first = heroStoneDiscs(), second = heroStoneDiscs(), disc = first[0];
  expect(first).toEqual(original.discs);
  if (disc === undefined) throw new Error('Missing original dressing clearance');
  disc[0] += 1; first.length = 0;
  expect(second).toEqual(original.discs); expect(heroStoneDiscs()).toEqual(original.discs);
});

const bundle = (omitted?: string) => build({ configFile: false, logLevel: 'silent',
  plugins: omitted === undefined ? [] : [{ name: 'omit-defining-meadow-source', load(id) {
    if (id === resolve(omitted)) throw new Error(`Omitted meadow source ${omitted}`);
    return null;
  } }],
  build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/meadowScene.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });

test('owned meadow channels bundle without generated imports or file/compiler services', async () => {
  const result = await bundle(), bundled = Array.isArray(result) ? result[0] : result;
  if (bundled === undefined || !('output' in bundled)) throw new Error('Missing owned meadow bundle');
  const chunks = bundled.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test.each(['placements.ts', 'dressing.ts'])('owned meadow compilation refuses missing defining %s', async source => {
  await expect(bundle(`src/shards/far-reach/generators/${source}`)).rejects.toThrow('Omitted meadow source');
});

test('the meadow scheduler writer and every declared blade handoff reader are retired', () => {
  for (const job of discoverGeneration(resolve('.')).jobs) {
    expect(job.id).not.toBe('sky-meadow-blades');
    expect(job.outputs, job.id).not.toContain(output);
    expect(job.inputRoots, job.id).not.toContain(output);
  }
});
