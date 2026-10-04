#!/usr/bin/env node
// SF19a's board (SHARD-PLATFORM, one frame for the grid): EXPERIMENTAL Wildshard (Settings ▸ Developer on, so the dev
// cells Signal Dunes and Sky Reach are in) entered twice, Settings ▸ Debug ▸ "Grid one frame" off then on, posed at the
// north-east crossroads (Driftwood, Nalati, Pine Hollow, a template) and the south-west corner crossroads (Driftwood,
// Signal Dunes, Sky Reach, a template); the grid readout (`__wildshard.shard.grid.state()`) is kept beside each shot.
//
//   scripts/serve-build.sh --name sf19a       → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/sf19a/frame-board.mjs --url=http://127.0.0.1:<port>
//
// Chromium as an iPhone 16 Pro portrait, muted, render scale as shipped. Writes frame-board.json, frame-board.jpg here.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: frame-board.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const scratch = mkdtempSync(join(tmpdir(), 'sf19a-'));
// each pose stands on a highway strip looking along it at a crossroads: the strip's two cells either side, the two beyond
// the crossroads ahead (the yaw is solved from the camera's own direction, so the harness's yaw convention does not matter)
const POSES = {
  crossroads: { x: 277.5, y: 2, z: -150, look: { x: 277.5, z: 700 }, pitch: -0.02 },
  corner: { x: -277.5, y: 2, z: 150, look: { x: -277.5, z: -700 }, pitch: -0.02 },
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
    await page.goto(`${url}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-menu-entry-grid', { timeout: 120000 });
    await sleep(800);
    await page.click('.ws-menu-entry-grid');
    await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 500 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await sleep(1500);
    const run = { errors, shots: {} };
    for (const [name, { look, ...pose }] of Object.entries(POSES)) {
      const dir = async (yaw) => page.evaluate(async (p) => {
        await window.__wildshard.pose({ name: 'grid', ...p });
        await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); }); // the camera follows the pose next frame
        const cam = window.__wildshard.world.game.camera, v = cam.getWorldDirection(cam.position.clone());
        return Math.atan2(v.x, v.z);
      }, { ...pose, yaw });
      const a0 = await dir(0), a1 = await dir(Math.PI / 2), turn = Math.sign(Math.sin(a1 - a0)) || 1;
      const yaw = (Math.atan2(look.x - pose.x, look.z - pose.z) - a0) * turn;
      await sleep(1200); // the rings settle at this spot
      await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), { ...pose, yaw });
      await sleep(250); // before the fall takes the camera far from the pose
      const png = join(scratch, `${row}-${name}.png`);
      writeFileSync(png, await page.screenshot());
      run.shots[name] = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { frame: s.frame, cells: s.cells.map((c) => `${c.slug}:${c.shows}`) }; });
    }
    out.runs[row] = run;
    await ctx.close();
  }
  // the board: rows = the two poses, columns = the row off / on, labelled; portrait cells at 400 px wide
  const label = (row, name) => `${name === 'crossroads' ? 'East strip → NE crossroads' : 'West strip → SW crossroads'} · Grid one frame ${row.toUpperCase()}`;
  const tiles = [];
  for (const name of Object.keys(POSES)) for (const row of ['off', 'on']) {
    const tile = join(scratch, `tile-${row}-${name}.png`);
    execFileSync('magick', [join(scratch, `${row}-${name}.png`), '-resize', '400x', '-gravity', 'north', '-background', '#111', '-splice', '0x34', '-fill', '#eee', '-pointsize', '18', '-annotate', '+0+7', label(row, name), tile]);
    tiles.push(tile);
  }
  execFileSync('magick', ['montage', ...tiles, '-tile', '2x2', '-geometry', '+4+4', '-background', '#111', '-quality', '80', join(OUT, 'frame-board.jpg')]);
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); }
finally { await browser.close(); rmSync(scratch, { recursive: true, force: true }); }
writeFileSync(join(OUT, 'frame-board.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ error: out.error, off: out.runs.off?.errors?.length, on: out.runs.on?.errors?.length, frame: out.runs.on?.shots?.crossroads?.frame }));
