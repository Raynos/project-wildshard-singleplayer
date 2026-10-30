// oxlint-disable-next-line import/no-nodejs-modules -- Keep the earned setup in the same strict native host as its consumers.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use only the fixed repository native fixture and loader.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the original loader's absolute URL intake.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

const child = spawnSync(process.execPath, ['--experimental-transform-types', '--import',
  pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
  resolve('test/fixtures/headless/nalati-mounted-raid-snapshot.ts')], { encoding: 'utf8', timeout: 175_000 });
console.info(child.stdout);
test('nalati-mounted-raid snapshot', () => {
  expect(child.status, child.stdout + child.stderr + String(child.error ?? '') + (child.signal ?? '')).toBe(0);
  expect(child.stdout).toContain('"fixture":"nalati-mounted-raid"');
});
