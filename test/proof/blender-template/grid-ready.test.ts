// oxlint-disable-next-line import/no-nodejs-modules -- Execute the real grid admission in a fresh Node process without the test DOM.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use this test runner's native executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('admits the actual Blender project with a runtime fence, one sim lease, save refusal and durable grid continuation', () => {
  const output = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/proof/blender-template/grid-ready.mjs'], { encoding: 'utf8', timeout: 60_000 });
  expect(JSON.parse(output)).toMatchObject({ native: true, gridReady: true, reserveBeforePhysics: true, runtimeFence: true, refusedSave: true, restoredDoor: true, frozenTicks: 5, loads: 2 });
});
