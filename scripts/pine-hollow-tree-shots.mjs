#!/usr/bin/env node
// pine-hollow-tree-shots.mjs — quick looks at the forest for PH-B4's iterations: FP phone shots (iPhone 16 Pro, 390×844 @3,
// `tier=phone&touch`) and desktop god views at named spots, one page load per tier, page errors printed.
//
//   node scripts/pine-hollow-tree-shots.mjs --url=http://localhost:4192 --out=<dir> [--query=tod=golden] [--tiers=phone,desktop] [--only=hollow,oldgrowth]
//
// Writes <out>/<tier>-<spot>.jpg and <out>/sheet.jpg (magick montage). One headless Chromium on Metal, muted, closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4192');
const OUT = flag('out', '/tmp/pine-hollow-tree-shots');
const EXTRA = flag('query', 'tod=day&clock=1000000');
const tiers = flag('tiers', 'phone,desktop').split(',');
const only = flag('only', '').split(',').filter(Boolean);
const SETTLE = Number(flag('settle', '4')) * 1000;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** fp: x, z, yaw, pitch; god: eye (x, y above ground, z) looking at (lx, lz) */
const SPOTS = [
  { id: 'hollow', fp: [-30, -78, 2.6, 0.12], god: [-30, 30, -120, -20, -60] },
  { id: 'oldgrowth', fp: [118, -118, 3.6, 0.2], god: [60, 40, -160, 140, -80] },
  { id: 'clearing', fp: [150, -8, 0, 0.16], god: [150, 45, 40, 150, -40] },
  { id: 'ridge', fp: [70, 165, 2.2, 0.08], god: [20, 50, 110, 90, 170] },
  { id: 'pond', fp: [-60, 70, 3.4, 0.1], god: [-40, 35, 40, -100, 110] },
].filter((s) => only.length === 0 || only.includes(s.id));

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const files = [];
try {
  const iphone = devices['iPhone 16 Pro'];
  for (const tier of tiers) {
    const ctx = await browser.newContext(tier === 'phone'
      ? { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }
      : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error' || /\[trees\]|\[forest\]/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const s0 = SPOTS[0];
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&skipintro=1&nolock=1&tier=${tier}${tier === 'phone' ? '&touch' : ''}&mute=1&sw=0&x=${s0.fp[0]}&z=${s0.fp[1]}&${EXTRA}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => Boolean(window.__world && window.__hf && window.__world.animals), undefined, { timeout: 240000, polling: 1000 });
    } catch (e) { console.error(`[${tier}] never ready: ${errors.join(' | ')}`); throw e; }
    await page.evaluate(() => {
      const w = window.__world; w.animals.calm = true;
      window.__ts = { pose: null };
      w.game.onLate(() => {
        const p = window.__ts.pose, cam = w.game.camera;
        if (!p) return;
        for (const ch of cam.children) ch.visible = false;
        cam.position.set(p[0], p[1], p[2]); cam.lookAt(p[3], p[4], p[5]); cam.updateMatrixWorld(true);
      });
    });
    if (tier === 'desktop') await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
    await sleep(SETTLE * 2);
    for (const s of SPOTS) {
      const pose = tier === 'phone'
        ? page.evaluate((f) => { const w = window.__world; window.__ts.pose = null; w.freeCamera = false; w.player.spawn(f[0], f[1], f[2]); w.player.pitch = f[3]; }, s.fp)
        : page.evaluate((g) => {
          const w = window.__world, hf = window.__hf;
          const gy = hf.heightAt(g[0], g[2]), ly = hf.heightAt(g[3], g[4]);
          w.player.spawn(g[3], g[4], 0); w.freeCamera = true;
          window.__ts.pose = [g[0], gy + g[1], g[2], g[3], ly + 8, g[4]];
        }, s.god);
      await pose;
      await sleep(SETTLE);
      const perf = await page.evaluate(() => ({ calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles }));
      const f = `${OUT}/${tier}-${s.id}.jpg`;
      writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 85, scale: 'css' }));
      files.push(f);
      console.log(`${tier} ${s.id}: ${perf.calls} calls · ${(perf.tris / 1e6).toFixed(2)} M`);
    }
    if (errors.length > 0) console.log(`[${tier}] errors: ${errors.slice(0, 8).join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
execFileSync('magick', ['montage', ...files, '-tile', `${SPOTS.length}x`, '-geometry', '+4+4', '-resize', '800x800>', '-background', '#111', '-quality', '82', `${OUT}/sheet.jpg`]);
console.log(`${OUT}/sheet.jpg`);
