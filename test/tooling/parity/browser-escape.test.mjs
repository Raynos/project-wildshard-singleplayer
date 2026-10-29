import {test, expect} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The original trusted-input assertion must execute in a real, leased browser and isolated child.
import {execFileSync, spawnSync} from 'node:child_process';

// oxlint-disable-next-line import/no-nodejs-modules -- Own the bounded startup-refusal executable under repository scratch.
import {mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync, realpathSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the isolated native startup fixture.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native Unix socket path limit, without mocking Chrome.
import {createServer} from 'node:net';
// oxlint-disable-next-line import/no-nodejs-modules -- Await the native listening and close events without wall-clock assumptions.
import {once} from 'node:events';
import {nativeSocketTemporary} from '../../fixtures/native-socket-temp.mjs';

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
    const socketTemp = /socketTemp=("[^"\n]+")/.exec(child.stderr)?.[1];
    if (socketTemp === undefined) throw new Error('Missing owned socket alias diagnostic');
    /** @type {unknown} */
    const alias = JSON.parse(socketTemp);
    if (typeof alias !== 'string' || !alias.startsWith('/tmp/wsesc-') || !alias.endsWith('/t')) throw new Error('Foreign socket alias');
    expect(existsSync(resolve(alias, '..'))).toBe(false);
  } finally {rmSync(root, {recursive: true, force: true});}
});


test('long native Unix socket paths refuse while the short alias binds to profile-owned data', async () => {
  const root = mkdtempSync(resolve('tmp/native-socket-control-'));
  let temporary;
  /** @param {string} path */
  const bind = async path => {
    const server = createServer();
    try {server.listen(path); await once(server, 'listening');}
    finally {if (server.listening) {const closed = once(server, 'close'); server.close(); await closed;}}
  };
  try {
    const inherited = resolve(root, 'long-inherited-tmpdir-'.repeat(5), 'com.google.Chrome.ABCDEF');
    mkdirSync(inherited, {recursive: true});
    await expect(bind(resolve(inherited, 'SingletonSocket'))).rejects.toThrow(/EINVAL|ENAMETOOLONG/u);
    temporary = await nativeSocketTemporary(root);
    const alias = resolve(temporary.path, 'com.google.Chrome.ABCDEF');
    mkdirSync(alias);
    expect(realpathSync(alias)).toBe(resolve(root, 'native-tmp/com.google.Chrome.ABCDEF'));
    const socket = resolve(alias, 'SingletonSocket');
    expect(Buffer.byteLength(socket)).toBeLessThan(80);
    await bind(socket);
    await temporary.dispose();
    expect(existsSync(resolve(temporary.path, '..'))).toBe(false);
  } finally {await temporary?.dispose(); rmSync(root, {recursive: true, force: true});}
});
