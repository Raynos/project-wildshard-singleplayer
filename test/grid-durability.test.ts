// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the admitted native template without browser globals.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute with the invoking Node's strict type stripping.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('persists quest rewards and a complete regional continuation by stable instance in plain Node', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/durability.mjs'], { encoding: 'utf8', timeout: 20_000 });
  expect(JSON.parse(output)).toEqual({ nativeDurability: true, failedRetries: 10, coins: 5, questFacts: 1, achievementGrants: 1,
    restoredTicks: 120, independentCopies: true, refusesChangedRevision: true, refusesCorruptSnapshot: true, profileQuotaDeferred: true });
});
