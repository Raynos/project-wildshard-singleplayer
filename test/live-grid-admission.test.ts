// oxlint-disable-next-line import/no-nodejs-modules -- Exercise native world and product-lease cleanup through the renderer-refusing loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the witness on the invoking Node version.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('releases unpublished product leases on every live admission failure and transfers successful release to the region', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/live-admission.mjs'], { encoding: 'utf8', timeout: 20_000 });
  expect(JSON.parse(output)).toEqual({ scenarios: 10, cancelled: 9, successfulRegionOwnsRelease: true, leakedClaims: 0 });
});
