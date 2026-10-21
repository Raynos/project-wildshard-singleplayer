#!/usr/bin/env node
// G543: exact-build loading receipts, through real title entry on a muted phone browser.
// scripts/browser-lane.sh --max 15 node scripts/loading-benchmark/accuracy.mjs --base=URL --pin=SHA --out=DIR
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../debug-settings.mjs';
import { observeTransport } from './transport.mjs';
import { accuracyReport } from './accuracy-report.mjs';
import { accuracyRecorder, accuracyCaption } from './accuracy-data.mjs';
import { loadingCardIndex } from './catalogue.mjs';

const arg = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = arg('base', ''), pin = arg('pin', ''), out = arg('out', '');
if (!base || !/^[a-f0-9]{40}$/u.test(pin) || !out) throw new Error('Requires --base, full --pin and --out');
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served SHA differs');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const desktop = arg('surface', 'phone') === 'desktop';
const cpu = desktop ? 1 : 4;
let failed = false;
try {
  for (const path of arg('paths', 'shardfile,grid').split(',')) {
    if (path !== 'shardfile' && path !== 'grid') throw new Error('Unsupported load path');
    const transport = await observeTransport(base);
    const context = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : phone);
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await context.addInitScript(accuracyRecorder);
    const page = await context.newPage(), errors = [], requests = new Map();
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', event => {
      requests.set(event.requestId, { url: event.request.url, start: event.timestamp, wall: event.wallTime,
        bytes: 0, cache: false, ended: 0 });
    });
    cdp.on('Network.requestServedFromCache', event => {
      const request = requests.get(event.requestId); if (request) request.cache = true;
    });
    cdp.on('Network.responseReceived', event => {
      const request = requests.get(event.requestId);
      if (request && (event.response.fromDiskCache || event.response.fromPrefetchCache)) request.cache = true;
    });
    cdp.on('Network.loadingFinished', event => {
      const request = requests.get(event.requestId);
      if (request) { request.bytes = event.encodedDataLength; request.ended = request.wall + event.timestamp - request.start; }
    });
    let status = 'passed';
    try {
      await page.goto(transport.base, { waitUntil: 'load' });
      if (arg('profile', '0') === '1') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      if (path === 'grid') await page.locator('.ws-main-grid').click();
      else {
        await page.locator('.ws-main-select').click();
        const titles = await page.locator('.ws-menu-card b').allTextContents();
        const index = loadingCardIndex(titles, 'driftwood-isle');
        await page.locator(`.ws-menu-dots i[data-i="${index}"]`).click();
        const explicit = page.locator('.ws-menu-shardfile');
        await (await explicit.isVisible() ? explicit : page.locator('.ws-menu-play')).click();
      }
      await page.waitForFunction(() => Reflect.get(window, '__loadingAccuracy')?.readyAt > 0,
        undefined, { timeout: 240_000 });
    } catch (error) { status = 'failed'; errors.push(String(error)); }
    const collected = await page.evaluate(() => ({ accuracy: Reflect.get(window, '__loadingAccuracy'),
      origin: performance.timeOrigin, now: performance.now(),
      resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      fatal: document.querySelector('#wserr .msg')?.textContent ?? '' }));
    const ready = collected.accuracy.readyAt > 0 ? collected.accuracy.readyAt : collected.now;
    const network = [...requests.values()].filter(request => request.ended * 1000 >= collected.origin
      && request.ended * 1000 <= collected.origin + ready && !request.cache);
    const cdpNetworkBytes = network.reduce((sum, request) => sum + request.bytes, 0);
    const received = transport.receipts.filter(receipt => receipt.endedAt >= collected.origin && receipt.endedAt <= collected.origin + ready);
    const networkBytes = received.reduce((sum, receipt) => sum + receipt.bodyBytes + receipt.headerBytes, 0);
    const report = accuracyReport(collected.accuracy, networkBytes, path);
    if (arg('profile', '0') === '1') writeFileSync(resolve(out, `${path}.cpuprofile`), JSON.stringify((await cdp.send('Profiler.stop')).profile));
    if (collected.fatal) errors.push(collected.fatal);
    if (collected.controller === null) errors.push('Service worker did not control the served entry');
    if (errors.length > 0) status = 'failed';
    const receipt = { pin, path, device: desktop ? 'Desktop Chromium' : 'iPhone 16 Pro', cpu, status, errors, cdpNetworkBytes, transportReceipts: received, ...report, ...collected };
    writeFileSync(resolve(out, `${path}.json`), JSON.stringify(receipt, null, 2));
    console.info(JSON.stringify({ path, status, networkBytes, displayedNetworkBytes: receipt.displayedNetworkBytes,
      stageSeconds: receipt.stageSeconds, clockSeconds: receipt.clockSeconds, unaccountedSeconds: receipt.unaccountedSeconds, maxDetailGapMs: receipt.maxDetailGapMs, errors }));
    if (status === 'passed') {
      const frame = await page.evaluate(() => window.__wildshard?.world?.game.renderer.info.render.frame ?? -1);
      await page.locator('.ws-load').waitFor({ state: 'detached', timeout: 10_000 });
      await page.waitForFunction(previous => (window.__wildshard?.world?.game.renderer.info.render.frame ?? -1) > previous,
        frame, { timeout: 10_000 });
    }
    if (!desktop) {
      await page.evaluate(accuracyCaption, `${pin.slice(0, 7)} · ${collected.accuracy.final?.path ?? `${path} request`} · iPhone 16 Pro · CPU ${cpu}x`);
      await page.screenshot({ path: resolve(out, `${path}-${status === 'passed' ? 'first-frame' : 'stalled'}.jpg`), type: 'jpeg', quality: 75, scale: 'css' });
    }
    await context.close(); await transport.close();
    if (status !== 'passed' || (arg('accept', '0') === '1' && report.failures.length > 0)) failed = true;
  }
} finally { await browser.close(); }
if (failed) throw new Error('Loading capture failed; see per-path receipts');
