#!/usr/bin/env node
// SF88e (G526): the two outer-band shards seen from the outer road, iPhone 16 Pro portrait (402 × 874 at 3×, touch,
// phone tier, Developer on, muted), one JPEG each with a burned-in label.
//
//   scripts/browser-lane.sh node art/grid/round-30-outer-shards/capture.mjs --url=<served build> [--out=<dir>]
//
// Each shard's cell comes from the live grid (its placed cell index); the pose stands on the outer road's centre
// line (±1387.5 m from home) 200 m along from the point nearest the cell's centre; the eye 30 m above it, looking across it.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const BASE = flag('url', 'http://127.0.0.1:4401').replace(/\/$/u, '');
const OUT = resolvePath(flag('out', import.meta.dirname));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const FIXTURES = [
  'window.__wildshardHarness={seed:357,capture:null}',
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true }),
].join(';');
const PITCH = 555, EDGE = 2.5 * PITCH;
const SHARDS = [['pastel-plain', 'Pastel Plain'], ['ink-cel-valley', 'Ink / Cel Valley']];

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
  const cells = await page.evaluate(() => window.__wildshard.shard.grid.state().cells.map((c) => ({ instance: c.instance, slug: c.slug, origin: c.origin, cell: c.cell })));
  writeFileSync(resolvePath(OUT, 'cells.json'), JSON.stringify(cells, null, 1));
  for (const [slug, label] of SHARDS) {
    const cell = cells.find((c) => c.slug === slug || c.instance?.startsWith(slug));
    if (cell === undefined) throw new Error(`No placed cell for ${slug}: ${JSON.stringify(cells.slice(0, 2))}`);
    // a cell's centre is its index times the pitch: the 500 m cell plus the 55 m road gap (roadLayout.ts)
    const [cx, cz] = [cell.cell[0] * PITCH, cell.cell[1] * PITCH];
    // the nearest stretch of the outer loop: the side the cell's centre is closest to
    const sides = [[cx, EDGE], [cx, -EDGE], [EDGE, cz], [-EDGE, cz]].map(([x, z]) => ({ x, z, d: Math.hypot(x - cx, z - cz) }));
    const at = sides.reduce((a, b) => (b.d < a.d ? b : a));
    // the player stands on the road 200 m along from the point nearest the cell's centre; the eye is held 30 m above it,
    // looking at the cell's centre, so the frame clears the rail and the cell's soft wall (capture only: the renderer's
    // render() re-aims the camera before each draw). Every neighbour not yet entered keeps its loading screen at its entry.
    const side = at.x === cx ? { x: at.x - 200, z: at.z } : { x: at.x, z: at.z - 200 };
    const yaw = Math.atan2(-(cx - side.x), -(cz - side.z));
    await page.evaluate((pose) => { window.__wildshard.pose(pose); }, { x: side.x, y: 4, z: side.z, yaw, pitch: 0 });
    await page.waitForFunction((id) => { const c = window.__wildshard.shard.grid.state().cells.find((x) => x.instance === id); return c !== undefined && (c.drawn.near || c.drawn.l0 > 0); }, cell.instance, { timeout: 180000, polling: 1000 }).catch(() => { console.log(`${slug}: not drawn near after 180 s`); });
    await page.evaluate(({ eye, target }) => {
      const game = window.__wildshard.world.game, renderer = game.renderer, camera = game.camera;
      const render = renderer.__sf88eRender ?? renderer.render;
      renderer.__sf88eRender = render;
      renderer.render = function (...args) { camera.position.set(eye.x, eye.y, eye.z); camera.lookAt(target.x, target.y, target.z); camera.updateMatrixWorld(); return render.apply(this, args); };
    }, { eye: { x: side.x, y: 34, z: side.z }, target: { x: cx, y: 0, z: cz } });
    await sleep(6000);
    const reading = await page.evaluate((id) => { const info = window.__wildshard.world.game.renderer.info.render, c = window.__wildshard.shard.grid.state().cells.find((x) => x.instance === id); return { draws: info.calls, triangles: info.triangles, shows: c?.shows, drawn: c?.drawn }; }, cell.instance);
    readings.push({ slug, cell, pose: { x: side.x, z: side.z, yaw }, ...reading });
    const raw = resolvePath(OUT, `${slug}.png`), jpg = resolvePath(OUT, `${slug}-outer-road.jpg`);
    await page.screenshot({ path: raw, type: 'png' });
    execFileSync('magick', [raw, '-resize', '804x', '-gravity', 'North', '-fill', '#0008', '-draw', 'rectangle 0,0 804,74', '-fill', 'white',
      '-font', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '-pointsize', '30', '-annotate', '+0+18', `${label} — 30 m above the outer road`, '-quality', '78', jpg]);
    execFileSync('rm', [raw]);
    console.log(JSON.stringify(readings.at(-1)));
  }
  await ctx.close();
} finally {
  writeFileSync(resolvePath(OUT, 'readings.json'), JSON.stringify(readings, null, 1));
  await browser.close();
}
