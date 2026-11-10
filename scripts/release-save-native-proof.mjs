// Outside-hook native observer proof; run through scripts/browser-lane.sh.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium, devices } from 'playwright';
import { KEYCHAIN_ARGS } from './chromium-keychain.mjs';
import { observeReleaseSaveControl, watchReleaseSaveRefusals } from './release-save-profile.mjs';
import { observeReleaseStorage } from './release-storage-profile.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const started = performance.now();
const engine = resolve(process.argv[2] ?? 'engine-source');
const requireEngine = createRequire(resolve(engine, 'package.json'));
const { build } = await import(pathToFileURL(resolve(engine, 'node_modules/rolldown/dist/index.mjs')).href);
const source = `
import {SaveStore} from ${JSON.stringify(resolve(engine, 'src/shared/engine/saves/store.ts'))};
import {installAppIdentity} from ${JSON.stringify(resolve(engine, 'src/shared/engine/app/identity.ts'))};
import {ForwardedStorage} from ${JSON.stringify(resolve(engine, 'src/server/engine/saves/forwardedStorage.ts'))};
import * as v from ${JSON.stringify(requireEngine.resolve('valibot'))};
installAppIdentity({name:'',wordmark:'',tagline:'',savePrefix:'private-prefix.',saveFormat:'',fileSlug:'',exposeProbe:()=>{},harness:()=>{}});
onmessage=e=>{const port=e.ports[0],storage=new ForwardedStorage({},write=>port.postMessage({kind:'write',...write}));
const slot=new SaveStore({local:storage,session:null}).define({key:'continuation',scope:'global',version:1,schema:v.string(),initial:()=>''});
port.onmessage=async event=>{const message=event.data;if(message.kind==='written'){storage.acked(message.seq,message.ok);return;}
if(message.kind==='save'){const wrote=slot.write(message.id===1?{privateKey:'private-value'}:'private-value');
const ok=await storage.settled()&&wrote;port.postMessage({kind:'saved',id:message.id,tick:32,ok});}};
port.postMessage({kind:'booted'});};`;
const built = await build({ input: 'native-save-proof', plugins: [{ name: 'native-save-proof', resolveId: id => id === 'native-save-proof' ? '\0native-save-proof' : null, load: id => id === '\0native-save-proof' ? source : null }], write: false, platform: 'browser', output: { format: 'esm', minify: true } });
const runtime = built.output[0].code;
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/html');
  response.end(request.url === '/standalone/serverWorker-fixture.js' ? 'import "./serverRuntime-fixture.js";' : request.url === '/standalone/serverRuntime-fixture.js' ? runtime : '<!doctype html><title>Native save diagnosis</title>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser, stopWatcher;
const watchdog = setTimeout(() => { console.error('Native save observer exceeded 8 seconds'); process.exitCode = 1; void browser?.close(); server.close(); }, 8000);
watchdog.unref();
try {
  browser = await chromium.launch({ headless: true, args: [...KEYCHAIN_ARGS, '--mute-audio'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await context.addInitScript(observeReleaseSaveControl); await context.addInitScript(observeReleaseStorage);
  const address = server.address(); assert.ok(address !== null && typeof address !== 'string');
  const page = await context.newPage(); await page.goto(`http://127.0.0.1:${address.port}/`);
  const pending = page.waitForEvent('worker');
  await page.evaluate(() => new Promise(resolve => {
    const worker = new Worker('/standalone/serverWorker-fixture.js', { type: 'module' }), channel = new MessageChannel();
    Reflect.set(globalThis, 'saveFixture', { worker, port: channel.port1 });
    channel.port1.onmessage = event => { if (event.data.kind === 'booted') resolve(); };
    channel.port1.start(); worker.postMessage({}, [channel.port2]);
  }));
  const worker = await pending;
  let injected = false;
  const failMethod = process.argv.includes('--fail-resume') ? 'Debugger.resume' : process.argv.includes('--fail-remove') ? 'Debugger.removeBreakpoint' : null;
  const observingBrowser = failMethod === null ? browser : { newBrowserCDPSession: async () => {
    const root = await browser.newBrowserCDPSession();
    return new Proxy(root, { get(target, key) {
      if (key === 'send') return async (method, params) => {
        if (!injected && method === 'Target.sendMessageToTarget' && JSON.parse(params.message).method === failMethod) {
          injected = true; throw new Error('Owned diagnostic transport refusal');
        }
        return target.send(method, params);
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
  stopWatcher = await watchReleaseSaveRefusals(observingBrowser, worker.url());
  const saved = await page.evaluate(() => new Promise(resolve => {
    const { port } = Reflect.get(globalThis, 'saveFixture');
    port.onmessage = async event => {
      if (event.data.kind === 'write') {
        const ok = await new Promise((finish, reject) => {
          const opening = indexedDB.open('native-save-valid', 1);
          opening.onupgradeneeded = () => opening.result.createObjectStore('saves');
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const database = opening.result, transaction = database.transaction('saves', 'readwrite');
            transaction.objectStore('saves').put(event.data.value, event.data.key);
            transaction.onabort = () => { database.close(); finish(false); };
            transaction.oncomplete = () => { database.close(); finish(true); };
          };
        });
        port.postMessage({ kind: 'written', seq: event.data.seq, ok });
      }
      if (event.data.kind === 'saved') resolve(event.data);
    };
    port.postMessage({ kind: 'save', id: 1 });
  }));
  assert.equal(saved.ok, false, 'Actual SaveStore schema refusal must remain false');
  const durable = await page.evaluate(() => new Promise(resolve => {
    const { port } = Reflect.get(globalThis, 'saveFixture');
    port.onmessage = async event => {
      if (event.data.kind === 'write') {
        const ok = await new Promise((finish, reject) => {
          const opening = indexedDB.open('native-save-fault', 1);
          opening.onupgradeneeded = () => opening.result.createObjectStore('saves');
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const database = opening.result, transaction = database.transaction('saves', 'readwrite'), store = transaction.objectStore('saves');
            store.add(event.data.value, 'same'); store.add(event.data.value, 'same');
            transaction.onabort = () => { database.close(); finish(false); };
            transaction.oncomplete = () => { database.close(); finish(true); };
          };
        });
        port.postMessage({ kind: 'written', seq: event.data.seq, ok });
      }
      if (event.data.kind === 'saved') resolve(event.data);
    };
    port.postMessage({ kind: 'save', id: 2 });
  }));
  assert.equal(durable.ok, false, 'Actual IndexedDB refusal must reach ForwardedStorage');
  const schema = await stopWatcher(); stopWatcher = undefined;
  assert.deepEqual(schema.errors, failMethod === 'Debugger.resume' ? ['Resume refused; emergency detach attempted'] : failMethod === 'Debugger.removeBreakpoint' ? ['Breakpoint removal refused'] : []);
  assert.equal(injected, failMethod !== null); assert.equal(schema.methods, 1);
  assert.equal(schema.reports.length, 1); assert.equal(schema.reports[0].key, 'continuation');
  assert.equal(schema.reports[0].issue, 'type');
  const control = await page.evaluate(() => Reflect.get(globalThis, '__releaseSaveControl'));
  // An existing receiver may synchronously post its acknowledgement before
  // this later observational listener runs. Match IDs, not listener order.
  assert.equal(control.rows.filter(row => row.kind === 'save').length, 2);
  assert.equal(control.rows.filter(row => row.kind === 'saved').length, 2);
  assert.equal(control.rows.filter(row => row.kind === 'write').length, control.rows.filter(row => row.kind === 'written').length);
  assert.ok(control.rows.some(row => row.kind === 'write' && row.chars > 13));
  assert.ok(control.rows.some(row => row.kind === 'written' && row.ok === true));
  assert.ok(control.rows.some(row => row.kind === 'written' && row.ok === false));
  assert.ok(control.rows.filter(row => row.kind === 'saved').every(row => row.ok === false));
  assert.equal(JSON.stringify({ schema, control }).includes('private-'), false);
  const faults = await page.evaluate(() => Reflect.get(globalThis, '__releaseStorageFaults'));
  assert.ok(faults.rows.some(row => row.error === 'ConstraintError'));
  await page.evaluate(() => { const { port, worker } = Reflect.get(globalThis, 'saveFixture'); port.close(); worker.terminate(); });
  await context.close();
  console.log('PASS native save/control/schema/IndexedDB refusal preserved, values elided, debugger resumed and detached', JSON.stringify({ elapsedMs: performance.now() - started }));
} finally { clearTimeout(watchdog); try { await stopWatcher?.(); } finally { try { await browser?.close(); } finally { await new Promise(resolve => server.close(resolve)); } } }
