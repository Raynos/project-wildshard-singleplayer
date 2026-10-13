import { expect, it } from 'vitest';
import jobs from '../../../scripts/generation-jobs.json';
import spots from '../../../src/shards/driftwood-isle/data/spots.generated.json';
import { driftwoodSpots } from '../../../src/shards/driftwood-isle/generators/spots';

it('is the fresh product of the authored quest rows (G350-DW: generators/spots.ts, no page, GPU or runtime)', () => {
  const job = jobs.jobs.find(row => row.id === 'driftwood-spots');
  expect(job).toMatchObject({ platform: 'portable', entry: 'src/shards/driftwood-isle/generators/spots.ts' });
  expect(job).not.toHaveProperty('capture');
  expect(job).not.toHaveProperty('browser');
  expect(JSON.stringify(driftwoodSpots())).toBe(JSON.stringify(spots));
  expect(spots.promptRegistrations).toHaveLength(16);
  expect(spots.promptRegistrations.filter(row => row.id === null)).toHaveLength(1);
  expect(spots.rows).toHaveLength(30);
  expect(spots.profile).toBe('authored rows');
  expect(spots.notice).toContain('DO NOT EDIT');
});
