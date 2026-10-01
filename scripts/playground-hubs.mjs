#!/usr/bin/env node
import { saveFixture } from './debug-settings.mjs';
// playground-hubs.mjs — E307: the Explore hub on all four shards, and that each shard still boots and plays.
//
// Per shard (iPhone-16-Pro portrait, touch, phone tier, Developer mode): boot to the title → EXPLORE WORLD (a tap) → the
// hub's cards and sections, no sideways scroll, a JPEG → ✕ back to the title → ENTER WORLD (a tap) → the MOVE stick held
// forward 2 s (a real touch drag): the player walked, frames ticked, no page errors. Then, on a short phone (402 × 480, so
// the list overflows), a real swipe up the hub list must scroll it to its end. Exit 1 on any failure.
//
// Expected lists (src/engine/practice/playground/catalog.ts): Driftwood Isle and Pine Hollow — the shared three only; Nine Dragon — + the
// grapple playground; Nalati — + the horse playground.
//
//   scripts/browser-lane.sh node scripts/playground-hubs.mjs --url=http://127.0.0.1:4405 [--out=…] [--only=pine-hollow,…]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { bootToTitle, flags, openHub, phonePage, sleep, tap, VITE_STUB } from './playground-harness.mjs';

const { chromium } = await import('playwright');
const flag = flags();
const BASE = flag('url', 'http://127.0.0.1:4405');
const OUT = resolvePath(flag('out', 'progress/e307-playgrounds'));
const SHARED = ['Model explorer', 'World explorer', 'Practice arena'];
const EXPECT = { 'driftwood-isle': [], 'pine-hollow': [], 'nine-dragon-stack': ['Grapple playground'], 'nalati-grasslands': ['Horse playground'] };
const ONLY = flag('only', Object.keys(EXPECT).join(',')).split(',');
mkdirSync(OUT, { recursive: true });

/** @type {Record<string, unknown>[]} */
const rows = [];
let ok = true;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const slug of ONLY) {
    const want = [...SHARED, ...(EXPECT[slug] ?? [])];
    /** @type {Record<string, unknown>} */
    const row = { slug };
    rows.push(row);
    const page = await phonePage(browser);
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message.slice(0, 200)); });
    try {
      row.boot = await bootToTitle(page, BASE, slug);
      const hub = await openHub(page);
      row.cards = hub.cards; row.sections = hub.sections; row.sideways = hub.scroll.width > hub.scroll.viewW || hub.pageScrollX;
      row.list = JSON.stringify(hub.cards) === JSON.stringify(want) && row.sideways === false;
      await page.screenshot({ path: join(OUT, `hub-${slug}.jpg`), type: 'jpeg', quality: 84 });
      // back to the title, then ENTER WORLD and a real walk
      await tap(page, '.ws-x-close');
      await page.waitForFunction(() => document.querySelector('.ws-menu-play') !== null, undefined, { timeout: 60000, polling: 250 });
      await sleep(1500);
      await tap(page, '.ws-menu-play');
      await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered === true, undefined, { timeout: 60000, polling: 250 });
      await sleep(2500);
      const before = await page.evaluate(() => { const p = window.__wildshard.world.player.position; return [p.x, p.z]; });
      const ring = await (await page.$('.ws-touch-stick'))?.boundingBox();
      if (!ring) throw new Error('no MOVE stick');
      const cx = ring.x + ring.width / 2, cy = ring.y + ring.height / 2;
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 3, radiusX: 8, radiusY: 8, force: 1 }] });
      await touch('touchStart', cx, cy);
      for (let k = 1; k <= 4; k++) { await touch('touchMove', cx, cy - k * 12); await sleep(30); }
      await sleep(2000);
      await touch('touchEnd', cx, cy - 48);
      const after = await page.evaluate(() => { const w = window.__wildshard?.world, p = w.player.position; return { at: [p.x, p.z], fps: w.game.stats.fps, frames: w.game.lastFrame.calls }; });
      row.walked = Number(Math.hypot(after.at[0] - before[0], after.at[1] - before[1]).toFixed(2));
      row.fps = after.fps;
      row.play = row.walked > 1 && after.fps > 0;
      row.errors = errors;
    } catch (error) {
      row.error = String(error).slice(0, 300);
    }
    row.ok = row.list === true && row.play === true && errors.length === 0 && row.error === undefined;
    ok &&= row.ok === true;
    console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${slug}: ${JSON.stringify(row)}`);
    await page.context().close();
  }
  // the list scrolls: a short phone, the hub overflows, a real swipe moves it
  if (ONLY.includes('nalati-grasslands')) {
    const ctx = await browser.newContext({ viewport: { width: 402, height: 480 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    const page = await ctx.newPage();
    await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: VITE_STUB }));
    await bootToTitle(page, BASE, 'nalati-grasslands');
    const hub = await openHub(page);
    const box = await (await page.$('.ws-x-hub'))?.boundingBox();
    if (!box) throw new Error('no hub');
    const cdp = await ctx.newCDPSession(page);
    const x = box.x + box.width / 2, y0 = box.y + box.height * 0.8;
    const top0 = await page.evaluate(() => document.querySelector('.ws-x-hub')?.scrollTop ?? -1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 9 }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - k * 22, id: 9 }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(800);
    const top1 = await page.evaluate(() => document.querySelector('.ws-x-hub')?.scrollTop ?? -1);
    const max = hub.scroll.height - hub.scroll.view;
    const scroll = { overflow: max, from: top0, to: top1, sideways: hub.scroll.width > hub.scroll.viewW };
    const scrolled = max > 60 && top1 > top0 + Math.min(120, max - 2) && !scroll.sideways;
    await page.screenshot({ path: join(OUT, 'hub-scrolled-short-phone.jpg'), type: 'jpeg', quality: 84 });
    rows.push({ slug: 'scroll (402 × 480)', ...scroll, ok: scrolled });
    ok &&= scrolled;
    console.log(`${scrolled ? 'PASS' : 'FAIL'}  the hub list scrolls on a short phone: ${JSON.stringify(scroll)}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, 'hubs-report.json'), JSON.stringify(rows, null, 2));
process.exit(ok ? 0 : 1);
