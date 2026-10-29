import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium, type Browser, type Request} from 'playwright';
import {NativeSizeLedger, type NativeSizes} from './native-sizes.ts';
import {record, type Profile} from './model.ts';

export interface ChromiumRun {browser: Browser; close: () => Promise<void>; workerNetwork: () => boolean; errors: string[]; nativeSizes: (request: Request) => NativeSizes | null}
/** Browser-level auto-attach catches the worker before its first network request. */
export async function launchChromium(directory: string, profile: Profile): Promise<ChromiumRun> {
  await mkdir(directory, {recursive: true});
  const child = spawn(chromium.executablePath(), ['--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${directory}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
  let socket: WebSocket | undefined;
  try {
    const endpoint = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Chromium CDP endpoint deadline')), 15_000);
      child.once('error', error => {clearTimeout(timer); reject(error);});
      child.once('exit', code => {clearTimeout(timer); reject(new Error(`Chromium exited ${code}`));});
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /DevTools listening on (ws:\/\/[^\s]+)/u.exec(output)?.[1];
        if (match !== undefined) {clearTimeout(timer); resolve(match);}
      });
    });
    const ws = new WebSocket(endpoint); socket = ws;
    await new Promise<void>((resolve, reject) => {ws.addEventListener('open', () => resolve(), {once: true});
      ws.addEventListener('error', () => reject(new Error('CDP socket error')), {once: true});});
    let serial = 0, workers = 0;
    const errors: string[] = [];
    const sessions = new Map<string, boolean>();
    const pending = new Map<number, {resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; sessionId?: string}>();
    const send = (method: string, params: object, sessionId?: string): Promise<unknown> => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {pending.delete(id); reject(new Error(`CDP deadline: ${method}`));}, 15_000);
      pending.set(id, {resolve, reject, timer, ...(sessionId === undefined ? {} : {sessionId})}); ws.send(JSON.stringify({id, method, params, sessionId}));
    });
    const native = new NativeSizeLedger(async (session, id) => {
      const result = record(await send('Network.getResponseBody', {requestId: id}, session));
      if (typeof result['body'] !== 'string') throw new Error('Missing native body');
      return Buffer.byteLength(result['body'], result['base64Encoded'] === true ? 'base64' : 'utf8');
    });
    ws.addEventListener('message', event => {
      const message = record(JSON.parse(String(event.data)));
      if (typeof message['id'] === 'number') {
        const command = pending.get(message['id']);
        if (command === undefined) return;
        pending.delete(message['id']); clearTimeout(command.timer);
        if (message['error'] !== undefined) command.reject(new Error(JSON.stringify(message['error'])));
        else command.resolve(message['result']);
        return;
      }
      if (typeof message['sessionId'] === 'string' && typeof message['method'] === 'string')
        native.event(message['sessionId'], sessions.get(message['sessionId']) ?? false, message['method'], message['params']);
      if (message['method'] === 'Target.detachedFromTarget') {
        const ended = record(message['params'])['sessionId'];
        if (typeof ended === 'string') {
          sessions.delete(ended);
          for (const [id, command] of pending) if (command.sessionId === ended) {pending.delete(id); clearTimeout(command.timer); command.reject(new Error('Native target ended'));}
        }
        return;
      }
      if (message['method'] !== 'Target.attachedToTarget') return;
      const params = record(message['params']), info = record(params['targetInfo']);
      const sessionId = params['sessionId'];
      if (typeof sessionId !== 'string') return;
      sessions.set(sessionId, info['type'] === 'service_worker');
      void (async () => {
        let resumed = false;
        try {
          if (info['type'] === 'worker' || info['type'] === 'shared_worker') {
            await send('Runtime.runIfWaitingForDebugger', {}, sessionId); resumed = true;
          }
          if (['page', 'iframe', 'service_worker'].includes(String(info['type']))) await send('Network.enable', {}, sessionId);
          if (info['type'] === 'service_worker') {
            await send('Network.emulateNetworkConditions', {offline: false, latency: profile.latency,
              downloadThroughput: profile.down, uploadThroughput: profile.up}, sessionId);
            workers++;
          }
        } catch (error) {if (sessions.has(sessionId)) errors.push(`Native network setup: ${String(error)}`);}
        finally {if (!resumed && sessions.has(sessionId)) await send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch((error: unknown) => {errors.push(String(error));});}
      })();
    });
    await send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true});
    const browser = await chromium.connectOverCDP(endpoint);
    return {browser, errors, nativeSizes: request => native.read(request), workerNetwork: () => workers > 0, close: async () => {
      try {await browser.close();} finally {
        ws.close(); child.kill();
        for (const command of pending.values()) {clearTimeout(command.timer); command.reject(new Error('CDP closed'));}
      }
    }};
  } catch (error) {socket?.close(); child.kill(); throw error;}
}
