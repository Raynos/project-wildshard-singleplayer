// scripts/sim-lane.sh run --max 20 wildshard-loading node scripts/loading-benchmark/accuracy-safari.mjs --base=URL --pin=SHA --dist=DIR --out=DIR
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { observeTransport } from './transport.mjs';
import { soakInspector } from '../soak/inspector.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';
import { accuracyRecorder } from './accuracy-data.mjs';
import { accuracyReport } from './accuracy-report.mjs';
import { loadingCardIndex } from './catalogue.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const udid = process.env.SIM_UDID, upstream = arg('base'), pin = arg('pin'), dist = arg('dist'), out = arg('out');
if (!udid || !upstream || !dist || !out || !/^[a-f0-9]{40}$/u.test(pin ?? '')) throw new Error('Requires sim-lane and base/pin/dist/out');
const start = `<!doctype html><script>${saveFixtureCode({ scope: 'device', key: 'devMode', data: true })};${saveFixtureCode({ scope: 'global', key: 'settings', data: { volume: 0 }, merge: true })};location.replace('/');</script>`;
const transport = await observeTransport(upstream, { recorder: accuracyRecorder, start }), base = transport.base;
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7)) || JSON.parse(readFileSync(resolve(dist, 'version.json'), 'utf8')).build !== version.build) throw new Error('HTTP/disk pin mismatch');
mkdirSync(out, { recursive: true });
const socket = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240'], { stdio: ['ignore', 'ignore', 'pipe'] });
const proxyErrors = []; proxy.stderr.on('data', value => proxyErrors.push(String(value)));
let inspector;
async function connect() {
  inspector?.close(); inspector = undefined;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = pages.find(row => row.url?.startsWith(base));
        if (page) {
          inspector = soakInspector(page.webSocketDebuggerUrl); await inspector.opened;
          await inspector.evaluate('performance.now()'); return;
        }
      } catch { inspector?.close(); inspector = undefined; }
    }
    await sleep(300);
  }
  throw new Error('Safari Inspector did not connect');
}
async function wait(expression) {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    try { if (await inspector.evaluate(expression)) return; }
    catch { await connect(); }
    await sleep(200);
  }
  throw new Error(`Safari timeout: ${expression}`);
}
async function gesture(expression) {
  const result = await inspector.send('Runtime.evaluate', { expression, returnByValue: true, emulateUserGesture: true });
  if (result.wasThrown) throw new Error(result.result?.description ?? 'Gesture failed');
}
let failed = false;
try {
  for (const path of (arg('paths') ?? 'shardfile,grid').split(',')) {
    const events = [], errors = [];
    let collected, networkBytes = null, report;
    try {
      execFileSync('xcrun', ['simctl', 'openurl', udid, new URL('/version.json', base).href]);
      await connect();
      await inspector.evaluate(`setTimeout(() => location.replace('/sf67-start.html'), 100); true`);
      await sleep(500); await connect();
      await wait(`document.querySelector('.ws-main-select') !== null`);
      if (path === 'grid') await gesture(`document.querySelector('.ws-main-grid').click()`);
      else {
        await gesture(`document.querySelector('.ws-main-select').click()`);
        await wait(`document.querySelectorAll('.ws-menu-card').length > 0`);
        const titles = JSON.parse(await inspector.evaluate(`JSON.stringify([...document.querySelectorAll('.ws-menu-card b')].map(el => el.textContent))`));
        const index = loadingCardIndex(titles, 'driftwood-isle');
        await gesture(`document.querySelector('.ws-menu-dots i[data-i="${index}"]').click()`);
        await gesture(`(() => { const explicit = document.querySelector('.ws-menu-shardfile'); (explicit && explicit.getClientRects().length ? explicit : document.querySelector('.ws-menu-play')).click(); })()`);
      }
      await sleep(500); await connect();
      await inspector.send('Network.enable');
      const off = inspector.on('Network.loadingFinished', event => events.push(event));
      try { await wait(`window.__loadingAccuracy?.readyAt > 0`); } finally { off(); }
    } catch (error) { errors.push(String(error)); }
    try {
      collected = JSON.parse(await inspector.evaluate(`JSON.stringify({ accuracy: window.__loadingAccuracy, origin: performance.timeOrigin, href: location.href, resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()), fatal: document.querySelector('#wserr .msg')?.textContent ?? '' })`));
      const origin = collected.origin, end = origin + (collected.accuracy?.readyAt ?? 0);
      const received = transport.receipts.filter(receipt => receipt.endedAt >= origin && receipt.endedAt <= end);
      networkBytes = received.reduce((sum, receipt) => sum + receipt.bodyBytes + receipt.headerBytes, 0);
      report = accuracyReport(collected.accuracy, networkBytes);
      errors.push(...(collected.accuracy?.errors ?? []));
      if (collected.fatal) errors.push(collected.fatal);
    } catch (error) { errors.push(String(error)); }
    const result = { pin, path, device: 'iOS Simulator Safari / portrait phone tier', cpu: 'native', errors,
      ...report, ...collected, protocolReceipts: events, transportReceipts: transport.receipts, htmlFixtures: transport.htmlFixtures };
    writeFileSync(resolve(out, `${path}.json`), JSON.stringify(result, null, 2));
    execFileSync('xcrun', ['simctl', 'io', udid, 'screenshot', resolve(out, `${path}.png`)], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', '1000', resolve(out, `${path}.png`), '--out', resolve(out, `${path}.jpg`)], { stdio: 'ignore' });
    unlinkSync(resolve(out, `${path}.png`));
    console.info(JSON.stringify({ path, errors, ...report }));
    if (errors.length > 0 || (arg('accept') === '1' && (report?.failures.length ?? 0) > 0)) failed = true;
  }
} finally {
  try { await inspector?.evaluate(`location.replace('about:blank')`); } catch { /* Unloaded target. */ }
  inspector?.close(); proxy.kill('SIGTERM');
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Already closed. */ }
  await transport.close();
  writeFileSync(resolve(out, 'proxy.log'), proxyErrors.join(''));
}

if (failed) throw new Error('Safari capture failed; see per-path receipts');
