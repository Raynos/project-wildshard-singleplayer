#!/usr/bin/env node
// SF19a re-aimed by G158 (SHARD-PLATFORM): the shard you stand in owns the whole frame, the road look owns the road.
// INFINITE WILDSHARD (Settings ▸ Developer on, so Signal Dunes is the home cell's west neighbour) entered twice,
// Settings ▸ Debug ▸ "Grid one frame" off then on, posed (home-frame metres; Driftwood is the home, Signal Dunes'
// cell centre is x = −555, its east edge x = −305):
//   in-driftwood  inside Driftwood looking west at Signal Dunes
//   in-dunes      inside Signal Dunes (on its east entry asphalt) looking east at Driftwood
//   road          mid-strip on the road deck looking west at Signal Dunes
//   cross-road / cross-line / cross-dunes (row on only): 10 m out, on the cell edge, 10 m in, looking west
// The player is frozen after each pose (the world's free-camera flag), so a cell without colliders yet (a far proxy)
// holds the pose; the grid readout (`__wildshard.shard.grid.state().frame`) is kept beside each shot.
//
//   scripts/serve-build.sh --name sf19a-owner   → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node art/grid/sf19a-frame-owner/board.mjs --url=http://127.0.0.1:<port>
//
// Chromium as an iPhone 16 Pro portrait, muted, render scale as shipped. Writes board.json, owner-board.jpg and
// crossing-strip.jpg here.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: board.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const scratch = mkdtempSync(join(tmpdir(), 'sf19a-owner-'));
const WEST = { x: -2000, z: 0 }, EAST = { x: 2000, z: 0 };
const POSES = {
  'in-driftwood': { x: -200, y: 1.5, z: 6, look: WEST, pitch: -0.03, label: 'Inside Driftwood → Signal Dunes' },
  'in-dunes': { x: -345, y: 1.5, z: 6, look: EAST, pitch: -0.03, label: 'Inside Signal Dunes → Driftwood' },
  road: { x: -277.5, y: 1.5, z: 40, look: WEST, pitch: -0.03, label: 'On the road → Signal Dunes' },
  'cross-road': { x: -295, y: 1.5, z: 6, look: WEST, pitch: -0.03, label: '10 m out: road look', only: 'on' },
  'cross-line': { x: -305, y: 1.5, z: 6, look: WEST, pitch: -0.03, label: 'On the cell edge: half', only: 'on' },
  'cross-dunes': { x: -315, y: 1.5, z: 6, look: WEST, pitch: -0.03, label: '10 m in: Signal Dunes', only: 'on' },
};
const out = { url, started: new Date().toISOString(), runs: {} };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const row of ['off', 'on']) {
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(ctx, { scope: 'device', key: 'debug.global.gridOneFrame', data: row });
    await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
    await page.goto(`${url}/?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
    await sleep(800);
    await page.click('.ws-main-grid');
    await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 500 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await sleep(1500);
    const run = { errors, shots: {} };
    for (const [name, { look, label, only, ...pose }] of Object.entries(POSES)) {
      if (only !== undefined && only !== row) continue;
      const dir = async (yaw) => page.evaluate(async (p) => {
        window.__wildshard.world.freeCamera = false;
        await window.__wildshard.pose({ name: 'grid', ...p });
        await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); }); // the camera follows the pose next frame
        const cam = window.__wildshard.world.game.camera, v = cam.getWorldDirection(cam.position.clone());
        return Math.atan2(v.x, v.z);
      }, { ...pose, yaw });
      const a0 = await dir(0), a1 = await dir(Math.PI / 2), turn = Math.sign(Math.sin(a1 - a0)) || 1;
      const yaw = (Math.atan2(look.x - pose.x, look.z - pose.z) - a0) * turn;
      await page.evaluate(async (p) => {
        await window.__wildshard.pose({ name: 'grid', ...p });
        await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(() => { requestAnimationFrame(r); }); }); });
        window.__wildshard.world.freeCamera = true; // hold the pose: the player and camera stop updating, the frame keeps drawing
      }, { ...pose, yaw });
      await sleep(2500); // the rings settle at this spot
      const png = join(scratch, `${row}-${name}.png`);
      writeFileSync(png, await page.screenshot());
      run.shots[name] = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { feet: s.feet, frame: s.frame, cells: s.cells.map((c) => `${c.slug}:${c.shows}`) }; });
    }
    out.runs[row] = run;
    await ctx.close();
  }
  const tile = (row, name, text) => {
    const file = join(scratch, `tile-${row}-${name}.png`);
    execFileSync('magick', [join(scratch, `${row}-${name}.png`), '-resize', '400x', '-gravity', 'north', '-background', '#111', '-splice', '0x34', '-fill', '#eee', '-pointsize', '17', '-annotate', '+0+8', text, file]);
    return file;
  };
  // the owner board: rows = the three places, columns = the row off / on
  const tiles = [];
  for (const name of ['in-driftwood', 'in-dunes', 'road']) for (const row of ['off', 'on']) tiles.push(tile(row, name, `${POSES[name].label} · ${row.toUpperCase()}`));
  execFileSync('magick', ['montage', ...tiles, '-tile', '2x3', '-geometry', '+4+4', '-background', '#111', '-quality', '78', join(OUT, 'owner-board.jpg')]);
  // the crossing strip: three frames walking west over Signal Dunes' east edge, row on
  const strip = ['cross-road', 'cross-line', 'cross-dunes'].map((name) => tile('on', name, POSES[name].label));
  execFileSync('magick', ['montage', ...strip, '-tile', '3x1', '-geometry', '+4+4', '-background', '#111', '-quality', '78', join(OUT, 'crossing-strip.jpg')]);
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); }
finally { await browser.close(); rmSync(scratch, { recursive: true, force: true }); }
writeFileSync(join(OUT, 'board.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ error: out.error, off: out.runs.off?.errors?.length, on: out.runs.on?.errors?.length, frames: Object.fromEntries(Object.entries(out.runs.on?.shots ?? {}).map(([k, v]) => [k, v.frame && { owner: v.frame.owner, highway: v.frame.highway, weights: v.frame.weights, grade: v.frame.grade }])) }));
