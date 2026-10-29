import {test, expect} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The original trusted-input assertion must execute in a real, leased browser and isolated child.
import {execFileSync, spawnSync} from 'node:child_process';

// oxlint-disable-next-line import/no-nodejs-modules -- Own the bounded startup-refusal executable under repository scratch.
import {mkdtempSync, writeFileSync, rmSync, existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the isolated native startup fixture.
import {resolve} from 'node:path';

test('Escape sends only its own trusted down and up', () => {
  const args = ['--experimental-transform-types', 'test/fixtures/native-browser-escape.ts'];
  // The shared Mac takes its existing lease. Each isolated Linux CI runner
  // owns one inert native-input browser; no game or external page is loaded.
  const command = process.platform === 'darwin' ? 'scripts/browser-lane.sh' : process.execPath;
  const output = execFileSync(command, process.platform === 'darwin' ? ['--max', '2', process.execPath, ...args] : args,
    {encoding: 'utf8', timeout: 25_000});
  expect(output).toContain('original trusted Escape pair preserved');
});

test('native startup refusal retains its signal and bounded stderr, never claims trusted input, and cleans its profile', () => {
  const root = mkdtempSync(resolve('tmp/native-startup-refusal-'));
  try {
    const binary = resolve(root, 'native-refusal');
    const message = `${'x'.repeat(20_000)}\nOriginal native startup sentinel`;
    writeFileSync(binary, `#!/bin/sh\nprintf '%s\\n' '${message}' >&2\nkill -TERM $$\n`, {mode: 0o700});
    const child = spawnSync(process.execPath, ['--experimental-transform-types', 'test/fixtures/native-browser-escape.ts'],
      {encoding: 'utf8', timeout: 15_000, env: {...process.env, CHROME_PATH: binary}});
    expect(child.status).toBe(1);
    expect(child.stderr).toContain('code=null; signal=SIGTERM');
    expect(child.stderr).toContain('Original native startup sentinel');
    expect(child.stderr.length).toBeLessThan(20_000);
    expect(child.stdout).not.toContain('original trusted Escape pair preserved');
    const profile = /profile=("[^"\n]+")/.exec(child.stderr)?.[1];
    if (profile === undefined) throw new Error('Missing actual failed profile diagnostic');
    /** @type {unknown} */
    const path = JSON.parse(profile);
    if (typeof path !== 'string' || !path.startsWith(resolve('tmp/escape-control-'))) throw new Error('Foreign failed profile');
    expect(existsSync(path)).toBe(false);
  } finally {rmSync(root, {recursive: true, force: true});}
});
