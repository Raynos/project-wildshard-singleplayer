#!/usr/bin/env node
// G170 (SHARD-PLATFORM SF46): Driftwood's entries over water are asphalt road decks. Captures the south entry with the
// "Driftwood hybrid boot" Debug row OFF (the legacy world) and ON (G164's lowered world with G170's decks), standalone
// (Select a shard), plus the same entry from the road in INFINITE WILDSHARD (row ON). The player is held every frame
// one eye height under each shot's eye, looking at its target (the first-person camera follows it).
//
//   scripts/serve-build.sh --name g170   → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh node art/driftwood-isle/round-18-road-decks/capture.mjs --url=http://127.0.0.1:<port>
//
// Chromium as an iPhone 16 Pro portrait, muted, phone tier. Writes the frames and board.jpg here.
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** camera poses (level metres): eye and target */
const SHOTS = {
  approach: { eye: [7, 3.2, -263], at: [0, -0.4, -236], label: 'South entry from the road' },
  side: { eye: [13, 3.4, -251], at: [0, -1.0, -241], label: 'The deck from the side' },
  walk: { eye: [0.6, 1.6, -247], at: [0, 1.0, -222], label: 'On the deck, walking in' },
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const frames = [];
async function shoot(page, name, tag) {
  const { eye, at } = SHOTS[name];
  await page.evaluate(({ eye, at }) => {
    // the camera follows the player: hold the player's feet one eye height under `eye`, its look at `at`, every frame
    const w = window.__wildshard.world, p = w.player, dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2];
    const eyeHeight = w.game.camera.position.y - p.position.y;
    const hold = { x: eye[0], y: eye[1] - eyeHeight, z: eye[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
    window.__g170Hold = hold;
    const tick = () => {
      if (window.__g170Hold !== hold) return;
      p.position.set(hold.x, hold.y, hold.z); p.velocity.set(0, 0, 0); p.yaw = hold.yaw; p.pitch = hold.pitch;
      requestAnimationFrame(tick);
    };
    tick();
  }, { eye, at });
  await sleep(2500);
  const file = join(OUT, `${name}-${tag}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
  frames.push({ file, text: `${SHOTS[name].label} · ${tag.toUpperCase()}` });
}
try {
  for (const row of ['off', 'on']) {
    const ctx = await browser.newContext({ ...PHONE });
    await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: row });
    const page = await ctx.newPage();
    await page.goto(`${url}/?chunk=driftwood-isle&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 300000, polling: 250 });
    await sleep(4000);
    for (const name of Object.keys(SHOTS)) if (row === 'on' || name !== 'walk') await shoot(page, name, row);
    await ctx.close();
  }
  { // the grid, row ON: Driftwood home, from the road south of it looking in
    const ctx = await browser.newContext({ ...PHONE });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: 'on' });
    const page = await ctx.newPage();
    await page.goto(`${url}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300000 });
    await page.locator('.ws-main-grid').waitFor({ timeout: 300000 });
    await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 300000, polling: 250 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.mouse.click(195, 420).catch(() => undefined);
    await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
    await sleep(3000);
    await shoot(page, 'approach', 'grid');
    await shoot(page, 'side', 'grid');
    await shoot(page, 'walk', 'grid');
    await ctx.close();
  }
  const tiles = frames.map(({ file, text }, i) => {
    const tile = join(OUT, `.tile-${i}.png`);
    execFileSync('magick', [file, '-resize', '380x', '-gravity', 'north', '-background', '#111', '-splice', '0x30', '-fill', '#eee', '-pointsize', '15', '-annotate', '+0+7', text, tile]);
    return tile;
  });
  // columns: OFF, ON, grid ON; rows: approach, side, walk (OFF has no walk frame: its socket lies under the legacy pier)
  const order = [0, 2, 5, 1, 3, 6, null, 4, 7].map((i) => (i === null ? 'xc:#111' : tiles[i]));
  execFileSync('magick', ['montage', ...order, '-tile', '3x3', '-geometry', '+4+4', '-background', '#111', '-quality', '80', join(OUT, 'board.jpg')]);
  execFileSync('rm', ['-f', ...tiles]);
} finally { await browser.close(); }
console.log(frames.map((f) => f.file).join('\n'));
