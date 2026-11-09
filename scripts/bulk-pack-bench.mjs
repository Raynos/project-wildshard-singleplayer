#!/usr/bin/env node
import { KEYCHAIN_ARGS } from './chromium-keychain.mjs';
// bulk-pack-bench.mjs: the one-file-per-request boot download against the WSPK pack download, with no engine
// (E525 bulk-download spike, docs/plans/bulk-download-mini-spike.md).
//
//   scripts/browser-lane.sh node scripts/bulk-pack-bench.mjs --tree <built tree> --packs <bulk-pack.mjs out dir>
//        [--loose-q 3] [--cpu 1,4] [--reps 2] [--latency 100] [--down-mbps 10] [--lanes 8] [--paths loose-8,pack,…]
//
// A tiny HTTPS + HTTP/2 server (self-signed, like Vercel's edge: h2, brotli) serves the boot files one by one from
// --tree (brotli at --loose-q, today's served wire size) and the parts from --packs (their .br next to them when the
// packer wrote one). A muted headless Chromium as the iPhone 16 Pro, throttled with the phone-loading preset's
// network (100 ms latency, 10 Mb/s down) and a CPU rate, runs each path cold in a fresh context:
//   loose-8    today's spawn download (src/game/client/boot/spawnDownload.ts): the manifest, then every file through 8 lanes,
//              each body read chunk by chunk with a progress paint, and each response put into Cache Storage (a cold
//              first visit has no worker controller, so the page stores every file itself), then the session's
//              re-read of every file from that cache
//   loose-all  the same with no lane limit: everything HTTP/2 multiplexing alone can buy
//   loose-8+sw loose-8 while the worker's install precache (--tree/sw-files.json, the FILES list of sw-core) downloads
//              every file it lists at once on the same pipe, as on a cold first visit today
//   pack       the pack index, then every part at once, one Cache Storage put per part, members as zero-copy views
// Reported: wall seconds to the last byte (download) and to the last re-read (ready), requests and wire bytes seen
// by the browser. Prints one table; writes nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { extname, join, resolve as absolute } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { chromium, devices } from 'playwright';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/u, ''), process.argv[i + 1]);
const tree = absolute(args.get('tree') ?? 'tmp/bulk-download/tree');
const packs = absolute(args.get('packs') ?? 'tmp/bulk-download/packs-q3/driftwood-isle-grid-phone');
const looseQ = Number(args.get('loose-q') ?? 3);
const cpus = (args.get('cpu') ?? '1,4').split(',').map(Number);
const reps = Number(args.get('reps') ?? 2);
const latency = Number(args.get('latency') ?? 100), down = Number(args.get('down-mbps') ?? 10) * 1e6 / 8;
const lanes = Number(args.get('lanes') ?? 8);
const index = JSON.parse(readFileSync(join(packs, 'index.json'), 'utf8'));
const manifestPath = join(tree, 'assets/spawn', index.manifest);

// --- the server ---------------------------------------------------------------------------------------------------
const certDir = absolute('tmp/bulk-download/cert');
if (!existsSync(join(certDir, 'key.pem'))) {
  mkdirSync(certDir, { recursive: true });
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30', '-subj', '/CN=localhost',
    '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem')], { stdio: 'ignore' });
}
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2', '.html': 'text/html' };
const squeezed = new Map(), protocols = new Set();
function loose(path) {
  let hit = squeezed.get(path);
  if (hit === undefined) {
    const raw = readFileSync(path), type = types[extname(path)] ?? 'application/octet-stream';
    const body = type.startsWith('image/') ? raw : brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: looseQ } });
    hit = { body, type, encoded: !type.startsWith('image/') }; squeezed.set(path, hit);
  }
  return hit;
}
const reader = readFileSync(new URL('bulk-pack-reader.mjs', import.meta.url));
const page = `<!doctype html><meta charset="utf-8"><title>bulk bench</title><div id="fact">idle</div><script type="module">
import { readPackIndex, member } from '/reader.mjs';
const fact = document.getElementById('fact');
async function read(url, onChunk) {
  let response;
  try { response = await fetch(url, { cache: 'no-store' }); } catch (error) { throw new Error('fetch ' + url + ': ' + error.message); }
  if (!response.ok) throw new Error(url + ' ' + response.status);
  const copy = response.clone(), reader = response.body.getReader();
  let bytes = new Uint8Array(65536), size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break;
    if (size + part.value.byteLength > bytes.length) { const grown = new Uint8Array(Math.max(size + part.value.byteLength, bytes.length * 2)); grown.set(bytes); bytes = grown; }
    bytes.set(part.value, size); size += part.value.byteLength; onChunk(part.value.byteLength); }
  return { bytes: bytes.subarray(0, size), copy };
}
window.loose = async (lanes, background) => {
  const t0 = performance.now(), store = await caches.open('bench-' + Math.random());
  // the worker's install precache of a cold first visit: every listed file at once, beside the boot
  if (background) void fetch('/sw-files.json', { cache: 'no-store' }).then(r => r.json()).then(list => Promise.all(list.map(url =>
    fetch('/loose' + url.split('?')[0], { cache: 'no-store' }).then(r => r.arrayBuffer()).catch(() => null))));
  const manifest = await (await fetch('/manifest.json', { cache: 'no-store' })).json();
  const files = manifest.files.map(f => '/loose' + f.url.split('?')[0]);
  let done = 0, cursor = 0;
  await Promise.all(Array.from({ length: Math.min(lanes, files.length) }, async () => {
    for (let i = cursor++; i < files.length; i = cursor++) {
      const { copy } = await read(files[i], n => { done += n; fact.textContent = 'Spawn view · ' + (done / 1e6).toFixed(2) + ' MB'; });
      await store.put(files[i], copy);
    }
  }));
  const downloaded = performance.now() - t0;
  let reread = 0;
  for (const url of files) reread += (await (await store.match(url)).arrayBuffer()).byteLength;
  return { downloaded, ready: performance.now() - t0, files: files.length, reread };
};
window.pack = async () => {
  const t0 = performance.now(), store = await caches.open('bench-' + Math.random());
  const index = await (await fetch('/packs/index.json', { cache: 'no-store' })).json();
  let done = 0, first = null, members = 0, bytes = 0;
  await Promise.all(index.parts.map(async part => {
    const url = '/packs/' + part.url, { bytes: body, copy } = await read(url, n => { done += n; fact.textContent = 'Spawn view · ' + (done / 1e6).toFixed(2) + ' MB'; });
    first ??= performance.now() - t0;
    await store.put(url, copy);
    for (const entry of readPackIndex(body).files.values()) { members++; bytes += member(body, entry).byteLength; }
  }));
  const downloaded = performance.now() - t0;
  return { downloaded, ready: performance.now() - t0, files: members, reread: bytes, first };
};
</script>`;
// maxSessionMemory: a throttled client leaves whole parts buffered in the session; Node's 10 MB default resets it
const server = createSecureServer({ key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')), maxSessionMemory: 512 }, (req, res) => {
  const url = new URL(req.url, 'https://localhost'); protocols.add(req.httpVersion);
  const send = (status, body, type, encoded = false) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...(encoded ? { 'content-encoding': 'br' } : {}) }); res.end(body);
  };
  const reply = () => {
    if (url.pathname === '/') return [200, page, 'text/html'];
    if (url.pathname === '/reader.mjs') return [200, reader, 'text/javascript'];
    if (url.pathname === '/sw-files.json') return [200, existsSync(join(tree, 'sw-files.json')) ? readFileSync(join(tree, 'sw-files.json')) : '[]', 'application/json'];
    if (url.pathname === '/manifest.json') return [200, readFileSync(manifestPath), 'application/json'];
    if (url.pathname.startsWith('/loose/')) {
      const path = join(tree, decodeURIComponent(url.pathname.slice('/loose'.length)));
      if (!path.startsWith(tree) || !existsSync(path)) return [404, 'missing', 'text/plain'];
      const hit = loose(path); return [200, hit.body, hit.type, hit.encoded];
    }
    if (url.pathname.startsWith('/packs/')) {
      const path = join(packs, url.pathname.slice('/packs/'.length));
      if (!path.startsWith(packs) || !existsSync(path)) return [404, 'missing', 'text/plain'];
      if (existsSync(`${path}.br`)) return [200, readFileSync(`${path}.br`), 'application/octet-stream', true];
      return [200, readFileSync(path), path.endsWith('.json') ? 'application/json' : 'application/octet-stream'];
    }
    return [404, 'missing', 'text/plain'];
  };
  send(...reply());
});
server.on('sessionError', error => console.error('[server session]', error.message));
server.on('streamError', error => console.error('[server stream]', error.message));
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const origin = `https://localhost:${server.address().port}`;
// warm the server's brotli cache so the first loose run does not pay for compression
for (const file of JSON.parse(readFileSync(manifestPath, 'utf8')).files) {
  const path = join(tree, file.url.split('?')[0]); if (existsSync(path) && statSync(path).isFile()) loose(path);
}

// --- the browser ----------------------------------------------------------------------------------------------------
const browser = await chromium.launch({ args: [...KEYCHAIN_ARGS, '--mute-audio', '--ignore-certificate-errors'] });
async function run(kind, cpu) {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], ignoreHTTPSErrors: true });
  const tab = await context.newPage();
  await tab.goto(`${origin}/`);
  const cdp = await context.newCDPSession(tab);
  let requests = 0, wire = 0;
  cdp.on('Network.requestWillBeSent', () => { requests++; });
  cdp.on('Network.loadingFinished', event => { wire += event.encodedDataLength; });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: down, uploadThroughput: 5e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const result = kind === 'pack' ? await tab.evaluate(() => window.pack())
    : await tab.evaluate(([n, background]) => window.loose(n, background), [kind === 'loose-all' ? 10_000 : lanes, kind === 'loose-8+sw']);
  await context.close();
  return { ...result, requests, wire };
}
const rows = [], kinds = (args.get('paths') ?? 'loose-8,loose-all,loose-8+sw,pack').split(',');
let retries = 0;
try {
  for (const cpu of cpus) for (const kind of kinds) {
    const runs = [];
    // one retry per rep, counted, in case a throttled session is reset
    for (let i = 0; i < reps; i++) {
      try { runs.push(await run(kind, cpu)); }
      catch (error) { retries++; console.error(`[retry] ${kind} ${cpu}x: ${String(error instanceof Error ? error.message : error).split('\n')[0]}`); runs.push(await run(kind, cpu)); }
    }
    runs.sort((a, b) => a.ready - b.ready);
    const mid = runs[Math.floor(runs.length / 2)];
    rows.push({ cpu, kind, ...mid, all: runs.map(r => (r.ready / 1000).toFixed(1)).join(' ') });
  }
} finally { await browser.close(); server.close(); }
const s = ms => (ms / 1000).toFixed(1).padStart(6);
console.log(`${index.manifest}: ${index.files} files; latency ${latency} ms, ${(down * 8 / 1e6).toFixed(0)} Mb/s down, loose brotli q${looseQ}, packs ${packs}`);
console.log(`HTTP versions served: ${[...protocols].join(', ')}; retried runs: ${retries}`);
console.log('cpu  path        download s   ready s  requests  wire MB  files   (ready per rep)');
for (const r of rows) console.log(`${String(r.cpu).padStart(2)}x  ${r.kind.padEnd(10)} ${s(r.downloaded)}    ${s(r.ready)}  ${String(r.requests).padStart(8)}  ${(r.wire / 1e6).toFixed(2).padStart(7)}  ${String(r.files).padStart(5)}   (${r.all})`);
