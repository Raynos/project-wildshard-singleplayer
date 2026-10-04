#!/usr/bin/env node
// SF17b's per-view road budget, measured in the real game (SHARD-PLATFORM §3.2 road targets: ≤ 150k triangles resident,
// ≤ 60k drawn and ≤ 8 draws per view, shadow draws included). INFINITE WILDSHARD from the title (Developer mode), then the
// worst grid poses: a crossroads, an entry, the outer ring (a side and a corner) and looking along the boulevard, each at
// eight headings. At each it reads the grid's `roadView()` (the view camera's road draws and triangles, counted exactly as
// the renderer issues them, culled bins included) and `roadResident()`, plus a few portrait shots for the look.
//
//   scripts/serve-build.sh --name sf17b-cull          → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh node progress/shard-platform/sf17b-cull/measure.mjs --url=http://127.0.0.1:<port> --label=after-on --cull=on
//
// Chromium as an iPhone 16 Pro portrait, muted. Writes <label>.json and <label>-*.jpg here.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).slice(name.length + 3);
const url = arg('url', ''), label = arg('label', 'after');
if (url === '') { console.error('usage: measure.mjs --url=<build> [--label=before|after]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
// home frame metres (the home cell is the grid centre): roads at ±277.5 and ±832.5
const POSES = {
  crossroads: { x: 277.5, y: 1.7, z: 277.5 },
  'crossroads-air': { x: 240, y: 6, z: 240 },
  entry: { x: 277.5, y: 1.7, z: 0 },
  'outer-ring': { x: 832.5, y: 1.7, z: 0 },
  'outer-corner': { x: 832.5, y: 1.7, z: 832.5 },
  boulevard: { x: 277.5, y: 1.7, z: -240 },
};
const SHOTS = { crossroads: { x: 277.5, y: 3, z: 215, yaw: 0, pitch: -0.1 }, boulevard: { x: 277.5, y: 1.7, z: -40, yaw: 0, pitch: -0.08 }, 'outer-ring': { x: 832.5, y: 1.7, z: -60, yaw: 0, pitch: -0.05 }, entry: { x: 262, y: 2.5, z: -6, yaw: -Math.PI / 2, pitch: -0.1 } };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { url, label, started: new Date().toISOString(), poses: {} };
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  out.cull = arg('cull', 'off'); // Settings > Debug > Grid road cull (default off)
  await saveFixture(ctx, { scope: 'device', key: 'debug.global.gridRoadCull', data: out.cull });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(800);
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100); });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 500 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await sleep(1500);
  out.resident = await page.evaluate(() => window.__wildshard.shard.grid.roadResident?.() ?? null); // null: a build before the readout (shots only)
  out.seams = await page.evaluate(() => window.__wildshard.shard.grid.state().seams);
  let worst = { draws: 0, triangles: 0 };
  for (const [name, at] of Object.entries(out.resident === null ? {} : POSES)) {
    const rows = [];
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4;
      await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), { ...at, yaw, pitch: -0.08 });
      await sleep(250);
      const view = await page.evaluate(() => window.__wildshard.shard.grid.roadView());
      rows.push({ yaw: Math.round(yaw * 100) / 100, draws: view.draws, triangles: Math.round(view.triangles), shadowDraws: view.shadowDraws, byMesh: view.byMesh });
    }
    const max = { draws: Math.max(...rows.map((r) => r.draws)), triangles: Math.max(...rows.map((r) => r.triangles)) };
    worst = { draws: Math.max(worst.draws, max.draws), triangles: Math.max(worst.triangles, max.triangles) };
    out.poses[name] = { at, max, rows };
  }
  out.worst = worst;
  for (const [name, pose] of Object.entries(SHOTS)) {
    await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), pose);
    await sleep(1500);
    toJpeg(await page.screenshot(), join(OUT, `${label}-${name}.jpg`));
  }
  out.errors = errors;
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); }
finally { await browser.close(); }
writeFileSync(join(OUT, `${label}.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ label, cull: out.cull, resident: out.resident, worst: out.worst, perPose: Object.fromEntries(Object.entries(out.poses).map(([k, v]) => [k, v.max])), error: out.error, errors: out.errors?.length }));
