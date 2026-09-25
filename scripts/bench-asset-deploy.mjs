#!/usr/bin/env node
// bench-asset-deploy.mjs — E160's ruler: what does a returning player download when a deploy changes ONE texture?
//
// On a tree (--root, default this checkout): build, serve with `vite preview`, and in one headless Chromium context
// (service worker on, CDP-throttled like scripts/bench-load.mjs) launch Pine Hollow twice so everything is cached. Then
// "deploy": edit two files under <root>/public — a boot texture grows by 64 bytes (a JPEG keeps decoding past its EOI)
// and a boot glTF changes one character at the SAME size — rebuild, restart the preview on the same origin, open the
// page (the old worker serves the old build and installs the new one), adopt the new worker the way the build pill does
// (`__ws_sw.adopt()`), and count every byte that crossed the network from that open to the new build being playable.
// Last, the stale check: the page reads the glTF through its own fetch and the bytes are compared with the edited file.
// The edits are undone at the end (the original bytes are written back).
//
//   node scripts/bench-asset-deploy.mjs --root=/tmp/e160-before --tier=phone|desktop [--port=4193] [--net=wifi]
//   --to=<tree>: no edits — the deploy is <tree> itself (another commit's build on the same origin: what landing it costs)
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { chromium } = await import('playwright');

const HERE = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const ROOT = resolvePath(flag('root', HERE));
const TO = flag('to', '') ? resolvePath(flag('to', '')) : null;
const TIER = flag('tier', 'phone');
const PORT = Number(flag('port', '4193'));
const NET = { wifi: { latency: 20, down: 30e6 / 8, up: 15e6 / 8 }, none: null }[flag('net', 'wifi')];
const [VW, VH] = TIER === 'phone' ? [390, 844] : [1280, 720];
const PAGE = `/?nolock=1&mute=1&chunk=pine-hollow&${TIER === 'phone' ? 'touch=1&tier=phone' : 'tier=desktop'}`;
// the texture: the tier's copy of Pine Hollow's leafy-grass normal map (in the phone pack / a desktop boot read)
const TEXTURE = TIER === 'phone' ? 'public/assets/tex/leafy_grass/nor_gl_1k.jpg' : 'public/assets/tex/leafy_grass/nor_gl.jpg';
const GLTF = 'public/assets/models/stone_fire_pit/stone_fire_pit.gltf';
const OUT = resolvePath(HERE, flag('out', `progress/bench/asset-deploy-${TIER}-${ROOT.split('/').pop()}${TO ? `-to-${TO.split('/').pop()}` : ''}.json`));
const BASE = `http://localhost:${PORT}`;
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

let preview = null;
const stopPreview = async () => { if (preview && !preview.killed) { preview.kill('SIGTERM'); await new Promise((resolve) => { preview.once('exit', resolve); setTimeout(resolve, 3000); }); } };
async function serve(root = ROOT) {
  await stopPreview();
  let listening = false;
  preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  // oxlint-disable-next-line no-control-regex -- stripping vite's ANSI colours
  preview.stdout.on('data', (d) => { if (String(d).replaceAll(/\u001B\[[\d;]*m/g, '').includes(`:${PORT}/`)) listening = true; });
  await waitFor(() => listening, 30_000, 'vite preview did not come up');
  await waitFor(async () => (await fetch(`${BASE}/version.json`)).ok, 20_000, 'vite preview did not answer');
  return (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build;
}
const build = (root = ROOT) => execSync('npx vite build', { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => { if (preview && !preview.killed) preview.kill('SIGTERM'); });

const texPath = join(ROOT, TEXTURE), gltfPath = join(ROOT, GLTF);
const texOrig = readFileSync(texPath), gltfOrig = readFileSync(gltfPath);
const result = { root: ROOT, tier: TIER, texture: TEXTURE, gltf: GLTF };
const { browser, chrome, throttle } = await launchBrowser();
try {
  build();
  result.buildA = await serve();
  await throttle(NET);
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, serviceWorkers: 'allow' });
  const reqs = [];
  const inflight = [];
  ctx.on('requestfinished', (req) => { inflight.push((async () => {
    const [sizes, res] = await Promise.all([within(req.sizes(), 5000), within(req.response(), 5000)]);
    reqs.push({ url: req.url(), bySW: Boolean(req.serviceWorker()), fromSW: Boolean(res?.fromServiceWorker()), body: sizes?.responseBodySize ?? 0, headers: sizes?.responseHeadersSize ?? 0 });
  })()); });
  const page = await ctx.newPage();
  // the background download off (pause ▸ Settings ▸ Debug; no URL switches — AGENTS.md): the saved settings, before any script runs
  await page.addInitScript(() => { localStorage.setItem('ws.settings.v1', JSON.stringify({ prefetch: 'off' })); });
  const mark = async () => { await within(Promise.all(inflight), 10_000); const n = reqs.length; return () => reqs.slice(n); };
  // 1. two launches of build A: everything the boot reads is in the worker's cache
  let since = await mark();
  await page.goto(BASE + PAGE, { waitUntil: 'commit' });
  await playable(page);
  result.first = account(since());
  await page.waitForTimeout(3000);
  since = await mark();
  await page.goto(BASE + PAGE, { waitUntil: 'commit' });
  await playable(page);
  await page.waitForTimeout(2000);
  result.second = account(since());
  console.error(`  build A ${result.buildA}: first launch ${mb(result.first.netBytes)}, second ${mb(result.second.netBytes)}`);

  // 2. the deploy: one texture grows, one glTF changes at the same size (or, with --to, another tree's build)
  if (TO) { build(TO); result.buildB = await serve(TO); } else {
  writeFileSync(texPath, Buffer.concat([texOrig, Buffer.alloc(64, 0x20)]));
  const text = gltfOrig.toString('utf8');
  const at = text.indexOf('"generator"');
  if (at === -1) throw new Error(`${GLTF} has no "generator" to edit`);
  const q = text.indexOf('"', text.indexOf(':', at) + 1) + 1; // the generator string's first character
  const edited = `${text.slice(0, q)}${text[q] === 'X' ? 'Y' : 'X'}${text.slice(q + 1)}`;
  writeFileSync(gltfPath, edited);
  result.gltfEdited = sha(Buffer.from(edited));
  result.gltfOriginal = sha(gltfOrig);
  build();
  result.buildB = await serve();
  }

  // 3. the returning player: open (old worker, old build) → the new worker installs → adopt → the new build boots
  since = await mark();
  await page.goto(BASE + PAGE, { waitUntil: 'commit' });
  await playable(page);
  await page.waitForFunction(() => Boolean(window.__ws_sw?.waiting), null, { timeout: 120_000, polling: 250 });
  await Promise.all([page.waitForEvent('load', { timeout: 60_000 }), page.evaluate(() => { void window.__ws_sw?.adopt(); })]);
  await playable(page);
  await page.waitForTimeout(3000);
  result.deploy = account(since());
  // 4. the stale check: the glTF as the new build's own fetch sees it
  result.gltfServed = await page.evaluate(async (p) => {
    const buf = await (await fetch(p)).arrayBuffer();
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return Array.from(d.subarray(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
  }, GLTF.replace(/^public/, ''));
  result.stale = TO ? null : result.gltfServed !== result.gltfEdited;
  result.sw = await page.evaluate(() => window.__ws_sw?.version());
  console.error(`  build B ${result.buildB} (worker ${result.sw?.build}): the deploy cost ${mb(result.deploy.netBytes)} in ${result.deploy.netRequests} requests; glTF served ${result.stale ? 'STALE (the old bytes)' : 'fresh'}`);
  await within(ctx.close(), 10_000);
} finally {
  writeFileSync(texPath, texOrig);
  writeFileSync(gltfPath, gltfOrig);
  await within(browser.close(), 10_000); chrome.kill(); await stopPreview();
}
mkdirSync(resolvePath(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`deploy of one texture (+64 B) and one same-size glTF edit — ${TIER} — ${ROOT}: ${mb(result.deploy.netBytes)} over the network; glTF ${result.stale ? 'STALE' : 'fresh'}`);
for (const [u, n] of result.deploy.net.slice(0, 15)) console.log(`  ${mb(n).padStart(9)}  ${u}`);
process.exit(0);

async function playable(page) {
  await page.waitForFunction(() => Boolean(window.__world) && !document.querySelector('.ws-load'), null, { timeout: 300_000, polling: 250 });
}
function account(rs) {
  let netBytes = 0, netRequests = 0;
  const net = [];
  for (const r of rs) {
    if (!r.url.startsWith(BASE)) continue;
    const n = r.body + r.headers;
    if (r.bySW || (!r.fromSW && r.body > 0)) { netBytes += n; netRequests++; net.push([r.url.replace(BASE, ''), n]); }
  }
  net.sort((a, b) => b[1] - a[1]);
  return { netBytes, netRequests, net };
}
async function launchBrowser() {
  const udd = mkdtempSync(join(tmpdir(), 'wildshard-deploy-'));
  const chromeProc = spawn(chromium.executablePath(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(udd, 'DevToolsActivePort');
  await waitFor(() => existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n')[0] > 0, 15_000, 'chromium did not open its DevTools port');
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  let id = 0; const pending = new Map(); const swSessions = new Set(); let current = null;
  const send = (method, params, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const apply = (sessionId) => (current ? send('Network.emulateNetworkConditions', { offline: false, latency: current.latency, downloadThroughput: current.down, uploadThroughput: current.up }, sessionId) : send('Network.disable', {}, sessionId));
  ws.addEventListener('message', (ev) => { void (async () => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); return; }
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      if (targetInfo.type === 'service_worker' && targetInfo.url.startsWith(BASE)) {
        swSessions.add(sessionId);
        try { await send('Network.enable', {}, sessionId); await apply(sessionId); } catch (e) { console.error(`  [sw throttle] ${e.message}`); }
      }
      send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => undefined);
    }
    if (m.method === 'Target.detachedFromTarget') swSessions.delete(m.params.sessionId);
  })(); });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const cdpBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return { browser: cdpBrowser, chrome: chromeProc, throttle: async (n) => { current = n; for (const s of swSessions) await apply(s).catch(() => undefined); } };
}
function mb(b) { return typeof b === 'number' ? `${(b / 1048576).toFixed(2)} MB` : 'n/a'; }
function within(p, ms) { return Promise.race([Promise.resolve(p).catch(() => null), new Promise((resolve) => { setTimeout(resolve, ms, null).unref(); })]); }
async function waitFor(fn, ms, msg) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch { /* not yet */ } await new Promise((resolve) => { setTimeout(resolve, 250); }); } throw new Error(msg); }
