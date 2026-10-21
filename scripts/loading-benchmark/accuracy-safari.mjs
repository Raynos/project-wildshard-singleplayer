// scripts/sim-lane.sh run --max 20 wildshard-loading node scripts/loading-benchmark/accuracy-safari.mjs --base=URL --pin=SHA --dist=DIR --out=DIR
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer } from 'node:net';
import { observeTransport } from './transport.mjs';
import { soakInspector } from '../soak/inspector.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';
import { accuracyRecorder, accuracyCaption } from './accuracy-data.mjs';
import { accuracyReport } from './accuracy-report.mjs';
import { loadingCardIndex } from './catalogue.mjs';
import { crossingProbeCode, crossingReport } from './crossing.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const udid = process.env.SIM_UDID, upstream = arg('base'), pin = arg('pin'), dist = arg('dist'), out = arg('out');
if (!udid || !upstream || !dist || !out || !/^[a-f0-9]{40}$/u.test(pin ?? '')) throw new Error('Requires sim-lane and base/pin/dist/out');
const setup = path => `${saveFixtureCode({ scope: 'device', key: 'devMode', data: true })};${saveFixtureCode({ scope: 'device', key: 'debug.global.legacyShardButtons', data: path === 'legacy' ? 'on' : 'off' })};${saveFixtureCode({ scope: 'global', key: 'settings', data: { volume: 0 }, merge: true })};setTimeout(() => location.replace('/'), 100); true`;
let transport, base;
const version = await (await fetch(new URL('/version.json', upstream))).json();
if (!version.build?.startsWith(pin.slice(0, 7)) || JSON.parse(readFileSync(resolvePath(dist, 'version.json'), 'utf8')).build !== version.build) throw new Error('HTTP/disk pin mismatch');
mkdirSync(out, { recursive: true });
const socket = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
async function freePort() {
  const server = createServer();
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No inspector port');
  await new Promise(resolve => { server.close(resolve); });
  return address.port;
}
const listPort = await freePort(), pagePort = await freePort();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', `null:${listPort},:${pagePort}-${pagePort + 8}`], { stdio: ['ignore', 'ignore', 'pipe'] });
const proxyErrors = []; proxy.stderr.on('data', value => { proxyErrors.push(String(value)); });
let inspector, selectedPageId;
async function connect(expectedUrl) {
  inspector?.close(); inspector = undefined;
  let lastProtocolError = '';
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (let port = pagePort; port <= pagePort + 8; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = expectedUrl === undefined
          ? pages.find(row => row.id === selectedPageId && row.url?.startsWith(base))
            ?? pages.findLast(row => row.url?.startsWith(base))
          : pages.findLast(row => row.url === expectedUrl);
        if (page) selectedPageId = page.id;
        if (page) {
          inspector = soakInspector(page.webSocketDebuggerUrl); await inspector.opened;
          // Target.targetCreated follows the socket handshake. Sending a bare
          // Runtime command first races the page target on current Safari.
          await sleep(600);
          await inspector.evaluate('performance.now()'); return;
        }
      } catch (error) { lastProtocolError = String(error); inspector?.close(); inspector = undefined; }
    }
    await sleep(300);
  }
  throw new Error(`Safari Inspector did not connect: ${lastProtocolError}`);
}
async function wait(expression, timeout = 300000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let raw;
    try { raw = await inspector.evaluate(`JSON.stringify({ ready: !!(${expression}), fatal: document.querySelector('#wserr .msg')?.textContent ?? '', errors: window.__loadingAccuracy?.errors ?? [] })`); }
    catch { await connect(); await sleep(200); continue; }
    const state = JSON.parse(raw);
    if (state.fatal || state.errors.length > 0) throw new Error(`Safari application error: ${state.fatal.length > 0 ? state.fatal : state.errors.join('; ')}`);
    if (state.ready) return;
    await sleep(200);
  }
  throw new Error(`Safari timeout: ${expression}`);
}
async function gesture(expression) {
  const result = await inspector.send('Runtime.evaluate', { expression, returnByValue: true, emulateUserGesture: true });
  if (result.wasThrown) throw new Error(result.result?.description ?? 'Gesture failed');
}
const visits = arg('visits') ?? 'cold';
if (!['cold', 'cold,warm'].includes(visits)) throw new Error('Visits must be cold or cold,warm');
let failed = false;
try {
  for (const path of (arg('paths') ?? 'shardfile,grid').split(',')) {
    if (!['shardfile', 'grid', 'legacy'].includes(path)) throw new Error('Unsupported load path');
    transport = await observeTransport(upstream, { recorder: accuracyRecorder });
    base = transport.base;
    // Reuse this origin for warm disk caches, but launch Safari before every navigation.
    for (const visit of visits.split(',')) {
      const directory = visits === 'cold' ? out : resolvePath(out, path, visit);
      mkdirSync(directory, { recursive: true });
      execFileSync('xcrun', ['simctl', 'launch', udid, 'com.apple.mobilesafari'], { stdio: 'ignore', timeout: 60000 });
      const events = [], errors = [];
      let collected, networkBytes = null, report;
      try {
        const initialURL = new URL('/', base).href;
        execFileSync('xcrun', ['simctl', 'openurl', udid, initialURL]);
        await connect(initialURL);
        const previousOrigin = await inspector.evaluate('performance.timeOrigin');
        // A controlled navigation would cache a fixture document as the app shell.
        // Inspect the real title too: navigating to JSON would replace the cached shell.
        // Set the same save fixtures on this origin, then reload the real title.
        await inspector.evaluate(setup(path));
        await sleep(500); await connect();
        await wait(`performance.timeOrigin !== ${previousOrigin} && window.__loadingAccuracy !== undefined && document.querySelector('.ws-main-select') !== null`, 60000);
        if (path === 'grid') await gesture(`document.querySelector('.ws-main-grid').click()`);
        else {
          await gesture(`document.querySelector('.ws-main-select').click()`);
          await wait(`document.querySelectorAll('.ws-menu-card').length > 0`, 30000);
          const titles = JSON.parse(await inspector.evaluate(`JSON.stringify([...document.querySelectorAll('.ws-menu-card b')].map(el => el.textContent))`));
          const index = loadingCardIndex(titles, 'driftwood-isle');
          await gesture(`document.querySelector('.ws-menu-dots i[data-i="${index}"]').click()`);
          await gesture(`(() => { const explicit = document.querySelector('.ws-menu-shardfile'); (${path !== 'legacy'} && explicit && explicit.getClientRects().length ? explicit : document.querySelector('.ws-menu-play')).click(); })()`);
        }
        await sleep(500); await connect();
        await inspector.send('Network.enable');
        const off = inspector.on('Network.loadingFinished', event => { events.push(event); });
        try { await wait(`window.__loadingAccuracy?.readyAt > 0`); } finally { off(); }
      } catch (error) { errors.push(String(error)); }
      try {
        collected = JSON.parse(await inspector.evaluate(`JSON.stringify({ accuracy: window.__loadingAccuracy, origin: performance.timeOrigin, href: location.href, resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()), controller: navigator.serviceWorker.controller?.scriptURL ?? null, fatal: document.querySelector('#wserr .msg')?.textContent ?? '' })`));
        const origin = collected.origin, end = origin + (collected.accuracy?.readyAt ?? 0);
        const received = transport.receipts.filter(receipt => receipt.endedAt >= origin && receipt.endedAt <= end);
        networkBytes = received.reduce((sum, receipt) => sum + receipt.bodyBytes + receipt.headerBytes, 0);
        report = accuracyReport(collected.accuracy, networkBytes, path);
        errors.push(...(collected.accuracy?.errors ?? []));
        if (collected.fatal) errors.push(collected.fatal);
        if (collected.controller === null) errors.push('Service worker did not control the served entry');
      } catch (error) { errors.push(String(error)); }
      const result = { pin, path, visit, device: 'iOS Simulator Safari / portrait phone tier', cpu: 'native', errors,
        ...report, ...collected, protocolReceipts: events, transportReceipts: transport.receipts, htmlFixtures: transport.htmlFixtures };
      try {
        if (errors.length === 0) {
          await wait(`document.querySelector('.ws-load') === null && window.__wildshard?.world?.game.renderer !== undefined`, 10000);
          const frame = await inspector.evaluate('window.__wildshard.world.game.renderer.info.render.frame');
          await wait(`window.__wildshard.world.game.renderer.info.render.frame > ${frame}`, 10000);
        }
        const caption = `${pin.slice(0, 7)} · ${collected?.accuracy?.final?.path ?? `${path} request`} · iPhone 16 Pro · Simulator`;
        await inspector.evaluate(`(${accuracyCaption.toString()})(${JSON.stringify(caption)})`);
      } catch (error) { errors.push(`Capture caption: ${String(error)}`); }
      writeFileSync(resolvePath(directory, `${path}.json`), JSON.stringify(result, null, 2));
      execFileSync('xcrun', ['simctl', 'io', udid, 'screenshot', resolvePath(directory, `${path}.png`)], { stdio: 'ignore' });
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', '1000', resolvePath(directory, `${path}.png`), '--out', resolvePath(directory, `${path}.jpg`)], { stdio: 'ignore' });
      unlinkSync(resolvePath(directory, `${path}.png`));
      console.info(JSON.stringify({ path, visit, errors, ...report }));
      if (path === 'grid' && errors.length === 0 && (arg('crossing') ?? '1') === '1') {
        await inspector.evaluate(crossingProbeCode());
        await wait('window.__loadingCrossing?.done', 130000);
        const crossing = JSON.parse(await inspector.evaluate('JSON.stringify(window.__loadingCrossing)'));
        const crossingResult = crossingReport(crossing);
        const receipts = transport.receipts.filter(row => row.endedAt >= collected.origin + crossing.startedAt
          && row.endedAt <= collected.origin + crossing.endedAt);
        writeFileSync(resolvePath(directory, 'crossing.json'), JSON.stringify({ pin, device: result.device, cpu: 'native',
          ...crossing, ...crossingResult, transportReceipts: receipts,
          networkBytes: receipts.reduce((sum, row) => sum + row.bodyBytes + row.headerBytes, 0) }, null, 2));
        console.info(JSON.stringify({ path: 'crossing', ...crossingResult }));
        if (crossingResult.failures.length > 0) failed = true;
      }
      try { await inspector?.evaluate(`location.replace('about:blank')`); } catch { /* The target already left. */ }
      inspector?.close(); inspector = undefined;
      try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Already closed. */ }
      if (errors.length > 0 || (arg('accept') === '1' && (report?.failures.length ?? 0) > 0)) failed = true;
    }
    await transport.close(); transport = undefined;
  }
} finally {
  try { await inspector?.evaluate(`location.replace('about:blank')`); } catch { /* Unloaded target. */ }
  inspector?.close(); proxy.kill('SIGTERM');
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Already closed. */ }
  await transport?.close();
  writeFileSync(resolvePath(out, 'proxy.log'), proxyErrors.join(''));
}

if (failed) throw new Error('Safari capture failed; see per-path receipts');
