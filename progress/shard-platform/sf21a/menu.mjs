#!/usr/bin/env node
// SF21a (G79 / G88 / G98): the Wildshard main menu, proven in a real browser (iPhone 16 Pro portrait, muted).
//
//   scripts/serve-build.sh --name sf21a                    # → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/sf21a/menu.mjs --url=http://127.0.0.1:<port> [--reveal]
//
// For Settings ▸ Developer off and on it opens the cold title and saves `menu-dev-<off|on>.jpg` (the main menu) and
// `select-dev-<off|on>.jpg` (SHARD SELECT: today's deck), and records which cards show. With --reveal (Developer on) it
// taps INFINITE WILDSHARD and records the grid page's sky-down reveal as `reveal.mp4` (muted, ~540 px wide), with the
// reveal's own readout (when it started, when the rings and the home simulation were ready, when it ended) in menu.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_ = flag('url');
if (URL_ === '') { console.error('usage: menu.mjs --url=<build> [--reveal]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = {};
try {
  for (const dev of [false, true]) {
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: dev });
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-main-card', { timeout: 120000 });
    await sleep(1500);
    const tag = `dev-${dev ? 'on' : 'off'}`;
    const cards = await page.$$eval('.ws-main-card', (els) => els.map((el) => el.textContent.trim()));
    toJpeg(await page.screenshot(), join(OUT, `menu-${tag}.jpg`));
    await page.click('.ws-main-select');
    await sleep(900);
    const deck = await page.evaluate(() => ({ screen: document.querySelector('.ws-title-stack')?.dataset.screen, enter: document.querySelector('.ws-menu-play b')?.textContent, back: document.querySelector('.ws-menu-back')?.textContent }));
    toJpeg(await page.screenshot(), join(OUT, `select-${tag}.jpg`));
    results[tag] = { cards, deck };
    console.log(tag, JSON.stringify(results[tag]));
    await ctx.close();
  }
  if (argv.includes('--reveal')) {
    const tmp = join(OUT, '.video'); rmSync(tmp, { recursive: true, force: true });
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, recordVideo: { dir: tmp, size: PHONE.screen } });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
    await sleep(1200);
    await page.click('.ws-main-grid');
    await page.waitForFunction(() => document.querySelector('.ws-reveal') !== null, null, { timeout: 180000 });
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector('.ws-reveal') === null, null, { timeout: 120000 });
    const reveal = await page.evaluate(() => window.__wsReveal ?? null);
    await sleep(1500);
    results.reveal = { shownMs: Date.now() - t0, readout: reveal };
    console.log('reveal', JSON.stringify(results.reveal));
    await ctx.close();
    const [file] = readdirSync(tmp).filter((f) => f.endsWith('.webm'));
    if (file !== undefined) {
      const raw = join(tmp, file);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-pix_fmt', 'yuv420p', join(OUT, 'reveal.mp4')]);
    }
    rmSync(tmp, { recursive: true, force: true });
  }
} finally {
  writeFileSync(join(OUT, 'menu.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
