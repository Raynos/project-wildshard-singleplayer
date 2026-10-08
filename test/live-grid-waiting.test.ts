// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the native renderer-refusing loader as production Node does.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the witness on this test runner's Node version.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('warms public templates inside the cold bound without admitting Developer-only neighbours', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/live-waiting.mjs'], { encoding: 'utf8', timeout: 20_000 });
  expect(JSON.parse(output)).toEqual({ warmed: ['template-3', 'template-4', 'template-5'], waitingWallsClosed: true, repeatedFetches: 0 });
});
