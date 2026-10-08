#!/usr/bin/env node
// G222 / SF17b (agent playtest round 1, item 4): the 60-100 m grey seam cliffs at the grid's road edges, before / after,
// from the playtest's own spots (home-relative: the boulevard at (±150..240, −280), the x = −279 road looking north).
// Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on (the Developer catalogue).
//
//   scripts/serve-build.sh --rev <sha> --name seams-<label>          → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh node progress/shard-platform/playtest-1/seams/capture.mjs --url=http://127.0.0.1:<port> --label=<before|after>
//
// Writes <label>-<shot>.jpg and <label>.json beside this script (the poses, console errors, the edge-fallback warning).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3);
const url = arg('url'), label = arg('label');
if (url === '' || label === '') { console.error('usage: capture.mjs --url=<build> --label=<before|after>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, label, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text().slice(0, 240)); });
  out.errors = errors;
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(1200);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await sleep(800); await page.mouse.click(200, 400); // skip the reveal
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  const grid = await page.evaluate(() => window.__wildshard.shard.grid.state());
  out.home = grid.home; out.cells = grid.cells.map((c) => `${c.slug}@${c.cell.join(',')}`);
  const shot = async (name, p, wait = 4500) => {
    await page.evaluate((q) => window.__wildshard.pose({ name: 'grid', ...q }), p);
    await sleep(wait);
    out[name] = { pose: p };
    toJpeg(await page.screenshot(), `${label}-${name}.jpg`);
  };
  const at = (x, z, y, yaw, pitch) => ({ x, y, z, yaw, pitch });
  await shot('1-sw-corner-west', at(-150, -280, 2, Math.PI / 2, 0.05), 7000);
  await shot('2-se-corner-east', at(150, -280, 2, -Math.PI / 2, 0.05));
  await shot('3-se-corner-close', at(240, -280, 2, -Math.PI / 2, 0.15));
  await shot('4-x279-north', at(-279, -150, 2, Math.PI, 0.05));
  await shot('5-pine-north', at(-279, 400, 2, Math.PI, 0.05));
  await shot('6-x277-nalati-west', at(277.5, -150, 2, Math.PI, 0.1));
  out.edgeFallback = warnings.filter((w) => /edges stay at road level|keeps road-level edges/u.test(w));
  out.warnings = warnings.filter((w) => !/THREE\./u.test(w)).slice(0, 20);
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(OUT, `${label}.json`), `${JSON.stringify(out, null, 2)}\n`);
}
