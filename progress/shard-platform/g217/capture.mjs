#!/usr/bin/env node
// G217 (SF18b / SF58): the full Developer loading screen in 3D on every cell you can't enter, proven in a real browser:
// Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on (INFINITE WILDSHARD is Developer-only until SF22).
//
//   scripts/serve-build.sh --head --name g217                → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/g217/capture.mjs --url=http://127.0.0.1:<port> [--refuse | --slow]
//
// Default run: a waiting cell (a shard with no shardfile yet) from the road and close up. --slow answers the grid's first
// template read (its edge rows) with an empty object and holds every later one 45 s, so the template cells are genuinely
// mid-admission (loading: requested, the product admitting) while posed at a template cell's road and close up; the wall
// opens when it lands. --refuse serves the template's shard.json as an
// empty object, so every template cell is refused by admission (a safety refusal), captured from the road and close up.
// Writes capture[-slow|-refuse].json beside the images.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6), refuse = process.argv.includes('--refuse'), slow = process.argv.includes('--slow');
if (url === '') { console.error('usage: capture.mjs --url=<build> [--refuse | --slow]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'], PITCH = 555, WALL = 256, ROAD = PITCH / 2;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '804', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, refuse, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  // --slow: the grid's first read of the template (its edge rows, before the session) gets an empty object and falls back to
  // road-level edges; every later request (the cells' admission) is held 45 s, then served for real
  let served = 0;
  if (slow) await ctx.route('**/shardfiles/_template/shard.json', async (route) => {
    if (served++ === 0) { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return; }
    await sleep(45000); await route.continue().catch(() => undefined);
  });
  if (refuse) await ctx.route('**/shardfiles/_template/shard.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); }); out.errors = errors;
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
  const cells = grid.cells.filter((c) => c.instance !== grid.home).map((c) => ({ ...c, ox: (c.cell[0] - home.cell[0]) * PITCH, oz: (c.cell[1] - home.cell[1]) * PITCH }));
  out.cells = cells.map((c) => [c.instance, c.slug, c.ox, c.oz]);
  const read = () => page.evaluate(() => { const g = window.__wildshard.shard.grid.state(); return { screens: g.screens, softWalls: g.softWalls, inside: g.inside }; });
  // stand `d` m off the cell's wall that faces home, at its midpoint entry, looking at it
  const pose = (cell, d, pitch) => {
    const onX = Math.abs(cell.ox) >= Math.abs(cell.oz), sx = Math.sign(cell.ox), sz = Math.sign(cell.oz);
    const x = onX ? cell.ox - sx * (WALL + d) : cell.ox, z = onX ? cell.oz : cell.oz - sz * (WALL + d);
    const dx = onX ? sx : 0, dz = onX ? 0 : sz;
    return { x, y: 2, z, yaw: Math.atan2(-dx, -dz), pitch };
  };
  const shot = async (name, p, wait = 2500) => {
    await page.evaluate((q) => window.__wildshard.pose({ name: 'grid', ...q }), p);
    await sleep(wait);
    out[name] = { pose: p, ...(await read()) }; console.log(name, JSON.stringify(out[name].screens));
    toJpeg(await page.screenshot(), `${name}.jpg`);
  };
  const edge = (c) => c.ox === 0 || c.oz === 0;
  if (slow) {
    const loading = cells.find((c) => c.slug === '_template');
    await shot('loading-road', pose(loading, ROAD - WALL, 0.02), 2500);
    await shot('loading-close', pose(loading, 13, 0.1));
    await shot('loading-landed', pose(loading, ROAD - WALL, 0.02), 50000);
  } else if (!refuse) {
    const waiting = cells.find((c) => c.slug === 'nalati-grasslands') ?? cells.find((c) => c.slug !== '_template' && edge(c));
    await shot('waiting-road', pose(waiting, ROAD - WALL, 0.02), 3500);
    await shot('waiting-close', pose(waiting, 13, 0.1));
  } else {
    const refused = cells.find((c) => c.slug === '_template');
    await shot('refused-road', pose(refused, ROAD - WALL, 0.02), 6000);
    await shot('refused-close', pose(refused, 13, 0.1));
  }
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(OUT, refuse ? 'capture-refuse.json' : slow ? 'capture-slow.json' : 'capture.json'), `${JSON.stringify(out, null, 2)}\n`);
}
