#!/usr/bin/env node
// SF49 (C4-R1-C13 + the far re-bake): the grid's view of Sky Reach from the road, proven in a real browser: Chromium as an
// iPhone 16 Pro portrait, muted, Settings ▸ Developer on (the Developer catalogue: Sky Reach is the south cell).
//
//   scripts/serve-build.sh --head --name sf49-far                → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh node progress/shard-platform/sf49/far/capture.mjs --url=http://127.0.0.1:<port>
//
// Records every console warning, so the "[grid] <instance> edges stay at road level" edge fallback is asserted absent, the
// far view's status for the Sky Reach cell, and writes capture.json beside the images.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'], PITCH = 555, WALL = 250;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '804', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text().slice(0, 240)); });
  out.errors = errors; out.warnings = warnings;
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(1200);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await sleep(800); await page.mouse.click(200, 400); // skip the reveal
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  const grid = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const home = grid.cells.find((c) => c.instance === grid.home);
  const sky = grid.cells.find((c) => c.slug === 'far-reach');
  if (home === undefined || sky === undefined) throw new Error('Sky Reach is not in this grid (Developer catalogue expected)');
  const ox = (sky.cell[0] - home.cell[0]) * PITCH, oz = (sky.cell[1] - home.cell[1]) * PITCH;
  out.home = home.instance; out.sky = { instance: sky.instance, cell: sky.cell, ox, oz };
  const read = () => page.evaluate((id) => { const g = window.__wildshard.shard.grid.state(); return { screen: g.screens?.find?.((s) => s.instance === id) ?? null, inside: g.inside }; }, sky.instance);
  // `d` metres off Sky Reach's wall that faces home, `t` along it, `y` up, looking into the cell
  const onX = Math.abs(ox) >= Math.abs(oz), sx = Math.sign(ox), sz = Math.sign(oz);
  const pose = (d, t, y, pitch, turn = 0) => {
    const x = onX ? ox - sx * (WALL + d) : ox + t, z = onX ? oz + t : oz - sz * (WALL + d);
    const dx = onX ? sx : 0, dz = onX ? 0 : sz;
    return { x, y, z, yaw: Math.atan2(-dx, -dz) + turn, pitch };
  };
  const shot = async (name, p, wait = 4000) => {
    await page.evaluate((q) => window.__wildshard.pose({ name: 'grid', ...q }), p);
    await sleep(wait);
    out[name] = { pose: p, ...(await read()) }; console.log(name, JSON.stringify(out[name].screen));
    toJpeg(await page.screenshot(), `${name}.jpg`);
  };
  // the road's centre line runs 27.5 m outside the wall (the 555 m pitch): the midpoint socket, then along the road
  await shot('1-road-midpoint', pose(27.5, 0, 2, 0.12), 6000);
  await shot('2-road-east', pose(27.5, 120, 2, 0.08, -0.5));
  await shot('3-road-west', pose(27.5, -120, 2, 0.08, 0.5));
  await shot('4-above-road', pose(60, 0, 45, -0.12));
  // G222 (agent playtest round 1, item 4): the tall streaked walls at Sky Reach's north corners and north of Pine, from
  // the playtest's own spots (home-relative: the boulevard at (±250, -280), the x = -279 road looking north)
  const at = (x, z, y, yaw, pitch) => ({ x, y, z, yaw, pitch });
  await shot('5-g222-sw-corner-west', at(-150, -280, 2, Math.PI / 2, 0.05));
  await shot('6-g222-se-corner-east', at(150, -280, 2, -Math.PI / 2, 0.05));
  await shot('7-g222-x279-north', at(-279, -150, 2, Math.PI, 0.05));
  await shot('8-g222-se-corner-close', at(240, -280, 2, -Math.PI / 2, 0.15));
  await shot('9-g222-pine-north', at(-279, 400, 2, Math.PI, 0.05));
  out.edgeFallback = warnings.filter((w) => /edges stay at road level/u.test(w));
  out.terrainBin = warnings.filter((w) => /terrain\.bin|terrain bake/u.test(w));
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'capture.json'), `${JSON.stringify(out, null, 2)}\n`);
}
