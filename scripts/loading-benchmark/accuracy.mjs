#!/usr/bin/env node
// G543: exact-build loading receipts, through real title entry on a muted phone browser.
// scripts/browser-lane.sh --max 15 node scripts/loading-benchmark/accuracy.mjs --base=URL --pin=SHA --out=DIR
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../debug-settings.mjs';
import { loadingCardIndex } from './catalogue.mjs';

const arg = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = arg('base', ''), pin = arg('pin', ''), out = arg('out', '');
if (!base || !/^[a-f0-9]{40}$/u.test(pin) || !out) throw new Error('Requires --base, full --pin and --out');
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served SHA differs');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
try {
  for (const path of arg('paths', 'shardfile,grid').split(',')) {
    if (path !== 'shardfile' && path !== 'grid') throw new Error('Unsupported load path');
    const context = await browser.newContext(phone);
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await context.addInitScript(() => {
      const state = { samples: [], final: null, readyAt: 0, last: '', updates: [] };
      Reflect.set(window, '__loadingAccuracy', state);
      const read = () => {
        const root = document.querySelector('.ws-load');
        if (!(root instanceof HTMLElement) || Object.hasOwn(root.dataset, 'shell') || state.readyAt) return;
        const now = performance.now();
        const text = key => root.querySelector(`[data-el="${key}"]`)?.textContent ?? '';
        const rows = [...root.querySelectorAll('[data-el="rows"] > div')].map(row => ({
          label: row.children.item(0)?.textContent ?? '', detail: row.children.item(1)?.textContent ?? '',
          duration: row.children.item(2)?.textContent ?? '', state: row.className,
        }));
        const sample = { at: now, clock: text('clock'), detail: text('suFact'), download: text('dlFact'),
          step: root.dataset.step, setup: root.dataset.setup,
          networkBytes: root.dataset.networkBytes, cachedBytes: root.dataset.cachedBytes,
          pendingBytes: root.dataset.pendingBytes, rows };
        const detailed = `${sample.detail}|${rows.map(row => `${row.detail}:${row.duration}`).join('|')}`;
        if (detailed !== state.last) { state.updates.push(now); state.last = detailed; }
        state.samples.push(sample); state.final = sample;
        if (root.classList.contains('hide')) state.readyAt = now;
      };
      setInterval(read, 250);
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          if (document.querySelector('.ws-load.hide')) read();
        }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
      });
    });
    const page = await context.newPage(), errors = [], requests = new Map();
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
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
      await page.goto(base, { waitUntil: 'load' });
      if (path === 'grid') await page.locator('.ws-main-grid').click();
      else {
        await page.locator('.ws-main-select').click();
        const titles = await page.locator('.ws-menu-card b').allTextContents();
        const index = loadingCardIndex(titles, 'driftwood-isle');
        await page.locator(`.ws-menu-dots i[data-i="${index}"]`).click();
        await page.locator('.ws-menu-shardfile').click();
      }
      await page.waitForFunction(() => Reflect.get(window, '__loadingAccuracy')?.readyAt > 0,
        undefined, { timeout: 240_000 });
    } catch (error) { status = 'failed'; errors.push(String(error)); }
    const collected = await page.evaluate(() => ({ accuracy: Reflect.get(window, '__loadingAccuracy'),
      origin: performance.timeOrigin, now: performance.now(),
      resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
      fatal: document.querySelector('#wserr .msg')?.textContent ?? '' }));
    const final = collected.accuracy.final, ready = collected.accuracy.readyAt > 0 ? collected.accuracy.readyAt : collected.now;
    const network = [...requests.values()].filter(request => request.ended * 1000 >= collected.origin
      && request.ended * 1000 <= collected.origin + ready && !request.cache);
    const networkBytes = network.reduce((sum, request) => sum + request.bytes, 0);
    const seconds = duration => {
      const value = Number.parseFloat(duration);
      return Number.isFinite(value) ? value * (/ms/u.test(duration) ? 0.001 : 1) : 0;
    };
    const stageSeconds = final?.rows.reduce((sum, row) => sum + seconds(row.duration), 0) ?? 0;
    const clockSeconds = final ? final.clock.split(':').reduce((minutes, value) => minutes * 60 + Number(value), 0) : 0;
    const updates = collected.accuracy.updates;
    const receipt = { pin, path, device: 'iPhone 16 Pro', cpu: 4, status, errors, networkBytes,
      displayedNetworkBytes: final?.networkBytes === null ? null : Number(final?.networkBytes),
      stageSeconds, clockSeconds, unaccountedSeconds: clockSeconds - stageSeconds,
      maxDetailGapMs: Math.max(0, ...updates.slice(1).map((at, index) => at - updates[index])), ...collected };
    writeFileSync(resolve(out, `${path}.json`), JSON.stringify(receipt, null, 2));
    console.info(JSON.stringify({ path, status, networkBytes, displayedNetworkBytes: receipt.displayedNetworkBytes,
      stageSeconds, clockSeconds, unaccountedSeconds: receipt.unaccountedSeconds, maxDetailGapMs: receipt.maxDetailGapMs, errors }));
    await context.close();
    if (status !== 'passed') throw new Error(`${path} did not reach first frame`);
  }
} finally { await browser.close(); }
