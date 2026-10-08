#!/usr/bin/env node
// SF66: the minimap and the full MAP draw each shard's baked map (and the grid's full map lays out every cell's), proven
// in a real browser: Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on.
//
//   scripts/serve-build.sh --head --name sf66-draw         → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/sf66/capture-draw.mjs --url=http://127.0.0.1:<port>
//
// Per standalone shard (Driftwood, Sky Reach, Signal Dunes): the play view with its minimap (<slug>-play.jpg) and the MAP
// tab (<slug>-map.jpg); then INFINITE WILDSHARD inside the home cell near its east road and its MAP (grid-*.jpg). Writes
// capture-draw.json (the memory readout at each pose, page errors).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6).replace(/\/$/u, '');
if (url === '') { console.error('usage: capture-draw.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '74', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const memory = (page) => page.evaluate(() => { try { const m = window.__wildshard?.memory?.(); return m === undefined ? null : JSON.parse(JSON.stringify(m)); } catch { return null; } });
const out = { url, started: new Date().toISOString(), shards: {} };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const slug of ['driftwood-isle', 'far-reach', 'sunscar-dunes']) {
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, serviceWorkers: 'block' });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
    const fetched = []; page.on('response', (r) => { if (r.url().includes('/map/top.webp')) fetched.push({ url: r.url().replace(url, ''), status: r.status() }); });
    await page.goto(`${url}/?chunk=${slug}&mute=1&skipintro=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), null, { timeout: 180000, polling: 250 });
    await sleep(5000);
    const play = await memory(page);
    toJpeg(await page.screenshot(), `${slug}-play.jpg`);
    await page.keyboard.press('m'); await sleep(2500);
    toJpeg(await page.screenshot(), `${slug}-map.jpg`);
    out.shards[slug] = { errors, fetched, memoryPlay: play, memoryMap: await memory(page) };
    console.log(slug, JSON.stringify({ errors, fetched }));
    await ctx.close();
  }
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, serviceWorkers: 'block' });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  const fetched = []; page.on('response', (r) => { if (r.url().includes('/map/top.webp')) fetched.push({ url: r.url().replace(url, ''), status: r.status() }); });
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(1200);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await sleep(800); await page.mouse.click(200, 400); // skip the reveal
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  const pose = async (p, name) => {
    await page.evaluate((q) => window.__wildshard.pose({ name: 'grid', ...q }), p); await sleep(4000);
    toJpeg(await page.screenshot(), `${name}.jpg`);
  };
  out.grid = { memoryPier: await memory(page) };
  await pose({ x: 215, y: 3, z: 40, yaw: -Math.PI / 2, pitch: -0.05 }, 'grid-inside-play');
  await pose({ x: 277.5, y: 2, z: 40, yaw: 0, pitch: -0.05 }, 'grid-road-play');
  out.grid.memoryRoad = await memory(page);
  await page.keyboard.press('m'); await sleep(3500);
  toJpeg(await page.screenshot(), 'grid-map.jpg');
  out.grid.memoryMap = await memory(page);
  out.grid.errors = errors; out.grid.fetched = fetched;
  console.log('grid', JSON.stringify({ errors, fetched }));
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'capture-draw.json'), `${JSON.stringify(out, null, 2)}\n`);
}
