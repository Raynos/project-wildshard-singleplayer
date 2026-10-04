#!/usr/bin/env node
// Grid UI part 2 (SHARD-PLATFORM SF28 / SF20a; G107 minimap blend, G78 border shimmer, G104 accent swap, G119 save
// status), proven in a real browser: Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on.
//
//   scripts/serve-build.sh --name grid-hud2               → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/grid-hud/capture2.mjs --url=http://127.0.0.1:<port>
//
// Taps INFINITE WILDSHARD, skips the reveal, then poses: inside the home cell near its east road (minimap-inside.jpg: the
// shard, the road, the neighbour's name; the HUD in the shard's accent), on the road (minimap-road.jpg: both neighbours
// faded, the HUD cyan), at the roundabout (minimap-roundabout.jpg), facing the border (shimmer.jpg), and crossing it with
// the page's storage refusing writes (saving.jpg: the G119 panel). Writes capture2.json beside the images.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '74', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const ctxStart = Date.now();
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); }); out.errors = errors;
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(1200);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await sleep(800); await page.mouse.click(200, 400); // skip the reveal
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  const hud = () => page.evaluate(() => ({ hud: window.__wildshard.shard.gridHud?.state() ?? null, inside: window.__wildshard.shard.grid.state().inside,
    stowed: window.__wildshard.shard.grid.state().live?.stowed ?? null, frame: window.__wildshard.shard.grid.state().live?.live?.current ?? null }));
  out.pier = await hud();
  const hud2 = () => page.evaluate(() => { const s = window.__wildshard.shard; const g = s.grid.state();
    return { inside: g.inside, accent: s.gridHud?.state().accent ?? null, minimap: s.gridHud?.minimap?.() ?? null, shimmer: g.shimmer, crossing: g.live?.crossing ?? null,
      cyan: getComputedStyle(document.getElementById('hud')).getPropertyValue('--ws-cyan').trim() }; });
  const shot = async (name, pose, wait = 2500) => {
    await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), pose);
    await sleep(wait);
    out[name] = await hud2(); console.log(name, JSON.stringify(out[name]));
    toJpeg(await page.screenshot(), `${name}.jpg`);
    const box = await page.evaluate(() => { const r = document.querySelector('.ws-minimap')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; });
    if (box !== null) { const jpg = join(OUT, `${name}-minimap.jpg`), tmp = `${jpg}.png`; writeFileSync(tmp, await page.screenshot({ clip: box })); execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', tmp, '--out', jpg], { stdio: 'ignore' }); rmSync(tmp, { force: true }); }
  };
  await shot('minimap-inside', { x: 215, y: 3, z: 40, yaw: -Math.PI / 2, pitch: -0.05 });
  await shot('minimap-road', { x: 277.5, y: 2, z: 40, yaw: 0, pitch: -0.05 });
  await shot('minimap-roundabout', { x: 277.5, y: 2, z: 277.5, yaw: Math.PI / 4, pitch: -0.05 });
  await shot('shimmer', { x: 236, y: 3, z: 0, yaw: -Math.PI / 2, pitch: -0.3 }, 4000);
  await shot('shimmer-road', { x: 266, y: 2, z: 0, yaw: Math.PI / 2, pitch: -0.3 }, 3000);
  // G119: storage refuses writes, then the traveller crosses the home border onto the strip: the crossing holds on its save
  await page.evaluate(() => { const set = Storage.prototype.setItem; window.__wsSetItem = set; Storage.prototype.setItem = function refuse() { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; });
  await shot('saving', { x: 246, y: 3, z: 12, yaw: -Math.PI / 2, pitch: -0.2 }, 300);
  const samples = [];
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.__wildshard.pose({ name: 'grid', x: 262, y: 2, z: 12, yaw: Math.PI / 2, pitch: -0.15 }));
    await sleep(250); samples.push(await hud2());
    if (i === 6) toJpeg(await page.screenshot(), 'save-failed.jpg');
  }
  out.saveSamples = samples.map((s) => ({ status: s.shimmer?.status ?? null, crossing: s.crossing }));
  await page.evaluate(() => { if (window.__wsSetItem) Storage.prototype.setItem = window.__wsSetItem; });
  await sleep(1500); out.afterRestore = await hud2();
  console.log('saveSamples', JSON.stringify(out.saveSamples), 'after', JSON.stringify(out.afterRestore.crossing));
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'capture2.json'), `${JSON.stringify(out, null, 2)}\n`);
}
