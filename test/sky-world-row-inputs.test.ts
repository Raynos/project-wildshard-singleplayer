// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the source catalogue without a generated handoff.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';
import { SKY_PIECES } from '../src/shards/far-reach/generators/scene';

const removed = SKY_PIECES.map(piece => `src/shards/far-reach/data/${piece.rows}.json`);

test('the owned world reader preserves every original baked paint, piece and collider row', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`);
  expect(bytes.byteLength).toBe(65_347);
  expect(hashImmutableBytes(bytes)).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});

test('world publication is retired and its retained map reader declares source-owned rows', () => {
  const { jobs } = discoverGeneration(resolve('.')), job = jobs.find(row => row.id === 'sky-data-map');
  expect(jobs.some(row => row.id === 'sky-world-rows')).toBe(false);
  if (job === undefined) throw new Error('Missing retained map reader');
  for (const path of removed) expect(job.inputRoots, path).not.toContain(path);
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/worldPieceBytes.ts');
  const ground = 'src/shards/far-reach/generators/groundScene.ts';
  expect(job.inputRoots).toContain(ground);
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/groundScene.generated.json');
  const rows = skyWorldRows(), first = Object.values(rows.bakes)[0];
  if (first === undefined) throw new Error('Missing original baked rows');
  Reflect.set(first.kinds, 'length', 0); Reflect.set(rows.pieces, 'length', 0);
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`))).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});
