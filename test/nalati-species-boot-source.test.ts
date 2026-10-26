// oxlint-disable-next-line import/no-nodejs-modules -- Check original boot files through an isolated sealed producer.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the producer cache to this test's scratch directory.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { SPECIES_POSES } from '../src/shards/nalati-grasslands/generators/speciesPoses';
import { parseClientChannels } from '../src/format/clientChannels';
import pins from './fixtures/nalati-species-boot-files.json' with { type: 'json' };

test('the sealed boot producer preserves every original file without a species JSON input', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-boot-metadata');
  if (job === undefined) throw new Error('Missing Nalati boot producer');
  expect(job.inputRoots).not.toContain('src/shards/nalati-grasslands/data/species.generated.json');
  const cacheDir = mkdtempSync(resolve('tmp/nalati-species-boot-'));
  try {
    const made = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(Object.keys(made.hashes).sort()).toEqual(pins.map(pin => pin.path).sort());
      for (const pin of pins) {
        expect(made.hashes[pin.path], pin.path).toBe(pin.sha256);
        expect(readFileSync(resolve(made.directory, pin.path)).length, pin.path).toBe(pin.bytes);
      }
    } finally { made.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('authored pose rows retain the entire original serialized graph and parsed header channels', () => {
  const before = v.parse(v.object({ poses: v.record(v.string(), v.object({ programs: v.unknown() })) }),
    JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
  const original = v.parse(v.object({ poses: v.unknown() }), JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
  expect(JSON.stringify(SPECIES_POSES)).toBe(JSON.stringify(original.poses));
  expect(Object.values(SPECIES_POSES).flatMap(pose => parseClientChannels(pose.programs)))
    .toEqual(Object.values(before.poses).flatMap(pose => parseClientChannels(pose.programs)));
});
