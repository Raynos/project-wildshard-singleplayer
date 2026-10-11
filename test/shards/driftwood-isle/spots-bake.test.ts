// oxlint-disable-next-line import/no-nodejs-modules -- This contract executes the real Node producer, not a gameplay substitute.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The producer uses the same executable as the test process.
import process from 'node:process';
import { expect, it } from 'vitest';
import jobs from '../../../scripts/generation-jobs.json';
import spots from '../../../src/shards/driftwood-isle/runtime/spots.baked.json';

it('regenerates the real Driftwood quest roster byte-identically without a page or GPU', () => {
  const job = jobs.jobs.find(row => row.id === 'driftwood-spots');
  expect(job).toMatchObject({ platform: 'portable' });
  expect(job).not.toHaveProperty('capture');
  expect(job).not.toHaveProperty('browser');
  const result = spawnSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs',
    'src/shards/driftwood-isle/generators/bake-driftwood-spots.mjs', '--check'], { encoding: 'utf8', timeout: 20_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('30 native rows and 16 ordered prompts');
  expect(result.stdout).not.toContain('STALE');
  expect(spots.promptRegistrations).toHaveLength(16);
  expect(spots.promptRegistrations.filter(row => row.id === null)).toHaveLength(1);
  expect(spots.rows).toHaveLength(30);
  expect(spots.profile).toBe('Node / phone / no renderer');
  expect(spots.notice).toContain('DO NOT EDIT');
}, 60_000);
