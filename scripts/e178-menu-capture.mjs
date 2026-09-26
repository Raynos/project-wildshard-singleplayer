#!/usr/bin/env node
// e178-menu-capture.mjs — E178: the in-game PAUSE and BAG menus' header, captured in the real build (phone portrait 390×844
// at 3×, touch, muted, Metal), plus the PAUSE menu with the build pill up (developer mode shows it) and a desktop frame.
//
//   node scripts/e178-menu-capture.mjs --url=http://127.0.0.1:5191 --out=/tmp/e178/after [--scenes=pause,bag,pill,desktop]
//
// Writes <out>/<scene>.jpg and <out>/<scene>-rects.json (the header's parts, for the 44 px / fit checks). The browser is
// closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5191');
const OUT = resolvePath(flag('out', '/tmp/e178/shots'));
const SCENES = flag('scenes', 'pause,bag,pill,desktop').split(',').filter((x) => x !== '');
const CHUNK = flag('chunk', 'nalati-grasslands');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const PARTS = {
  sheet: '.ws-gmenu.show .ws-gmenu-sheet', head: '.ws-gmenu.show .ws-gmenu-head', title: '.ws-gmenu.show .ws-gmenu-title',
  sub: '.ws-gmenu.show .ws-gmenu-sub', close: '.ws-gmenu.show .ws-gmenu-close', exit: '.ws-gmenu.show .ws-gmenu-exit',
  dev: '.ws-gmenu.show .ws-gmenu-dev', tabs: '.ws-gmenu.show .ws-gmenu-tabs', pill: '.ws-update.visible', firstBtn: '.ws-gmenu.show .ws-gmenu-panel.active > *',
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const run = async (scene) => {
    const desktop = scene === 'desktop', dev = scene === 'pill';
    const ctx = await browser.newContext(desktop ? { viewport: { width: 1600, height: 900 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await ctx.addInitScript((on) => { try { if (on) localStorage.setItem('ws.dev', '1'); else localStorage.removeItem('ws.dev'); } catch { /* */ } }, dev);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`${URL_BASE}/?chunk=${CHUNK}&mute=1&nolock=1&skipintro=1${desktop ? '' : '&touch=1&tier=phone'}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
    await sleep(3000);
    // the BAG: its minimap corner button answers the lift (BagButton.ts); the PAUSE: the touch pause button's event
    await page.evaluate((bag) => {
      const b = bag ? document.querySelector('.ws-minimap-bag') : document;
      b?.dispatchEvent(bag ? new PointerEvent('pointerup', { bubbles: true }) : new Event('ws:pause'));
    }, scene === 'bag');
    await sleep(1200);
    const rects = await page.evaluate((parts) => {
      const out = {};
      for (const [k, s] of Object.entries(parts)) {
        const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && getComputedStyle(x).display !== 'none'; });
        if (!e) continue;
        const r = e.getBoundingClientRect();
        out[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), (e.textContent || '').replaceAll(/\s+/g, ' ').trim().slice(0, 40)];
      }
      return out;
    }, PARTS);
    const file = resolvePath(OUT, `${scene}.jpg`);
    writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 80 }));
    writeFileSync(resolvePath(OUT, `${scene}-rects.json`), JSON.stringify(rects, null, 1));
    console.log(`${file}${errors.length > 0 ? `  page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    for (const [k, v] of Object.entries(rects)) console.log(`   ${k.padEnd(9)} ${v.slice(0, 4).join(', ').padEnd(22)} ${v[4]}`);
    await ctx.close();
  };
  for (const s of SCENES) await run(s);
} finally {
  await browser.close();
}
