// Native HTTP-cache regression, through sim-lane, with no game or cache bypass.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { soakInspector } from '../soak/inspector.mjs';

const udid = process.env.SIM_UDID;
const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
if (!out) throw new Error('Requires --out=receipt.json');
if (!udid) throw new Error('Use sim-lane');
let version = 'first';
const requests = [], results = [];
const server = http.createServer((request, response) => {
  const path = new URL(request.url, 'http://local').pathname;
  if (path.endsWith('/sw.js')) {
    const body = `self.version=${JSON.stringify(version)};self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`;
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    const status = request.headers['if-none-match'] === etag ? 304 : 200;
    requests.push({ path, version, status, bodyBytes: status === 304 ? 0 : Buffer.byteLength(body), headers: { cacheControl: request.headers['cache-control'], ifNoneMatch: request.headers['if-none-match'], serviceWorker: request.headers['service-worker'] }, etag });
    response.writeHead(status, { 'content-type': 'text/javascript', 'cache-control': 'no-cache', etag });
    response.end(status === 304 ? undefined : body); return;
  }
  const mode = path.startsWith('/all/') ? 'all' : 'imports';
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Worker HTTP probe</title><script>
    window.probe={ready:false,error:null};
    (async()=>{try{window.reg=await navigator.serviceWorker.register('/${mode}/sw.js',{scope:'/${mode}/',updateViaCache:'${mode}'});await navigator.serviceWorker.ready;window.probe.ready=true;}catch(e){window.probe.error=String(e);}})();
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
  for (const mode of ['imports', 'all']) {
    version = 'first';
    const url = `${base}/${mode}/`;
    const from = requests.length;
    await open(url);
    results.push({ mode, phase: 'register', requests: requests.slice(from) });
    await update(mode, 'unchanged-same-process');
    inspector.close(); inspector = undefined;
    execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' });
    await open(url); await update(mode, 'unchanged-after-restart');
    version = 'second changed worker body';
    await update(mode, 'changed-body');
    inspector.close(); inspector = undefined;
    execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' });
  }
} finally {
  inspector?.close(); proxy.kill('SIGTERM');
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Closed. */ }
  await new Promise(resolve => { server.close(resolve); });
  writeFileSync(out, JSON.stringify({ base, results, requests }, null, 2));
}
console.info(JSON.stringify(results));

for (const phase of ['unchanged-same-process', 'unchanged-after-restart']) {
  const row = results.find(candidate => candidate.mode === 'all' && candidate.phase === phase);
  if (!row?.requests.length || row.requests.some(request => request.status !== 304 || request.bodyBytes !== 0)) throw new Error(`Unchanged worker did not revalidate: ${phase}`);
}
const changed = results.find(row => row.mode === 'all' && row.phase === 'changed-body');
if (!changed?.requests.some(request => request.status === 200 && request.bodyBytes > 0 && request.headers.ifNoneMatch !== request.etag)) throw new Error('Changed worker body was not fetched');
