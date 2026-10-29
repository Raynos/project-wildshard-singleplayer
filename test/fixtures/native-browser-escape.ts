// oxlint-disable-next-line import/no-nodejs-modules -- Launch and reap the owned native browser for the original trusted-input control.
import {spawn} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the original complete strict event assertion.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Find an installed browser without installing a dependency in CI.
import {existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove this fixture's exact browser profile.
import {mkdtemp, rm} from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the browser profile under the repository scratch root.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {pressEscape} from '../../scripts/parity/browser-escape.mjs';

const executable = [process.env['CHROME_PATH'], chromium.executablePath(), '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find((file): file is string => file !== undefined && existsSync(file));
if (executable === undefined) throw new Error('No installed Chromium for the original trusted-input control');
const directory = await mkdtemp(resolve('tmp/escape-control-'));
const child = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${directory}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  ...(process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--no-sandbox']), 'data:text/html,bootstrap'],
{stdio: ['ignore', 'ignore', 'pipe']});
let socket: WebSocket | undefined;
let closing: Promise<void> | undefined;
const close = (): Promise<void> => (closing ??= (async () => {
  try {socket?.close();}
  finally {
    if (child.exitCode === null && child.signalCode === null) await new Promise<void>((done, refuse) => {
      const timer = setTimeout(() => {child.kill('SIGKILL'); refuse(new Error('Owned Escape browser did not exit'));}, 5000);
      child.once('exit', () => {clearTimeout(timer); done();}); child.kill();
    });
    await rm(directory, {recursive: true, force: true});
  }
})());
const terminate = (): void => {void close().catch(error => {console.error(error);}).finally(() => {process.exitCode = 143;});};
process.once('SIGTERM', terminate);
try {
  const endpoint = await new Promise<string>((done, refuse) => {
    let output = '';
    const timer = setTimeout(() => {refuse(new Error('Native Escape browser endpoint deadline'));}, 10_000);
    child.once('error', error => {clearTimeout(timer); refuse(error);});
    child.once('exit', code => {clearTimeout(timer); refuse(new Error(`Native Escape browser exited ${code}`));});
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
        const address = /DevTools listening on (ws:\/\/[^\s]+)/u.exec(output)?.[1];
      if (address !== undefined) {clearTimeout(timer); done(address);}
    });
  });
  const ws = new WebSocket(endpoint); socket = ws;
  await new Promise<void>((done, refuse) => {
    const timer = setTimeout(() => {refuse(new Error('Native Escape socket deadline'));}, 5000);
    ws.addEventListener('open', () => {clearTimeout(timer); done();}, {once: true});
    ws.addEventListener('error', () => {clearTimeout(timer); refuse(new Error('Native Escape socket refused'));}, {once: true});
  });
  let serial = 0;
  const pending = new Map<number, {done: (result: unknown) => void; refuse: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  ws.addEventListener('message', event => {
    const value: unknown = JSON.parse(String(event.data));
    if (typeof value !== 'object' || value === null) return;
    const id: unknown = Reflect.get(value, 'id');
    if (typeof id !== 'number') return;
    const item = pending.get(id); if (item === undefined) return;
    pending.delete(id); clearTimeout(item.timer);
    const error: unknown = Reflect.get(value, 'error');
    if (error !== undefined) item.refuse(new Error(JSON.stringify(error)));
    else item.done(Reflect.get(value, 'result'));
  });
  const send = (method: string, params: object, sessionId?: string): Promise<unknown> => new Promise((done, refuse) => {
    const id = ++serial, timer = setTimeout(() => {pending.delete(id); refuse(new Error(`Native Escape command deadline: ${method}`));}, 5000);
    pending.set(id, {done, refuse, timer}); ws.send(JSON.stringify({id, method, params, sessionId}));
  });
  const field = (value: unknown, name: string): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
  const target = await send('Target.createTarget', {url: 'about:blank'}), targetId = field(target, 'targetId');
  if (typeof targetId !== 'string') throw new Error('Native Escape target missing');
  const attached = await send('Target.attachToTarget', {targetId, flatten: true}), sessionId = field(attached, 'sessionId');
  if (typeof sessionId !== 'string') throw new Error('Native Escape session missing');
  await send('Emulation.setDeviceMetricsOverride', {width: 402, height: 874, deviceScaleFactor: 3, mobile: true}, sessionId);
  await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1}, sessionId);
  await send('Runtime.evaluate', {expression: `globalThis.escapeEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{escapeEvents.push({type:event.type,key:event.key,code:event.code,trusted:event.isTrusted,repeat:event.repeat});});`}, sessionId);
  await pressEscape(endpoint, 'about:blank');
  const result = await send('Runtime.evaluate', {expression: 'globalThis.escapeEvents', returnByValue: true}, sessionId);
  const events = field(field(result, 'result'), 'value');
  assert.deepEqual(events, [
    {type: 'keydown', key: 'Escape', code: 'Escape', trusted: true, repeat: false},
    {type: 'keyup', key: 'Escape', code: 'Escape', trusted: true, repeat: false},
  ]);
  console.log('original trusted Escape pair preserved');
} finally {process.off('SIGTERM', terminate); await close();}
