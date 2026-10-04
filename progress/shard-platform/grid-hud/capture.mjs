#!/usr/bin/env node
// The grid's player-facing moments (SHARD-PLATFORM SF21a / SF20a / SF20d; G98, G78, G82 / G105, G97), proven in a real
// browser: Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on.
//
//   scripts/serve-build.sh --name grid-hud                → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/grid-hud/capture.mjs --url=http://127.0.0.1:<port>
//
// Taps INFINITE WILDSHARD and records the sky-down reveal (reveal.mp4, three stills reveal-<n>.jpg, the landing pier.jpg)
// with its readout (`window.__wsReveal`); then stands on the road (safe.jpg: SAFE ZONE + dimmed ATTACK), walks back into
// Driftwood's cell (title.jpg: the centred title card) and rides the hoverboard down the road (speed.jpg: the wider FOV and
// edge lines). Writes capture.json beside the images.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
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
const video = join(OUT, '.video'); rmSync(video, { recursive: true, force: true });
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, recordVideo: { dir: video, size: PHONE.screen } });
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
  const t0 = Date.now();
  for (const [i, at] of [[1, 1200], [2, 3600], [3, 5600]]) { await sleep(Math.max(0, at - (Date.now() - t0))); toJpeg(await page.screenshot(), `reveal-${i}.jpg`); }
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  out.reveal = { shownMs: Date.now() - t0, readout: await page.evaluate(() => window.__wsReveal ?? null) };
  console.log('reveal', JSON.stringify(out.reveal));
  await sleep(1200);
  toJpeg(await page.screenshot(), 'pier.jpg');
  const hud = () => page.evaluate(() => ({ hud: window.__wildshard.shard.gridHud?.state() ?? null, inside: window.__wildshard.shard.grid.state().inside,
    stowed: window.__wildshard.shard.grid.state().live?.stowed ?? null, frame: window.__wildshard.shard.grid.state().live?.live?.current ?? null }));
  out.pier = await hud();
  // G78: on the road between Driftwood and its east neighbour, looking along it
  await page.evaluate(() => window.__wildshard.pose({ name: 'grid', x: 277.5, y: 2, z: 40, yaw: 0, pitch: -0.05 }));
  await sleep(2500);
  out.safe = await hud();
  toJpeg(await page.screenshot(), 'safe.jpg');
  console.log('safe', JSON.stringify(out.safe));
  // G82 / G105: back into Driftwood's cell from the road
  await page.evaluate(() => window.__wildshard.pose({ name: 'grid', x: 200, y: 6, z: 40, yaw: Math.PI / 2, pitch: -0.05 }));
  await sleep(700);
  out.title = await hud();
  toJpeg(await page.screenshot(), 'title.jpg');
  console.log('title', JSON.stringify(out.title));
  await sleep(3500);
  // G97: the hoverboard down the road at the deck's 30 m/s
  await page.evaluate(() => window.__wildshard.pose({ name: 'grid', x: 277.5, y: 2, z: 150, yaw: 0, pitch: -0.03 }));
  await sleep(1500);
  await page.evaluate(() => { window.__wildshard.world.player.setHover(true); });
  await page.keyboard.down('KeyW');
  let speed = { hud: null, v: 0 };
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    speed = await page.evaluate(() => { const v = window.__wildshard.world.player.velocity; return { v: Math.hypot(v.x, v.z), hud: window.__wildshard.shard.gridHud?.state() ?? null }; });
    if (speed.hud !== null && speed.hud.speed >= 0.9) break;
  }
  toJpeg(await page.screenshot(), 'speed.jpg');
  await page.keyboard.up('KeyW');
  out.speed = speed;
  console.log('speed', JSON.stringify(out.speed));
  await ctx.close();
  const [file] = readdirSync(video).filter((f) => f.endsWith('.webm'));
  if (file !== undefined) {
    // the reveal only: from its first frame to a beat after the landing (the title and the boot are cut)
    const from = Math.max(0, (t0 - ctxStart - 400) / 1000), len = (out.reveal.shownMs + 1800) / 1000;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-t', len.toFixed(2), '-i', join(video, file), '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-pix_fmt', 'yuv420p', join(OUT, 'reveal.mp4')]);
  }
} finally {
  rmSync(video, { recursive: true, force: true });
  writeFileSync(join(OUT, 'capture.json'), `${JSON.stringify(out, null, 2)}\n`);
  await browser.close();
}
