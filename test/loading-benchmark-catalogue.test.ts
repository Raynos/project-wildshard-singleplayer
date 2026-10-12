// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual CLI refuses a cohort before network/browser acquisition.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the benchmark with the same verified Node runtime as this fixture.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { loadingCardIndex, loadingShards, loadingShardNeedsDeveloper } from '../scripts/loading-benchmark/catalogue.mjs';

it('admits all seven requested loading rows including display names that differ from their slugs', () => {
  const shards = loadingShards('driftwood-isle,nalati-grasslands,pine-hollow,_template,far-reach,sunscar-dunes,nine-dragon-stack');
  const titles = ['Driftwood Isle', 'Nalati', 'Pine Hollow', 'Template shard', 'Sky Reach', 'Signal Dunes', 'Nine Dragon Stack'];
  expect(shards.map(shard => loadingCardIndex(titles, shard))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(shards.map(loadingShardNeedsDeveloper)).toEqual([false, false, false, true, true, true, true]);
});

it('refuses invalid or duplicate cohorts and missing or ambiguous cards instead of dropping a row', () => {
  for (const cohort of ['', 'unknown', 'pine-hollow,', 'pine-hollow,pine-hollow']) expect(() => loadingShards(cohort)).toThrow();
  expect(() => loadingCardIndex(['Driftwood Isle'], 'far-reach')).toThrow('absent or ambiguous');
  expect(() => loadingCardIndex(['Sky Reach', 'Sky Reach draft'], 'far-reach')).toThrow('absent or ambiguous');
  expect(loadingCardIndex(['Signal Dunes', 'Pine Hollow'], 'pine-hollow')).toBe(1);
});

it.each([
  { cohort: 'unknown', reason: 'Unknown benchmark shard' },
  { cohort: 'pine-hollow,pine-hollow', reason: 'Duplicate benchmark shard' },
])('rejects $cohort in the actual CLI before fetching a preview or opening a browser', ({ cohort, reason }) => {
  expect(() => execFileSync(execPath, ['scripts/loading-benchmark/capture.mjs',
    `--pin=${'a'.repeat(40)}`, '--base=http://127.0.0.1:1', `--shards=${cohort}`],
  { timeout: 10000, stdio: 'pipe' })).toThrow(reason);
});
