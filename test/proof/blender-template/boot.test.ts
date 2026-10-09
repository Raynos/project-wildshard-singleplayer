// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual native author boot without Vitest's simulated browser.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use this runner's native executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('boots the actual authored product with the guardian and a door that stops, opens and re-closes native collision', () => {
  const output = execFileSync(execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', 'test/proof/blender-template/boot.mjs'], { encoding: 'utf8', timeout: 45_000 });
  expect(JSON.parse(output)).toMatchObject({ native: true, meshCollision: true, creature: 'guardian.1', opened: true, reclosed: true });
});
