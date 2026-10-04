#!/usr/bin/env node
// The grid client's browser drive (SHARD-PLATFORM SF18b / SF21a / SF17b): EXPERIMENTAL Wildshard entered from the title
// (Settings ▸ Developer on), then a hover loop around the home cell on the inner highway ring, sampling the grid session's
// readout (`__wildshard.shard.grid.state()`) every 250 ms: holes (a visible neighbour not drawn by any level), the allocator's
// resident MB, the cell events (inside the home cell / on the deck); then a push into a neighbour's soft wall (its sim is not
// resident in the page, so its edge must hold at the 6 m re-frame line) and portrait shots from the deck.
//
//   scripts/serve-build.sh --name grid-client     → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/sf18b/grid-drive.mjs --url=http://127.0.0.1:<port>
//
// Chromium as an iPhone 16 Pro portrait, muted, render scale as shipped. Writes grid-drive.json and grid-*.jpg here.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: grid-drive.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { url, started: new Date().toISOString() };
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-menu-entry-grid', { timeout: 120000 });
  await sleep(800);
  const t0 = Date.now();
  await page.click('.ws-menu-entry-grid');
  await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 500 });
  out.bootSeconds = Math.round((Date.now() - t0) / 100) / 10;
  out.boot = await page.evaluate(() => window.__wildshard.shard.grid.state());
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await sleep(1500);
  // the drive: hover the inner highway ring around the home cell, sampling the readout
  const sampler = page.evaluate(async () => {
    const rows = []; window.__gridSampling = true;
    while (window.__gridSampling) {
      const s = window.__wildshard.shard.grid.state();
      rows.push({ t: Math.round(performance.now()), feet: s.feet, inside: s.inside, ready: s.ringsReady, mb: s.residentMB, playing: s.playingMB, far: s.rings.far, refused: s.rings.refused });
      await new Promise((r) => { setTimeout(r, 250); });
    }
    return rows;
  });
  const ring = [[277.5, 0], [277.5, 277.5], [0, 277.5], [-277.5, 277.5], [-277.5, -277.5], [277.5, -277.5], [277.5, 0], [235, 0]];
  out.loop = await page.evaluate((waypoints) => window.__wildshard.walkLeg({ name: 'grid-ring', start: { x: 235, z: 0, yaw: -Math.PI / 2, hover: true }, waypoints: waypoints.map(([x, z]) => ({ x, z })), timeout: 240, stuckSeconds: 3 }), ring);
  await page.evaluate(() => { window.__gridSampling = false; });
  const rows = await sampler;
  delete out.loop.trace;
  out.samples = rows.length;
  out.holes = rows.filter((r) => !r.ready).length;
  out.maxResidentMB = Math.max(...rows.map((r) => r.mb));
  out.maxPlayingMB = Math.max(...rows.map((r) => r.playing));
  out.insideSeen = [...new Set(rows.map((r) => r.inside ?? 'deck'))];
  out.farMax = Math.max(...rows.map((r) => r.far));
  out.refused = Math.max(...rows.map((r) => r.refused));
  out.maxOffset = Math.max(...rows.map((r) => Math.max(Math.abs(r.feet.x), Math.abs(r.feet.z))));
  // the soft wall: push east from the highway into Nalati's cell (its edge holds at x = 555 − 250 − 6 = 299)
  out.wall = await page.evaluate(() => window.__wildshard.walkLeg({ name: 'soft-wall', start: { x: 280, z: 0, yaw: -Math.PI / 2 }, waypoints: [{ x: 330, z: 0 }], timeout: 12, stuckSeconds: 4 }));
  delete out.wall.trace;
  out.wall.held = out.wall.stuck.length > 0 && out.wall.stuck.every((s) => s.x < 299.2); // the harness teleports past a stuck waypoint; the stuck point is the wall
  // portrait shots from the deck
  for (const [name, pose] of Object.entries({ east: { x: 277.5, y: 1.7, z: -40, yaw: 0, pitch: -0.08 }, crossroads: { x: 240, y: 6, z: 240, yaw: -Math.PI * 0.75, pitch: -0.12 }, north: { x: 0, y: 3, z: 262, yaw: Math.PI, pitch: -0.05 } })) {
    await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), pose);
    await sleep(1500);
    toJpeg(await page.screenshot(), join(OUT, `grid-${name}.jpg`));
  }
  out.end = await page.evaluate(() => window.__wildshard.shard.grid.state());
  out.errors = errors;
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); }
finally { await browser.close(); }
writeFileSync(join(OUT, 'grid-drive.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ boot: out.bootSeconds, holes: out.holes, samples: out.samples, mb: out.maxResidentMB, playing: out.maxPlayingMB, inside: out.insideSeen, stuck: out.loop?.stuck?.length, wall: out.wall?.end, held: out.wall?.held, error: out.error, errors: out.errors?.length }));
