// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the admitted native template without browser globals.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute with the invoking Node's strict type stripping.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('persists quest rewards and a complete regional continuation by stable instance in plain Node', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/durability.mjs'], { encoding: 'utf8', timeout: 60_000 });
  const [durability, budgets] = output.trim().split('\n');
  if (durability === undefined || budgets === undefined) throw new Error('Missing native budget witness');
  expect(JSON.parse(durability)).toEqual({ nativeDurability: true, failedRetries: 10, coins: 5, questFacts: 1, achievementGrants: 1,
    restoredTicks: 120, independentCopies: true, refusesChangedRevision: true, refusesCorruptSnapshot: true, profileQuotaDeferred: true });
  expect(budgets).toContain('"productionBudgets"');
}, 60_000); // Two full eight-strip native worlds per save path, exact packed decoding and 120-tick logical continuation under a shared CPU gate.
