#!/usr/bin/env node
// SF88c (G526): the 5 × 5 grid's far layer seen from the outer road. iPhone 16 Pro portrait (402 × 874 at 3×, touch,
// phone tier, Developer on, muted).
//
//   scripts/browser-lane.sh node art/grid/round-29-far-5x5/capture.mjs --url=<served build> [--out=<dir>] [--only=<pose,…>]
//
// Poses on the outer road (its centre line, ±1387.5 m from home), each looking across the platform, and writes one JPEG
// per pose plus `readings.json`: the far ring (resident / drawn proxies), the draws and triangles of the frame, the
// camera's far plane and the allocator's resident bytes at each pose.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const BASE = flag('url', 'http://127.0.0.1:4401').replace(/\/$/u, '');
const ONLY = flag('only', '').split(',').filter(Boolean);
const OUT = resolvePath(flag('out', import.meta.dirname));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const FIXTURES = [
  'window.__wildshardHarness={seed:357,capture:null}',
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true }),
].join(';');
const EDGE = 1387.5;
// [name, x, z, yaw]: yaw looks along (−sin yaw, −cos yaw); the corners look along the diagonal, the midpoints straight across
const POSES = [
  ['sw-corner', -EDGE, EDGE, Math.atan2(-1, 1)],
  ['south-mid', 0, EDGE, 0],
  ['east-mid', EDGE, 0, Math.PI / 2],
  ['ne-corner', EDGE, -EDGE, Math.atan2(1, -1)],
  // the board's view: on the south road, looking up the platform past its middle (between the corner plots)
  ['south-road', -700, EDGE, Math.atan2(-0.55, 1)],
  // G538: across the platform from the east road toward Signal Dunes (cell −1, 0)
  ['east-road', EDGE, -1000, Math.atan2(1, -0.38)],
];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const readings = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript(FIXTURES);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message.slice(0, 200)); });
  await page.goto(`${BASE}/?mute=1&nolock=1&sw=0&touch=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(800);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 240000, polling: 500 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await sleep(1500);
  await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await sleep(4000);
  for (const [name, x, z, yaw] of POSES.filter(([name]) => ONLY.length === 0 || ONLY.includes(name))) {
    await page.evaluate((pose) => { window.__wildshard.pose(pose); }, { x, y: 4, z, yaw, pitch: -0.02 });
    await sleep(12000);
    readings.push({ name, ...await page.evaluate(() => {
      const grid = window.__wildshard.shard.grid, state = grid.state(), game = window.__wildshard.world.game;
      const info = game.renderer.info.render;
      return { rings: state.rings, drawnFar: state.cells.filter((c) => c.drawn.far).map((c) => c.instance),
        cameraFar: game.camera.far, draws: info.calls, triangles: info.triangles, residentMB: state.residentMB, playingMB: state.playingMB,
        heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6),
        categoriesMB: Object.fromEntries(Object.entries(grid.residency().cost.input).map(([k, n]) => [k, Math.round(n / 1e5) / 10])),
        // G539: the cells whose far tier draws as its impostor (wholly or in the band's fade)
        impostors: (() => { const names = []; game.scene.traverse((o) => { if (o.name === 'far-impostor' && o.visible) names.push(o.parent?.name ?? '?'); }); return names; })() };
    }) });
    await page.screenshot({ path: resolvePath(OUT, `${name}.jpg`), type: 'jpeg', quality: 80 });
    console.log(JSON.stringify(readings.at(-1)));
  }
  await ctx.close();
} finally {
  writeFileSync(resolvePath(OUT, 'readings.json'), JSON.stringify(readings, null, 1));
  await browser.close();
}
