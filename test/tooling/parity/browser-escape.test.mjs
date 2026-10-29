import {test, expect} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The original trusted-input assertion must execute in a real, leased browser and isolated child.
import {execFileSync} from 'node:child_process';

test('Escape sends only its own trusted down and up', () => {
  const args = ['--experimental-transform-types', 'test/fixtures/native-browser-escape.ts'];
  // The shared Mac takes its existing lease. Each isolated Linux CI runner
  // owns one inert native-input browser; no game or external page is loaded.
  const command = process.platform === 'darwin' ? 'scripts/browser-lane.sh' : process.execPath;
  const output = execFileSync(command, process.platform === 'darwin' ? ['--max', '2', process.execPath, ...args] : args,
    {encoding: 'utf8', timeout: 25_000});
  expect(output).toContain('original trusted Escape pair preserved');
});
