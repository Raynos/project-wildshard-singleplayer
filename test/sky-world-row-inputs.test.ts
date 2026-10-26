// oxlint-disable-next-line import/no-nodejs-modules -- Compare original admitted rows and isolate the real sealed drivers.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every sealed-driver temporary under the repository.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';
import { SKY_PIECES } from '../src/shards/far-reach/generators/scene';

const removed = SKY_PIECES.map(piece => `src/shards/far-reach/data/${piece.rows}.json`);

test('the owned world reader preserves every original baked paint, piece and collider row', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`);
  expect(bytes.byteLength).toBe(65_347);
  expect(hashImmutableBytes(bytes)).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});

test.each(['sky-world-rows', 'sky-static-scenes'])('the cold sealed %s reader retains complete original output without ten metadata inputs', async id => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained world reader ${id}`);
  for (const path of removed) expect(job.inputRoots, path).not.toContain(path);
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/worldPieceBytes.ts');
  const ground = 'src/shards/far-reach/generators/groundScene.ts';
  expect(job.inputRoots).toContain(ground);
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/groundScene.generated.json');
  const expected = id === 'sky-world-rows'
    ? { 'src/shards/far-reach/data/worldRows.generated.json': '3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d' }
    : { 'src/shards/far-reach/data/staticScenes.generated.json': '1be5a532bca78ccb782a80905105ca6d6fe243676539dc04d58e78f213ddef2a' };
  const cacheDir = mkdtempSync(resolve('tmp/sky-world-row-inputs-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== ground) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: discoverGeneration(root).jobs.map(row => row.id === id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual(expected); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
