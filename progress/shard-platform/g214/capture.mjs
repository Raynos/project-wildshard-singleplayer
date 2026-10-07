#!/usr/bin/env node
// SF60 / G214 (Jake: B, a slim banner under the logo): the main menu's WHAT'S NEW banner in a real browser
// (iPhone 16 Pro portrait, muted).
//
//   scripts/serve-build.sh --head --name g214                                   # → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/g214/capture.mjs --url=http://127.0.0.1:<port>
//
// Developer on: `folded.jpg` (one line under the logo), `expanded.jpg` (tapped open), `hidden.jpg` (HIDE UNTIL NEXT
// BUILD), then a reload of the same build stays hidden. Developer off: no banner. banner.json records the text and that
// the banner never overlaps the logo, the two cards or SETTINGS.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_ = flag('url');
if (URL_ === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const layout = (page) => page.evaluate(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
  const boxes = { banner: box('.ws-whatsnew'), logo: box('.ws-main-logo'), cards: box('.ws-main-cards'), settings: box('.ws-main-settings') };
  const overlap = (a, b) => a !== null && b !== null && a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;
  return { ...boxes, overlaps: ['logo', 'cards', 'settings'].filter((k) => overlap(boxes.banner, boxes[k])),
    title: document.querySelector('.ws-whatsnew-title')?.textContent ?? null,
    line: document.querySelector('.ws-whatsnew-line')?.textContent ?? null,
    entries: [...document.querySelectorAll('.ws-whatsnew-list li')].map((li) => li.textContent),
    expanded: document.querySelector('.ws-whatsnew-head')?.getAttribute('aria-expanded') ?? null };
});

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = {};
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-whatsnew', { timeout: 120000 });
  await sleep(1500);
  results.folded = await layout(page);
  toJpeg(await page.screenshot(), join(OUT, 'folded.jpg'));
  await page.click('.ws-whatsnew-head');
  await sleep(500);
  results.expanded = await layout(page);
  toJpeg(await page.screenshot(), join(OUT, 'expanded.jpg'));
  await page.click('.ws-whatsnew-hide');
  await sleep(500);
  results.hidden = await layout(page);
  toJpeg(await page.screenshot(), join(OUT, 'hidden.jpg'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-card', { timeout: 120000 });
  await sleep(1200);
  results.reloadSameBuild = { banner: await page.$('.ws-whatsnew') !== null };
  await ctx.close();

  const off = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(off, { scope: 'device', key: 'devMode', data: false });
  const offPage = await off.newPage();
  await offPage.goto(URL_, { waitUntil: 'domcontentloaded' });
  await offPage.waitForSelector('.ws-main-card', { timeout: 120000 });
  await sleep(1200);
  results.developerOff = { banner: await offPage.$('.ws-whatsnew') !== null };
  await off.close();
  console.log(JSON.stringify(results, null, 2));
} finally {
  writeFileSync(join(OUT, 'banner.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
