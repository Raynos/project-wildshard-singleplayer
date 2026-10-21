// Native bootstrap/core regression through sim-lane. Run Node with
// --experimental-transform-types --import ./scripts/sim-node-loader.mjs.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { soakInspector } from '../soak/inspector.mjs';
import { workerScripts } from '../../vite/pwa-plugin.ts';

const udid = process.env.SIM_UDID;
const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
if (!out) throw new Error('Requires --out=receipt.json');
if (!udid) throw new Error('Use sim-lane');
let version = 'first';
const requests = [], results = [], cores = new Map();
function current() {
  const core = `const version=${JSON.stringify(version)};self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('message',event=>{if(event.data==='VERSION')event.ports[0].postMessage(version)});/*${'bounded fixture '.repeat(2000)}*/`;
  const scripts = workerScripts(core); cores.set(`/${scripts.fileName}`, core); return scripts;
}
const server = http.createServer((request, response) => {
  const path = new URL(request.url, 'http://local').pathname;
  const scripts = current();
  if (path === '/sw.js' || cores.has(path)) {
    const body = path === '/sw.js' ? scripts.bootstrap : cores.get(path);
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    const status = request.headers['if-none-match'] === etag ? 304 : 200;
    requests.push({ path, version, status, bodyBytes: status === 304 ? 0 : Buffer.byteLength(body), etag,
      requestCache: { ifNoneMatch: request.headers['if-none-match'], serviceWorker: request.headers['service-worker'] } });
    response.writeHead(status, { 'content-type': 'text/javascript', 'cache-control': path === '/sw.js' ? 'no-cache' : 'public, max-age=31536000, immutable', etag });
    response.end(status === 304 ? undefined : body); return;
  }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Worker bootstrap probe</title><script>
    window.probe={ready:false,error:null,version:null};
    async function refresh(){try{const channel=new MessageChannel();window.probe.version=await new Promise(resolve=>{channel.port1.onmessage=event=>resolve(event.data);navigator.serviceWorker.controller.postMessage('VERSION',[channel.port2])});}catch(error){window.probe.error=String(error)}}
    navigator.serviceWorker.addEventListener('controllerchange',refresh);
    (async()=>{try{window.reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'all'});await navigator.serviceWorker.ready;if(navigator.serviceWorker.controller)await refresh();window.probe.ready=true;}catch(error){window.probe.error=String(error)}})();
  </script>`);
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Probe server did not bind');
const base = `http://127.0.0.1:${address.port}`;
async function freePort() {
  const socket = http.createServer(); await new Promise(resolve => { socket.listen(0, '127.0.0.1', resolve); });
  const bound = socket.address();
  if (bound === null || typeof bound === 'string') throw new Error('Inspector port did not bind');
  const port = bound.port; await new Promise(resolve => { socket.close(resolve); }); return port;
}
const listPort = await freePort(), pagePort = await freePort();
const socket = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', `null:${listPort},:${pagePort}-${pagePort + 8}`], { stdio: 'ignore' });
let inspector;
async function connect(url) {
  inspector?.close(); inspector = undefined;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (let port = pagePort; port <= pagePort + 8; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = pages.findLast(row => row.url === url);
        if (!page) continue;
        inspector = soakInspector(page.webSocketDebuggerUrl); await inspector.opened; await sleep(600);
        await inspector.evaluate('performance.now()'); return;
      } catch { inspector?.close(); inspector = undefined; }
    }
    await sleep(250);
  }
  throw new Error('Inspector did not connect to minimal worker page');
}
async function wait(expression) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const state = JSON.parse(await inspector.evaluate(`JSON.stringify({ready:!!(${expression}),error:window.probe.error})`));
    if (state.error) throw new Error(state.error);
    if (state.ready) return;
    await sleep(150);
  }
  throw new Error(`Minimal worker probe timeout: ${expression}`);
}
async function open(url) {
  execFileSync('xcrun', ['simctl', 'launch', udid, 'com.apple.mobilesafari'], { stdio: 'ignore', timeout: 60000 });
  execFileSync('xcrun', ['simctl', 'openurl', udid, url], { timeout: 60000 });
  await connect(url); await wait('window.probe.ready');
}
async function update(mode, phase) {
  const from = requests.length;
  await inspector.evaluate(`window.probe.updated=false;window.reg.update().then(()=>{window.probe.updated=true},e=>{window.probe.error=String(e)});true`);
  await wait('window.probe.updated');
  results.push({ mode, phase, registrationMode: await inspector.evaluate('window.reg.updateViaCache'), requests: requests.slice(from) });
}
try {
  const url = `${base}/`;
  const from = requests.length;
  await open(url); await wait("window.probe.version === 'first'");
  results.push({ phase: 'register', version: await inspector.evaluate('window.probe.version'), requests: requests.slice(from) });
  await update('all', 'unchanged-same-process');
  inspector.close(); inspector = undefined;
  execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' });
  const restarted = requests.length;
  await open(url); await wait("window.probe.version === 'first'");
  results.push({ phase: 'unchanged-restart-navigation', requests: requests.slice(restarted) });
  await update('all', 'unchanged-after-restart');
  version = 'other';
  await update('all', 'changed-body'); await wait("window.probe.version === 'other'");
  results.push({ phase: 'changed-core-reached-client', version: await inspector.evaluate('window.probe.version') });
} finally {
  inspector?.close(); proxy.kill('SIGTERM');
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Closed. */ }
  await new Promise(resolve => { server.close(resolve); });
  writeFileSync(out, JSON.stringify({ base, results, requests }, null, 2));
}
console.info(JSON.stringify(results));

for (const phase of ['unchanged-same-process', 'unchanged-restart-navigation', 'unchanged-after-restart']) {
  const row = results.find(candidate => candidate.phase === phase);
  if (row === undefined || row.requests.some(request => request.path !== '/sw.js' || request.bodyBytes > 1024)) throw new Error(`Unchanged core was fetched: ${phase}`);
  if (phase !== 'unchanged-restart-navigation' && row.requests.length === 0) throw new Error(`Missing real update check: ${phase}`);
}
const initial = results.find(row => row.phase === 'register'), changed = results.find(row => row.phase === 'changed-body');
const firstCore = initial?.requests.find(request => request.path.startsWith('/sw-core/'));
const nextCore = changed?.requests.find(request => request.path.startsWith('/sw-core/') && request.status === 200);
if (firstCore === undefined || nextCore === undefined || firstCore.path === nextCore.path || firstCore.bodyBytes !== nextCore.bodyBytes) throw new Error('Same-length changed core was not fetched under its new hash');
if (results.find(row => row.phase === 'changed-core-reached-client')?.version !== 'other') throw new Error('Changed core did not reach the client');
