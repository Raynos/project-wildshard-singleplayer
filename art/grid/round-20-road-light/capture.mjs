#!/usr/bin/env node
// G165 (SHARD-PLATFORM SF19a / SF19b; Jake's pick "A, road light over everything", art/grid/round-17-road-view/board.jpg):
// outside the cell you stand in, everything is under the neutral road look, sky included. INFINITE WILDSHARD (Settings ▸
// Developer on; Driftwood home, Nalati east, Signal Dunes west), Settings ▸ Debug ▸ "Grid one frame" OFF then ON. The
// player is held every frame one eye height under each shot's eye, looking at its target (the camera follows it):
//   road     on the east boulevard south of the Driftwood / Nalati crossroads, looking south: Nalati left, Driftwood right
//   aerial   60 m over the same road, looking south-west over Driftwood's cell
//   inside   inside Driftwood looking east at the road and Nalati (the home's own sky)
//
//   scripts/serve-build.sh --name g165   → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh node art/grid/round-20-road-light/capture.mjs --url=http://127.0.0.1:<port>
//
// Chromium as an iPhone 16 Pro portrait, muted, phone tier. Writes the frames, frames.json and board.jpg here.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const SHOTS = {
  road: { eye: [277.5, 1.7, 30], at: [277.5, 2.5, -200], label: 'On the road, looking south' },
  aerial: { eye: [300, 60, 120], at: [80, 0, -120], label: 'Over the road' },
  inside: { eye: [190, 1.7, 12], at: [400, 4, 0], label: 'Inside Driftwood, looking east' },
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const frames = [], readout = {};
try {
  for (const row of ['off', 'on']) {
    const ctx = await browser.newContext({ ...PHONE });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(ctx, { scope: 'device', key: 'debug.global.gridOneFrame', data: row });
    const page = await ctx.newPage();
    await page.goto(`${url}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300000 });
    await page.locator('.ws-main-grid').waitFor({ timeout: 300000 });
    await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 300000, polling: 250 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.mouse.click(195, 420).catch(() => undefined);
    await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
    await sleep(3000);
    for (const [name, { eye, at, label }] of Object.entries(SHOTS)) {
      await page.evaluate(({ eye, at }) => {
        const w = window.__wildshard.world, p = w.player, dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2];
        const eyeHeight = w.game.camera.position.y - p.position.y;
        const hold = { x: eye[0], y: eye[1] - eyeHeight, z: eye[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
        window.__g165Hold = hold;
        const tick = () => {
          if (window.__g165Hold !== hold) return;
          p.position.set(hold.x, hold.y, hold.z); p.velocity.set(0, 0, 0); p.yaw = hold.yaw; p.pitch = hold.pitch;
          requestAnimationFrame(tick);
        };
        tick();
      }, { eye, at });
      await sleep(3000);
      const file = join(OUT, `${name}-${row}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
      frames.push({ file, text: `${label} · one frame ${row.toUpperCase()}` });
      readout[`${name}-${row}`] = await page.evaluate(() => window.__wildshard.shard.grid.state().frame ?? null);
    }
    await ctx.close();
  }
  const tiles = frames.map(({ file, text }, i) => {
    const tile = join(OUT, `.tile-${i}.png`);
    execFileSync('magick', [file, '-resize', '380x', '-gravity', 'north', '-background', '#111', '-splice', '0x30', '-fill', '#eee', '-pointsize', '15', '-annotate', '+0+7', text, tile]);
    return tile;
  });
  // rows: road, aerial, inside; columns: OFF, ON
  const order = [0, 3, 1, 4, 2, 5].map((i) => tiles[i]);
  execFileSync('magick', ['montage', ...order, '-tile', '2x3', '-geometry', '+4+4', '-background', '#111', '-quality', '80', join(OUT, 'board.jpg')]);
  execFileSync('rm', ['-f', ...tiles]);
} finally { await browser.close(); }
writeFileSync(join(OUT, 'frames.json'), `${JSON.stringify(readout, null, 2)}\n`);
console.log(JSON.stringify(readout));
