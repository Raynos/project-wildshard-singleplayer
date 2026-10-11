// oxlint-disable-next-line import/no-nodejs-modules -- The parity fixture and temporary generation cache are Node proof inputs.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The source hash fences the frozen pre-port layout implementation.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- An isolated cache proves the real cold path.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary path composition belongs to the Node proof.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The cache producer runs from the isolated proof root.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { Entry } from '../../../src/sdk/entries';
import { RISING_ISLETS as ORIGINAL, ISLET as ORIGINAL_DESIGN, isleStrips, entryFrame as originalFrame } from '../../fixtures/sky-islet-layout';
import { RISING_ISLETS, entryFrame } from '../../../src/shards/far-reach/world/islets';
import { ISLET } from '../../../src/shards/far-reach/data/isletDesign';
import { ISLET_LIFTS } from '../../../src/shards/far-reach/data/isletLift';
import { risingIsletRows } from '../../../src/shards/far-reach/generators/risingIslets';
import { discoverGeneration, generateShardJob } from '../../../scripts/generate.mjs';

it('retains every native coordinate, float sign, floor strip and admitted entry route from the frozen layout', () => {
  expect(createHash('sha256').update(readFileSync('test/fixtures/sky-islet-layout.ts')).digest('hex')).toBe('92211ada5e2cf2ee9788fa4279c706bee3720f67ca36837efa1fb16b5c919425');
  expect(ISLET).toStrictEqual(ORIGINAL_DESIGN);
  const generated = risingIsletRows();
  expect(generated.entries).toStrictEqual(ORIGINAL.map(({ at: _at, ...entry }) => ({ ...entry, strips: isleStrips(entry.gate) })));
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Persisted JSON, including signed zeros, is the exact generated product under test.
  expect(JSON.parse(JSON.stringify(generated))).toStrictEqual(generated);
  expect(ISLET_LIFTS).toStrictEqual(generated.lifts);
  for (const [index, original] of ORIGINAL.entries()) {
    const current = RISING_ISLETS[index];
    if (current === undefined) throw new Error('Missing native entry');
    expect(new Entry(original.edge).toEntryData().width).toBe(8);
    const { at: _currentAt, ...currentRow } = current, { at: _originalAt, ...originalRow } = original;
    expect(currentRow).toStrictEqual(originalRow);
    for (const t of [-4, 0, 4]) for (const u of [0, 15, 16.5, 52]) for (const y of [0, 25]) {
      expect(entryFrame(original.edge)(t, u, y)).toStrictEqual(originalFrame(original.edge)(t, u, y));
      expect(current.at(t, u, y)).toStrictEqual(original.at(t, u, y));
    }
  }
});

it('generates on an empty cache and verifies warm and forced bytes with the retained SDK producer', async () => {
  const root = cwd(), cacheDir = mkdtempSync(join(tmpdir(), 'sky-islet-cache-'));
  try {
    const job = discoverGeneration(root).jobs.find(row => row.id === 'sky-rising-islets');
    if (job === undefined) throw new Error('Missing retained Rising Islet job');
    const cold = await generateShardJob(root, job, { cacheDir });
    const warm = await generateShardJob(root, job, { cacheDir });
    const compare = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    expect(cold.hit).toBe(false); expect(warm.hit).toBe(true);
    expect(cold.hashes).toStrictEqual(warm.hashes); expect(cold.hashes).toStrictEqual(compare.hashes);
    expect(readFileSync(join(cold.directory, job.outputs[0] ?? ''), 'utf8')).toBe(`${JSON.stringify(risingIsletRows())}\n`);
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
