// oxlint-disable-next-line import/no-nodejs-modules -- Run the trusted resident in a fresh plain Node process outside the test DOM.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use this test runner's native executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('composes the trusted resident exactly as the worker adapter, restores object continuations strictly and admits as a grid region', () => {
  const result: unknown = JSON.parse(execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/headless/resident-run.mjs'], { encoding: 'utf8', timeout: 60_000 }));
  expect(result).toEqual({ adapterExact: true, rewards: 1, lent: true, objectRestore: true, refused: true, gridRegion: true, loads: 2 });
}, 60_000);
