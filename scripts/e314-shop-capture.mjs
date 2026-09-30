#!/usr/bin/env node
// e314-shop-capture.mjs — E314 stage 2 evidence: iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier, muted, Metal)
// frames of the trader's shop and what it sells, for one sheet.
//
//   node scripts/e314-shop-capture.mjs --url=http://127.0.0.1:4403 --out=<dir>
//
// Seeds a Driftwood save (30 coins, 4 sea glass found (under charm I's 5, so max health reads the hearts alone), the quest started) before the load, walks up to Maren's counter,
// then: the trade prompt · the shop on Whetstone I (affordable) · a real BUY tap (purse before / after, the card OWNED) ·
// Whetstone II short of coin · Heart II locked · a hit at max health 120 (VITALS 108 / 120) · the sea chart's marks on the
// MAP tab and the minimap · the cape in GEAR · a boar's coins in their last metres (a burst of frames). Prints the full
// clear, the swords' damage and a boar's hits to kill before / after the whetstones as JSON (<out>/numbers.json).
// Writes <out>/<scene>.jpg. Run it inside scripts/browser-lane.sh (one browser, closed at the end).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4403');
const OUT = resolvePath(flag('out', '/tmp/e314-shop'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const ID = 'chunk://local/driftwood-isle';
const seed = {
  'ws.purse.v1': { [ID]: 30 },
  'ws.owned.v1': { [ID]: { owned: [], worn: [] } },
  'ws.flags.v1': { [ID]: ['talked:castaway', 'glass:1', 'glass:2', 'glass:3', 'glass:5', 'seen:pier', 'seen:hut', 'seen:vista', 'seen:bridge'] },
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const numbers = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('e314-seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('e314-seeded', '1'); } } catch { /* */ } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=driftwood-isle&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && window.__loot !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
  await sleep(4000);
  const shot = async (name) => { const f = resolvePath(OUT, `${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 82 })); console.log(f); };

  numbers.fullClear = await page.evaluate(() => window.__loot.fullClear);
  numbers.census = await page.evaluate(() => { const by = {}; for (const a of window.__world.animals.animals) if (a.alive) by[a.kind] = (by[a.kind] ?? 0) + 1; return by; });
  const swordNumbers = () => page.evaluate(() => {
    const sword = window.__world.crossbow, boar = window.__world.animals.animals.find((a) => a.kind === 'boar');   // the base weapon: Driftwood's wooden sword
    const hp = boar?.maxHp ?? 0, dmg = sword.damage;
    return { weapon: 'wooden sword', damage: dmg, boarHp: hp, hitsToKill: dmg > 0 ? Math.ceil(hp / dmg) : null };
  });
  numbers.before = await swordNumbers();

  // ── walk up to her counter: stand 0.6 m behind the prompt point, facing her ──
  await page.evaluate(() => {
    const st = window.__adventure.trader, at = st.at, her = st.trader.position, w = window.__world;
    const dx = at.x - her.x, dz = at.z - her.z, d = Math.hypot(dx, dz);
    const px = at.x + (dx / d) * 0.6, pz = at.z + (dz / d) * 0.6;
    w.player.spawn(px, pz, Math.atan2(-(her.x - px), -(her.z - pz)));
  });
  await sleep(2500);
  await shot('01-prompt');
  numbers.prompt = await page.evaluate(() => document.querySelector('#hud .ws-game-prompt')?.textContent ?? '');

  // ── the shop: open through her prompt (E, the USE band's key), Whetstone I on the card, 30 coins ──
  await page.keyboard.press('e');
  await sleep(900);
  if (!(await page.evaluate(() => window.__adventure.trader.shop?.isOpen === true))) { console.log('E did not open the shop: opening it directly'); await page.evaluate(() => { window.__adventure.trader.shop?.open(); }); await sleep(700); }
  await shot('02-shop-affordable');
  const purse = () => page.evaluate(() => window.__loot.purse.coins);
  numbers.purseBefore = await purse();
  await page.tap('.ws-shop-buy');
  await sleep(700);
  numbers.purseAfter = await purse();
  await shot('03-shop-bought');
  await page.tap('.ws-shop-flip:last-of-type');   // › Whetstone II: 22 > 18 coins
  await sleep(500);
  await shot('04-shop-short');
  await page.evaluate(() => { window.__loot.shop.show(3); });   // Sturdy Heart II before Heart I: locked
  await sleep(400);
  await shot('05-shop-locked');

  // ── Sturdy Heart I (14 of the 18 left): close, one 12-point bite → VITALS 108 / 120 ──
  await page.evaluate(() => { window.__loot.shop.show(2); });
  await page.tap('.ws-shop-buy');
  await sleep(300);
  await page.tap('.ws-shop-close');
  await sleep(900);
  await page.evaluate(() => { const w = window.__world, a = w.animals.animals.find((x) => x.alive); if (a) w.animals.onCharge?.(a, 12); });
  await sleep(700);
  await shot('07-health');
  numbers.vitals = await page.evaluate(() => document.querySelector('.ws-game-vitals')?.textContent ?? '');

  // ── buy the rest with a topped-up purse (coins the island would pay) ──
  await page.evaluate(() => { window.__loot.coins(80); window.__loot.shop.open(); });
  await sleep(500);
  for (const i of [1, 3, 4, 5]) { await page.evaluate((k) => { window.__loot.shop.show(k); }, i); await page.tap('.ws-shop-buy'); await sleep(250); }
  await page.evaluate(() => { window.__loot.shop.show(5); });
  await sleep(400);
  await shot('06-shop-all-owned');
  numbers.owned = await page.evaluate(() => window.__loot.owned.all);
  await page.tap('.ws-shop-close');
  await sleep(900);
  numbers.after = await swordNumbers();

  numbers.maxHealthAfter = await page.evaluate(() => document.querySelector('.ws-game-hval small')?.textContent ?? '');

  // ── the sea chart: the MAP tab and the minimap ──
  await shot('08-minimap');
  await page.evaluate(() => { document.querySelector('.ws-minimap-bag')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
  await sleep(600);
  await page.evaluate(() => { [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => x.dataset.tab === 'map')?.click(); });
  await sleep(1200);
  await shot('09-map-chart');
  await page.evaluate(() => { [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => x.dataset.tab === 'finds')?.click(); });
  await sleep(800);
  await shot('10-finds');
  await page.evaluate(() => { [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => x.dataset.tab === 'gear')?.click(); });
  await sleep(800);
  await shot('11-gear-cape');
  await page.evaluate(() => { document.querySelector('.ws-gmenu-close')?.click(); });
  await sleep(800);

  // ── a boar's coins, their last metres: killed 5 m ahead, frames as they come in ──
  await page.evaluate(() => {
    const w = window.__world;
    w.player.spawn(w.player.position.x + 8, w.player.position.z - 14, w.player.yaw);   // open ground off the hut
  });
  await sleep(1500);
  await page.evaluate(() => {
    const w = window.__world, cam = w.game.camera, p = w.player.position;
    const a = w.animals.animals.find((x) => x.alive && x.kind === 'boar') ?? w.animals.animals.find((x) => x.alive && x.kind !== 'captain');
    if (!a) return;
    const d = cam.getWorldDirection(p.clone()); d.y = 0; d.normalize();
    a.position.set(p.x + d.x * 4, p.y, p.z + d.z * 4);
    for (let i = 0; i < 20 && a.alive; i++) a.applyDamage(Math.max(1, a.hp), a.position.clone().setY(p.y + 0.6), d);
  });
  const t0 = Date.now();
  for (let i = 10; i < 36; i++) { await shot(`12-coins-${i}-${Date.now() - t0}ms`); }
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 4).join(' | ')}`);
  numbers.errors = errors.slice(0, 6);
  writeFileSync(resolvePath(OUT, 'numbers.json'), JSON.stringify(numbers, null, 2));
  console.log(JSON.stringify(numbers));
  await ctx.close();
} finally {
  await browser.close();
}
