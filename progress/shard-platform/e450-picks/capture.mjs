#!/usr/bin/env node
// SHARD-PLATFORM E450 picks G173 / G175 / G181: the new defaults in a real browser, no Debug row set (the rows are gone).
// Chromium as an iPhone 16 Pro portrait, muted, phone tier.
//
//   scripts/serve-build.sh --rev <sha> --name e450-picks   → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/e450-picks/capture.mjs --url=http://127.0.0.1:<port>
//
// - G173 Driftwood: the pier spawn with the GPU-only copies and the island instancing (the island's
//   InstancedMesh count and the released-array count read back), then Maren's counter and a pickup (G181).
// - G181 Pine Hollow: Mott's stall as the G87 sheet (no slate), with a few hides and resin in the pack.
// - G175 grid: INFINITE WILDSHARD (Developer on), on the road and inside Driftwood: the frame owner built and reading.
// Writes the JPEGs and capture.json here.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const out = { url, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function open(slug) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?chunk=${slug}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await sleep(5000);
  return { ctx, page, errors };
}

const pickup = (page) => page.evaluate(() => {
  const w = window.__wildshard.world, row = w.weapons.list.at(-1).row;
  w.hud.pickupCard({ name: row.ui.name, icon: row.ui.icon });
  const pop = document.querySelector('.ws-icard-pop');
  return { name: pop?.querySelector('.ws-icard-name')?.textContent ?? null, accent: pop?.style.getPropertyValue('--ws-accent') ?? null };
});

try {
  // ── Driftwood (G173 + G181) ──
  {
    const { ctx, page, errors } = await open('driftwood-isle');
    out.driftwoodIsland = await page.evaluate(() => {
      const g = window.__wildshard.world.game.scene.children.find((o) => o.name === 'blender-island');
      let instanced = 0, merged = 0, released = 0, kept = 0;
      g?.traverse((o) => {
        if (o.isInstancedMesh) instanced++; else if (o.isMesh && /^island-(casters|cover)/u.test(o.name)) merged++;
        const c = o.isInstancedMesh ? o.geometry.getAttribute('color') : null;
        if (c) { if (c.array.length === 0) released++; else kept++; }
      });
      return { instanced, merged, colourReleased: released, colourKept: kept };
    });
    console.log('driftwood island', JSON.stringify(out.driftwoodIsland));
    toJpeg(await page.screenshot(), 'driftwood-pier.jpg');
    out.driftwoodPickup = await pickup(page); await sleep(700);
    toJpeg(await page.screenshot(), 'driftwood-pickup.jpg');
    await sleep(3500);
    const stand = await page.evaluate(() => {
      const s = window.__wildshard.shard['driftwood.adventure'].trader, her = s.trader.position;
      return { x: s.at.x, z: s.at.z, yaw: Math.atan2(-(her.x - s.at.x), -(her.z - s.at.z)) };
    });
    await page.evaluate(() => { window.__wildshard.shard['driftwood.loot'].coins(40); });
    await page.evaluate((p) => window.__wildshard.pose({ name: 'trader', x: p.x, z: p.z, yaw: p.yaw, pitch: -0.32 }), stand);
    await sleep(1500);
    await page.evaluate(() => { window.__wildshard.shard['driftwood.loot'].shop.open(); });
    await sleep(1500);
    out.driftwoodShop = await page.evaluate(() => ({ open: document.querySelector('.ws-shop.show') !== null, big: document.querySelector('.ws-shop.show .ws-shop-big') !== null,
      classic: document.querySelector('.ws-shop-sheet, .ws-shop-card') !== null, buy: document.querySelector('.ws-shop-bigbuy')?.textContent ?? null }));
    console.log('driftwood shop', JSON.stringify(out.driftwoodShop));
    toJpeg(await page.screenshot(), 'driftwood-shop.jpg');
    out.driftwoodErrors = errors;
    await ctx.close();
  }
  // ── Pine Hollow: Mott's stall (G181) ──
  {
    const { ctx, page, errors } = await open('pine-hollow');
    const stand = await page.evaluate(() => {
      const q = window.__wildshard.shard['pine.quest'], mott = q.people.find((p) => p.kind === 'trader');
      q.give('deer-hide', 3); q.give('amber-resin', 4); q.give('boar-hide', 1); q.give('venison', 1);
      const at = mott.prompt.position, him = mott.fig.group.position;
      const dx = at.x - him.x, dz = at.z - him.z, d = Math.hypot(dx, dz) || 1;
      const x = him.x + (dx / d) * 2.6, z = him.z + (dz / d) * 2.6;
      return { x, z, yaw: Math.atan2(-(him.x - x), -(him.z - z)) };
    });
    await page.evaluate((p) => window.__wildshard.pose({ name: 'trader', x: p.x, z: p.z, yaw: p.yaw, pitch: -0.12 }), stand);
    await sleep(1500);
    await page.evaluate(() => { window.__wildshard.shard['pine.quest'].openTrade(); });
    await sleep(1200);
    out.pineTrader = await page.evaluate(() => ({ big: document.querySelector('.ws-shop.show .ws-shop-big') !== null, slate: document.querySelector('.ws-slate') !== null,
      tiles: [...document.querySelectorAll('.ws-shop.show .ws-icard-name')].map((t) => t.textContent), buy: document.querySelector('.ws-shop.show .ws-shop-bigbuy')?.textContent ?? null,
      accent: document.querySelector('.ws-shop.show')?.style.getPropertyValue('--ws-accent') ?? null }));
    console.log('pine trader', JSON.stringify(out.pineTrader));
    toJpeg(await page.screenshot(), 'pine-trader.jpg');
    out.pineErrors = errors;
    await ctx.close();
  }
  // ── the grid (G175): no row saved, the frame owner is built ──
  {
    const ctx = await browser.newContext({ ...PHONE });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
    await page.goto(`${url}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300000 });
    await page.locator('.ws-main-grid').waitFor({ timeout: 300000 });
    await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 300000, polling: 250 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.mouse.click(195, 420).catch(() => undefined);
    await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
    await sleep(3000);
    const SHOTS = { road: { eye: [277.5, 1.7, 30], at: [277.5, 2.5, -200] }, inside: { eye: [190, 1.7, 12], at: [400, 4, 0] } };
    out.gridRow = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.['debug.global.gridOneFrame'] ?? null; } catch { return 'unreadable'; } });
    for (const [name, { eye, at }] of Object.entries(SHOTS)) {
      await page.evaluate(({ eye, at }) => {
        const w = window.__wildshard.world, p = w.player, dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2];
        const eyeHeight = w.game.camera.position.y - p.position.y;
        const hold = { x: eye[0], y: eye[1] - eyeHeight, z: eye[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
        window.__e450Hold = hold;
        const tick = () => {
          if (window.__e450Hold !== hold) return;
          p.position.set(hold.x, hold.y, hold.z); p.velocity.set(0, 0, 0); p.yaw = hold.yaw; p.pitch = hold.pitch;
          requestAnimationFrame(tick);
        };
        tick();
      }, { eye, at });
      await sleep(3000);
      toJpeg(await page.screenshot(), `grid-${name}.jpg`);
      out[`grid-${name}`] = await page.evaluate(() => window.__wildshard.shard.grid.state().frame ?? null);
      console.log('grid', name, JSON.stringify(out[`grid-${name}`]));
    }
    out.gridErrors = errors;
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'capture.json'), `${JSON.stringify(out, null, 2)}\n`);
}
