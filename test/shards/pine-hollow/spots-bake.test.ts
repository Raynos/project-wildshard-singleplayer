import { expect, it } from 'vitest';
import jobs from '../../../scripts/generation-jobs.json';
import spots from '../../../src/shards/pine-hollow/data/spots.generated.json';
import { pineSpots } from '../../../src/shards/pine-hollow/generators/spots';

it('is the fresh product of the authored Pine quest rows (G350-PH: generators/spots.ts, no page, GPU or runtime run)', () => {
  const job = jobs.jobs.find(row => row.id === 'pine-spots');
  expect(job).toMatchObject({ platform: 'portable', entry: 'src/shards/pine-hollow/generators/spots.ts' });
  expect(job).not.toHaveProperty('capture');
  expect(job).not.toHaveProperty('browser');
  expect(JSON.stringify(pineSpots())).toBe(JSON.stringify(spots));
  expect(spots.rows).toHaveLength(44);
  expect(spots.profile).toBe('authored rows');
  expect(spots.notice).toContain('DO NOT EDIT');
});
