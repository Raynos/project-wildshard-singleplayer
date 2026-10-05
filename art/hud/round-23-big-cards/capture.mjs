#!/usr/bin/env node
// SHARD-PLATFORM SF28 (Jake's G87 / G104): the big item cards in three shard accents, proven in a real browser — Chromium
// as an iPhone 16 Pro portrait, muted, pause ▸ Settings ▸ Debug ▸ Look ▸ Item cards = Big (saved before the load).
//
//   scripts/serve-build.sh --rev <sha> --name sf28-cards   → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 30 node art/hud/round-23-big-cards/capture.mjs --url=http://127.0.0.1:<port>
//
// Driftwood (MARIGOLD): walks to the trader, presses USE and shoots her counter as the G87 sheet (and once in Classic);
// then, in Driftwood, Pine Hollow (MOSS) and Nalati (EMBER), the pickup card of one of that shard's own equipment rows
// (the HUD's platform pickup path, hud.pickupCard). Writes capture.json (accent, card text) beside the images.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { debugSettings } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
if (url === '') { console.error('usage: capture.mjs --url=<build>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const toJpeg = (png, name) => {
  const jpg = join(OUT, name), tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', '603', tmp, '--out', jpg], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
};
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=all').slice(7);
const out = { url, started: new Date().toISOString() };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function open(slug, cards) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
  await debugSettings(ctx, { itemCards: cards });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?chunk=${slug}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await sleep(5000);
  return { ctx, page, errors };
}

/** the pickup card for the shard's last equipment row (a found one), as the platform's pickup path shows it */
async function pickup(page, name) {
  const got = await page.evaluate(() => {
    const w = window.__wildshard.world, row = w.weapons.list.at(-1).row;
    w.hud.pickupCard({ name: row.ui.name, icon: row.ui.icon }, `${row.ui.name} found`);
    const pop = document.querySelector('.ws-icard-pop');
    return { name: pop?.querySelector('.ws-icard-name')?.textContent ?? null, accent: pop?.style.getPropertyValue('--ws-accent') ?? null, cardAccent: w.hud.cardAccent };
  });
  await sleep(700);
  toJpeg(await page.screenshot(), name);
  return got;
}

try {
  // ── Driftwood: the trader's counter as the G87 sheet, then Classic, then a pickup card ──
  for (const cards of only === 'all' || only === 'driftwood' ? ['big', 'classic'] : []) {
    const { ctx, page, errors } = await open('driftwood-isle', cards);
    const stand = await page.evaluate(() => {
      const s = window.__wildshard.shard['driftwood.adventure'].trader, her = s.trader.position;
      return { x: s.at.x, z: s.at.z, yaw: Math.atan2(-(her.x - s.at.x), -(her.z - s.at.z)) };
    });
    await page.evaluate(() => { window.__wildshard.shard['driftwood.loot'].coins(40); });
    await page.evaluate((p) => window.__wildshard.pose({ name: 'trader', x: p.x, z: p.z, yaw: p.yaw, pitch: -0.32 }), stand);
    await sleep(1500);
    // facing her at the counter (the pose above is the stall's own SHOP_PITCH view), open her shop
    await page.evaluate(() => { window.__wildshard.shard['driftwood.loot'].shop.open(); });
    await sleep(1500);
    const shop = await page.evaluate(() => ({ open: document.querySelector('.ws-shop.show') !== null, big: document.querySelector('.ws-shop-big') !== null,
      tiles: [...document.querySelectorAll('.ws-shop-grid .ws-icard-tile')].map((t) => t.className),
      buy: document.querySelector('.ws-shop-bigbuy')?.textContent ?? document.querySelector('.ws-shop-buy')?.textContent ?? null,
      accent: document.querySelector('.ws-shop')?.style.getPropertyValue('--ws-accent') ?? null }));
    out[`driftwood-shop-${cards}`] = shop; console.log(cards, JSON.stringify(shop));
    toJpeg(await page.screenshot(), `driftwood-shop-${cards}.jpg`);
    if (cards === 'big') {
      await page.keyboard.press('ArrowRight'); await sleep(400);
      toJpeg(await page.screenshot(), 'driftwood-shop-big-2.jpg');
      await page.keyboard.press('Escape'); await sleep(800);
      await page.evaluate(() => window.__wildshard.pose({ name: 'beach', pitch: -0.05 }));
      await sleep(1500);
      out['driftwood-pickup'] = await pickup(page, 'driftwood-pickup.jpg'); console.log('driftwood pickup', JSON.stringify(out['driftwood-pickup']));
    }
    out[`driftwood-${cards}-errors`] = errors;
    await ctx.close();
  }
  // ── Pine Hollow (MOSS) and Nalati (EMBER): the pickup card at the spawn ──
  for (const [slug, file] of only === 'driftwood' ? [] : [['pine-hollow', 'pine-pickup.jpg'], ['nalati-grasslands', 'nalati-pickup.jpg']]) {
    const { ctx, page, errors } = await open(slug, 'big');
    await page.evaluate(() => window.__wildshard.pose({ name: 'spawn', pitch: -0.05 }));
    await sleep(1500);
    out[slug] = { ...(await pickup(page, file)), errors }; console.log(slug, JSON.stringify(out[slug]));
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, only === 'all' ? 'capture.json' : `capture-${only}.json`), `${JSON.stringify(out, null, 2)}\n`);
}
