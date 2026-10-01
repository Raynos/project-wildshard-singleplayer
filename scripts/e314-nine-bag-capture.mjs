#!/usr/bin/env node
// e314-nine-bag-capture.mjs — E314 Nine Dragon Bag A evidence: iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone
// tier, muted, Metal) frames of Nine Dragon Stack's Bag on one build, for a before / after sheet.
//
//   node scripts/e314-nine-bag-capture.mjs --url=http://127.0.0.1:4405 --out=<dir> --tag=before|after
//
// A fresh save. Every Bag tab that shows (before: MAP · GEAR · PACK · FEATS; A: MAP · GEAR), and what the I key / a PACK
// request lands on. Notes: the tab list, GEAR's cards, the kit's weapon ids (the iron sword gone). Writes
// <out>/<tag>-<scene>.jpg (+ <tag>-notes.json). Run it inside scripts/browser-lane.sh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4405');
const OUT = resolvePath(flag('out', '/tmp/e314-nine'));
const TAG = flag('tag', 'before');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const notes = {};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (sessionStorage.getItem('e314-seeded') === null) { localStorage.clear(); sessionStorage.setItem('e314-seeded', '1'); } } catch { /* */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=nine-dragon-stack&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 400000, polling: 1000 });
  await sleep(5000);
  const shot = async (name) => { const f = resolvePath(OUT, `${TAG}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 82 })); console.log(f); };
  const tab = (want) => page.evaluate((w) => {
    const bag = document.querySelector('.ws-minimap-bag');
    if (!document.querySelector('.ws-gmenu.show')) bag?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const b = [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => !x.hidden && x.dataset.tab === w);
    if (!b) return false;
    b.click();
    return true;
  }, want);
  const tabs = () => page.evaluate(() => [...document.querySelectorAll('.ws-gmenu-tab')].filter((x) => !x.hidden).map((x) => x.textContent.trim()));
  notes.kit = await page.evaluate(() => (window.__wildshard?.world?.weapons?.list ?? []).map((k) => `${k.id} (${k.name})`)); // the whole kit, locked slots too
  for (const t of ['map', 'gear']) { if (await tab(t)) { await sleep(1200); await shot(t); } }
  notes.bagTabs = await tabs();
  notes.gear = await page.evaluate(() => [...document.querySelectorAll('.ws-gmenu-panel.active .ws-gmenu-kit')].map((x) => x.textContent.replaceAll(/\s+/g, ' ').trim()));
  for (const t of ['inventory', 'achievements']) { if (await tab(t)) { await sleep(900); await shot(t === 'inventory' ? 'pack' : 'feats'); } }
  // the I key (a PACK request) with the Bag closed: where it lands
  await page.evaluate(() => { document.querySelector('.ws-gmenu-close')?.click(); });
  await sleep(600);
  await page.evaluate(() => { window.__wildshard?.world?.hud?.menu?.open('inventory'); });
  await sleep(900);
  notes.packRequestLands = await page.evaluate(() => document.querySelector('.ws-gmenu-tab.active')?.dataset.tab ?? null);
  writeFileSync(resolvePath(OUT, `${TAG}-notes.json`), JSON.stringify(notes, null, 2));
  console.log(JSON.stringify(notes, null, 2));
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 4).join(' | ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
