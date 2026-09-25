#!/usr/bin/env node
// nalati-edge.mjs — N23's board frames: the Look Lab's Edge (src/chunks/nalatiEdge.ts) OFF | ON at the poses where the
// slab's edge shows. The Edge is a second terrain bake (a reload), so each state is its own page load; every pose is
// first person (the player stands there, the HUD on), the clock paused at the pose's hour, the weather clear.
//
//   node scripts/nalati-edge.mjs --url=http://127.0.0.1:5185 [--tier=phone|desktop] [--only=<ids>] [--states=off,on]
//     → progress/nalati-merge/n23/frames/<tier>-<pose>-<state>.jpg
//
// One headless Chromium on Metal, muted, closed at the end. Check `pgrep -fl chrome-headless-shell` first (AGENTS.md: at
// most 3 game browsers on the machine).
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5185');
const TIER = flag('tier', 'phone');
const STATES = flag('states', 'off,on').split(',');
const ONLY = flag('only', '').split(',').filter(Boolean);
const SETTLE = Number(flag('settle', '5')) * 1000;
const OUT = resolvePath(ROOT, flag('out', 'progress/nalati-merge/n23/frames'));
mkdirSync(OUT, { recursive: true });

// yaw: 0 faces −z (south), π north, −π/2 west (+x), +π/2 east (−x); hour 17.3 = golden hour (the sun low in the WNW)
const N = Math.PI, NW = -3 * Math.PI / 4, NE = 3 * Math.PI / 4, W = -Math.PI / 2, E = Math.PI / 2, S = 0;
export const POSES = [
  { id: 'camp-n', x: 92, z: 204, yaw: N, pitch: 0.02, hour: 17.3 },
  { id: 'camp-nw', x: 84, z: 206, yaw: NW, pitch: 0.02, hour: 17.3 },
  { id: 'camp-ne', x: 76, z: 214, yaw: NE, pitch: 0.02, hour: 17.3 },
  { id: 'pasture-n', x: -118, z: 196, yaw: N, pitch: 0.03, hour: 17.3 },
  { id: 'pasture-ne', x: -104, z: 200, yaw: NE, pitch: 0.03, hour: 17.3 },
  { id: 'bridge-n', x: 0, z: 170, y: -5.4, yaw: N, pitch: 0.02, hour: 17.3 },
  { id: 'n-road-n', x: 0, z: 205, yaw: N, pitch: 0.02, hour: 17.3 },
  { id: 'valley-w', x: 150, z: 205, yaw: W, pitch: 0.02, hour: 16.2 },
  { id: 'valley-e', x: -150, z: 205, yaw: E, pitch: 0.02, hour: 16.2 },
  { id: 'w-road-w', x: 185, z: 4, yaw: W, pitch: 0.03, hour: 16.2 },
  { id: 'bowl-w-rim', x: 196, z: 30, yaw: W, pitch: 0.0, hour: 16.2 },
  { id: 'rim-n', x: 110, z: 106, yaw: N, pitch: -0.08, hour: 17.3 },
  { id: 'e-road-e', x: -185, z: -4, yaw: E, pitch: 0.03, hour: 16.2 },
  { id: 's-gate-s', x: 0, z: -205, yaw: S, pitch: 0.03, hour: 16.2 },
  { id: 'bowl-s', x: 40, z: -10, yaw: S, pitch: 0.03, hour: 16.2 },
  // on the crest itself (reachable only by a long walk along it from the shoulders): what holds up beyond it
  { id: 'crest-n', x: 100, z: 247.5, yaw: N, pitch: -0.12, hour: 17.3 },
].filter((p) => ONLY.length === 0 || ONLY.includes(p.id));

const TIERS = {
  phone: { viewport: { width: 390, height: 844 }, dpr: 2, touch: true },
  desktop: { viewport: { width: 1600, height: 900 }, dpr: 1, touch: false },
};
const tc = TIERS[TIER];
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const state of STATES) {
    const ctx = await browser.newContext({ viewport: tc.viewport, deviceScaleFactor: tc.dpr, hasTouch: tc.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('console', (m) => { if (/\[baked\]|\[navmesh\]/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', `tier=${TIER}`,
      tc.touch ? 'touch=1' : '', `edge=${state === 'on' ? 1 : 0}`, `x=${POSES[0]?.x ?? 0}`, `z=${POSES[0]?.z ?? 0}`].filter(Boolean).join('&');
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: 300000, polling: 1000 });
    console.error(`[${state}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await page.evaluate(() => { window.__weather.clock.paused = true; });
    await sleep(SETTLE);
    for (const p of POSES) {
      await page.evaluate((a) => {
        const w = window.__world;
        window.__weather.clock.set(a.hour);
        w.player.spawn(a.x, a.z, a.yaw);
        if (a.y !== undefined) w.player.position.y = a.y; // onto a deck (spawn stands on the terrain)
        w.player.pitch = a.pitch;
      }, p);
      await sleep(SETTLE);
      await page.evaluate((a) => { window.__world.player.pitch = a.pitch; }, p);
      await sleep(400);
      writeFileSync(resolvePath(OUT, `${TIER}-${p.id}-${state}.jpg`), await page.screenshot({ type: 'jpeg', quality: 86, scale: 'css' }));
      console.log(`${state} ${p.id}`);
    }
    if (errors.length > 0) console.error(`[${state}] ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
