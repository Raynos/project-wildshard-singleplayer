// oxlint-disable-next-line import/no-nodejs-modules -- The acceptance witness runs real physics through the renderer-refusing Node loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the witness on the invoking Node version.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('durably retires cold regional worlds and their basis claims, preserving quota refusals and a U-turn continuation', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/live-rings.mjs'], { encoding: 'utf8', timeout: 20_000 });
  expect(JSON.parse(output)).toEqual({ durableColdUnload: true, quotaAttempts: 1, frozenTicks: 60, uTurnLoads: 3, hp: 55, doorOpen: true, basisReleased: true, preparedProtected: true, borrowedHomeRetained: true });
});
