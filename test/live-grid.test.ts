// oxlint-disable-next-line import/no-nodejs-modules -- Run the renderer-refusing native loader, independent of Vitest transforms.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the acceptance witness on the invoking Node version.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('drives the admitted template through live page frames and restores its frozen continuation in plain Node', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/live.mjs'], { encoding: 'utf8', timeout: 20_000 });
  expect(JSON.parse(output)).toEqual({ nativeLiveGrid: true, quotaDeferred: true, crossings: 4, existingPhysicsSteps: 670, gameplayHeldTicks: 60, frozenTicks: 600, openedDoor: true, hurtCreature: 55, restored: true, borrowedHomeRetained: true });
});
