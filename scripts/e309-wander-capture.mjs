#!/usr/bin/env node
// e309-wander-capture.mjs — E309 picks gulls B + map A (DRIFTWOOD-TOP10 row 9b) captured in the real build, iPhone 16 Pro
// portrait (touch, phone tier, muted, Metal), from a save with 4 of 11 places found (pier, hut, vista, bridge):
//   gull-1..5.png   the gull guide: stand still, face the nearest unfound place; ~10 s in three gulls fly past you toward it
//   map.png         the Bag's MAP tab: dashed-ring "?" pins and PLACES 4 / 11
// Run it in the browser lane:  scripts/browser-lane.sh --max 15 node scripts/e309-wander-capture.mjs [--url=http://127.0.0.1:5173] --out=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5173');
const OUT = resolvePath(flag('out', 'progress/e309'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const SEEN = ['seen:pier', 'seen:hut', 'seen:vista', 'seen:bridge'];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const { defaultBrowserType: _b, ...iphone } = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext(iphone);
  await ctx.addInitScript((seen) => {
    try { localStorage.setItem('ws.flags.v1', JSON.stringify({ 'chunk://local/driftwood-isle': seen })); } catch { /* blocked */ }
  }, SEEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 200)); });
  await page.goto(`${URL_BASE}/?chunk=driftwood-isle&touch=1&tier=phone&mute=1&nolock=1&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && window.__world?.gulls && window.__adventure?.places && window.__world?.hud?.entered === true, undefined, { timeout: 300000, polling: 1000 });
  // stand by Wendell's hut (inland: the lagoon's wheeling flocks are ~200 m off), face the nearest unfound place, look a little up
  const target = await page.evaluate(() => {
    const w = window.__world, a = window.__adventure, hut = a.places.points.find((q) => q.id === 'hut');
    if (hut) w.player.spawn(hut.x + 6, hut.z - 14, w.player.yaw);
    const p = w.player.position;
    let best = null, bd = Infinity;
    for (const q of a.places.points) { if (a.places.discovered(q.id)) continue; const d = Math.hypot(q.x - p.x, q.z - p.z) - q.r; if (d > 0 && d < bd) { bd = d; best = q; } }
    if (best) { w.player.yaw = Math.atan2(-(best.x - p.x), -(best.z - p.z)); w.player.pitch = 0.32; }
    return best ? { id: best.id, x: best.x, z: best.z, from: { x: p.x, z: p.z }, dist: Math.round(bd) } : null;
  });
  console.log('target', JSON.stringify(target));
  // wait for the guide (state 5) and shoot as the leader crosses u = …
  await page.waitForFunction(() => window.__world.gulls.gulls.some((g) => g.state === 5), undefined, { timeout: 60000, polling: 100 });
  const us = [0.54, 0.6, 0.66, 0.73, 0.82];
  const frames = [];
  for (let i = 0; i < us.length; i++) {
    await page.waitForFunction((u) => { const g = window.__world.gulls.gulls.find((h) => h.state === 5); return !g || g.t / g.dur >= u; }, us[i], { timeout: 30000, polling: 50 });
    // each guide gull: its pass fraction, height over you, distance, and where it is on screen (CSS px, for the sheet's zoom)
    const info = await page.evaluate(() => {
      const w = window.__world, p = w.player.position, cam = w.game.camera, v = p.clone();
      return w.gulls.gulls.filter((g) => g.state === 5).map((g) => {
        v.set(g.x, g.y, g.z).project(cam);
        return { u: Number((g.t / g.dur).toFixed(2)), up: Number((g.y - p.y).toFixed(1)), d: Number(Math.hypot(g.x - p.x, g.z - p.z).toFixed(1)), sx: Math.round((v.x + 1) / 2 * innerWidth), sy: Math.round((1 - v.y) / 2 * innerHeight), front: v.z < 1 };
      });
    });
    console.log(`gull-${i + 1}`, JSON.stringify(info));
    frames.push(info);
    await page.screenshot({ path: `${OUT}/gull-${i + 1}.png` });
  }
  writeFileSync(`${OUT}/gulls.json`, JSON.stringify({ target, frames }, null, 1));
  await sleep(1500);
  await page.evaluate(() => { window.__world.hud.menu.open('map'); });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/map.png` });
  await page.close();
} finally {
  await browser.close();
}
