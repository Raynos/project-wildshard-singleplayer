#!/usr/bin/env node
// pine-hollow-crag-shots.mjs — PH-B2's looks at the Ridge's crags and the Den's cave: phone FP shots (iPhone 16 Pro portrait,
// 390×844 @3, `tier=phone&touch`, HUD hidden) at named spots, per time of day, one page load per time of day.
//
//   node scripts/pine-hollow-crag-shots.mjs --url=http://localhost:4271 --out=<dir> [--tods=day,golden] [--only=lookout-ne,cave]
//     [--query=crags=v1] [--tier=phone|desktop] [--settle=4]
//
// Writes <out>/<tod>-<spot>.jpg (+ the frame's calls / tris in <out>/shots.json). One headless Chromium on Metal, muted,
// closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4271');
const OUT = flag('out', '/tmp/pine-hollow-crag-shots');
const EXTRA = flag('query', '');
const TIER = flag('tier', 'phone');
const tods = flag('tods', 'day,golden').split(',').filter(Boolean);
const only = flag('only', '').split(',').filter(Boolean);
const SETTLE = Number(flag('settle', '4')) * 1000;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** x, z, yaw (faces (−sin, −cos)), pitch, and y (feet) when not on the ground */
const SPOTS = [
  // the fire lookout's north catwalk (deck +11): along the Ridge east of the pass, and north over its crest
  { id: 'lookout-ne', x: 36.47, z: 216.86, yaw: 2.2, pitch: -0.12, y: 57.46 },
  { id: 'lookout-e', x: 35.2, z: 214.5, yaw: 1.75, pitch: -0.2, y: 57.46 },
  { id: 'lookout-w', x: 37.5, z: 214.5, yaw: 4.5, pitch: -0.2, y: 57.46 },
  // the Ridge from the Hollow: the N road below the pass, and the pond's west shore toward the waterfall
  { id: 'hollow-n', x: 4, z: 96, yaw: Math.PI, pitch: 0.2 },
  { id: 'pond-n', x: -62, z: 112, yaw: 3.7, pitch: 0.16 },
  { id: 'ridge-foot', x: 70, z: 165, yaw: 2.9, pitch: 0.3 },
  // the Den: its bowl toward the cave mouth
  { id: 'den', x: 184, z: 180, yaw: 3.93, pitch: 0.08 },
  // inside the cave (its frame: the mouth at (200, 200), local +z into the rock, `cave(lx, lz, lookLx, lookLz, y, pitch)`)
  cave('cave-mouth', 0, -6, 0, 6, 9.0, 0.02),
  cave('cave-ante', 0.3, 3, -1.2, 12, 8.9, 0.0),
  cave('cave-squeeze', -1.2, 11.5, -0.4, 17, 8.7, 0.0),
  cave('cave-room', 0.4, 20.5, 1.5, 30, 8.5, -0.05),
  cave('cave-bed', -2.5, 24.5, 3.9, 31, 8.05, -0.18),
  cave('cave-out', 0.2, 19, -1.0, 6, 8.5, 0.05),
].filter((s) => only.length === 0 || only.includes(s.id));

/** a spot in the cave's frame (PineCrags.caveWorld: yaw π/4 about the mouth (200, 200)): stand at (lx, lz), look at (tx, tz) */
function cave(id, lx, lz, tx, tz, y, pitch) {
  const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
  const w = (a, b) => [200 + a * c + b * s, 200 - a * s + b * c];
  const [x, z] = w(lx, lz), [ax, az] = w(tx, tz);
  return { id, x, z, yaw: Math.atan2(-(ax - x), -(az - z)), pitch, y };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const meta = [];
try {
  const iphone = devices['iPhone 16 Pro'];
  for (const tod of tods) {
    const ctx = await browser.newContext(TIER === 'phone'
      ? { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }
      : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error' || /\[crags\]|\[landmarks\]/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const s0 = SPOTS[0];
    const q = ['chunk=pine-hollow', 'skipintro=1', 'nolock=1', `tier=${TIER}`, TIER === 'phone' ? 'touch' : '', 'mute=1', 'sw=0', `x=${s0.x}`, `z=${s0.z}`, `tod=${tod}`, 'clock=1000000', EXTRA].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    } catch (e) { console.error(`[${tod}] never ready: ${errors.join(' | ')}`); throw e; }
    await page.evaluate(() => { window.__world.animals.calm = true; });
    await page.addStyleTag({ content: '#hud,#hud *,.touch-controls,.touch-controls *{display:none!important}' });
    await sleep(SETTLE * 2);
    for (const s of SPOTS) {
      await page.evaluate((p) => {
        const w = window.__world; w.freeCamera = false; w.player.spawn(p.x, p.z, p.yaw); w.player.pitch = p.pitch;
        if (p.y !== undefined) w.player.position.y = p.y;
      }, s);
      await sleep(SETTLE);
      if (s.y !== undefined) await page.evaluate((p) => { window.__world.player.position.y = p.y; }, s);
      const perf = await page.evaluate(() => ({ calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles, y: window.__world.player.position.y }));
      const f = `${OUT}/${tod}-${s.id}.jpg`;
      writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 88, scale: 'css' }));
      meta.push({ tod, spot: s.id, ...perf });
      console.log(`${tod} ${s.id}: ${perf.calls} calls · ${(perf.tris / 1e6).toFixed(2)} M · feet ${perf.y.toFixed(2)}`);
    }
    if (errors.length > 0) console.log(`[${tod}] errors: ${errors.slice(0, 8).join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/shots.json`, `${JSON.stringify(meta, null, 2)}\n`);
