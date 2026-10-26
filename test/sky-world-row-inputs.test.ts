// oxlint-disable-next-line import/no-nodejs-modules -- Compare original admitted rows and isolate the real sealed drivers.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every sealed-driver temporary under the repository.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original output without expanding a large assertion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';
import { SKY_PIECES } from '../src/shards/far-reach/generators/scene';

const removed = SKY_PIECES.map(piece => `src/shards/far-reach/data/${piece.rows}.json`);

test('the owned world reader preserves every original baked paint, piece and collider row', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`);
  expect(Buffer.compare(bytes, readFileSync('src/shards/far-reach/data/worldRows.generated.json'))).toBe(0);
});

test.each(['sky-world-rows', 'sky-static-scenes'])('the cold sealed %s reader retains complete original output without ten metadata inputs', async id => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained world reader ${id}`);
  for (const path of removed) expect(job.inputRoots, path).not.toContain(path);
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/worldPieceBytes.ts');
  const expected = Object.fromEntries(job.outputs.map(path => [path, hashImmutableBytes(readFileSync(path))]));
  const cacheDir = mkdtempSync(resolve('tmp/sky-world-row-inputs-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual(expected); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
