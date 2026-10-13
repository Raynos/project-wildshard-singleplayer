// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the renderer-refusing native loader for the author baker.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the exact test runner Node executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('imports the SDK placeholder baker through a renderer-free Node closure', () => {
  const result = spawnSync(execPath, ['--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', "const { bakeFarPlaceholder } = await import('@wildshard/sdk/bake/placeholders'); if (typeof bakeFarPlaceholder !== 'function') throw new Error('Missing baker');"], { encoding: 'utf8' });
  expect(result.stderr).not.toContain('Renderer dependency');
  expect(result.status, result.stderr).toBe(0);
});
