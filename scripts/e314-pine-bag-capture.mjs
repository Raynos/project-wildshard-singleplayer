#!/usr/bin/env node
import { saveFixture } from './debug-settings.mjs';
// e314-pine-bag-capture.mjs — E314 Pine Hollow Bag C evidence: iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier,
// muted, Metal) frames of Pine Hollow's Bag on one build, for a before / after sheet.
//
//   node scripts/e314-pine-bag-capture.mjs --url=http://127.0.0.1:4409 --out=<dir> --tag=before|after
//
// Run 1 (a seeded mid-game save: a 14-kind pack with the King's 'warden-longbow' flag, three finishes owned, a half-read
// journal): every Bag tab (MAP · GEAR · FINDS or the JOURNAL book · PACK · FEATS), GEAR scrolled to its FINISHES, a finish
// tapped, FINDS scrolled. Run 2 (a full 18-kind pack, no bow): the Antler King's grant (`__pineQuest.give` +
// `__loadout.grantLongbow`, what antlerKing.ts's reward does on each build), Mott's slate, then a reload and GEAR — the
// full-pack bug (the bow gone for good) or its fix. Writes <out>/<tag>-<scene>.jpg. Run it inside scripts/browser-lane.sh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4409');
const OUT = resolvePath(flag('out', '/tmp/e314-pine'));
const TAG = flag('tag', 'before');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const pack = (ids) => ({ counts: Object.fromEntries(ids.map(([id, n]) => [id, n])), order: ids.map(([id]) => id) });
const MID = {
  inventory: pack([['venison', 4], ['deer-hide', 3], ['boar-meat', 3], ['boar-hide', 1], ['boar-tusk', 2], ['antlers', 2], ['elk-meat', 2], ['elk-hide', 1],
    ['bear-pelt', 1], ['bear-claw', 1], ['amber-resin', 5], ['lodge-ribbon', 1], ['ironhide-tusk', 1], ['warden-longbow', 1]]),
  skins: { owned: ['hollow-ash', 'ghost-stag', 'ironhide'], worn: { crossbow: 'hollow-ash', rifle: 'ironhide' } },
  compendium: {
    'red-deer': { s: 3, n: 6, t: 3, b: 121 }, boar: { s: 3, n: 4, t: 2, b: 84 }, 'black-bear': { s: 3, n: 1, t: 1, b: 63 }, elk: { s: 2, n: 3, t: 0, b: 0 },
    'white-deer': { s: 1, n: 0, t: 0, b: 0 }, ironhide: { s: 3, n: 1, t: 1, b: 80 }, 'ghost-stag': { s: 3, n: 2, t: 1, b: 110 }, blackpaw: { s: 1, n: 0, t: 0, b: 0 },
    gate: { s: 2, n: 3, t: 0, b: 0 }, crossroads: { s: 2, n: 2, t: 0, b: 0 }, 'cabin-1': { s: 2, n: 2, t: 0, b: 0 }, hamlet: { s: 2, n: 1, t: 0, b: 0 },
    lodge: { s: 2, n: 1, t: 0, b: 0 }, mill: { s: 2, n: 1, t: 0, b: 0 }, pond: { s: 2, n: 1, t: 0, b: 0 }, bridge: { s: 1, n: 0, t: 0, b: 0 },
  },
};
// the full pack: 18 kinds, no bow (before: every slot taken; after: only the 7 kept kinds survive the load)
const FULL = {
  inventory: pack([['venison', 2], ['deer-hide', 2], ['boar-meat', 1], ['boar-hide', 1], ['boar-tusk', 1], ['antlers', 1], ['elk-meat', 1], ['elk-hide', 1], ['bear-pelt', 1],
    ['bear-claw', 1], ['amber-resin', 9], ['lodge-ribbon', 2], ['ironhide-tusk', 1], ['ghost-antler', 1], ['blackpaw-claw', 1], ['imperial-crown', 1], ['amber-heartwood', 1], ['crab-meat', 1]]),
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
async function run(seed, body) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  // seeded once per tab: a reload keeps what the game saved since (sessionStorage survives it, the seed does not re-run)
  for (const [key, data] of Object.entries(seed)) await saveFixture(ctx, { scope: 'pine-hollow', key, data, once: `e314-${key}` });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const load = async () => {
    await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
    await sleep(3000);
  };
  await page.goto(`${URL_BASE}/?chunk=pine-hollow&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await load();
  const shot = async (name) => { const f = resolvePath(OUT, `${TAG}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 82 })); console.log(f); };
  const tab = (want) => page.evaluate((w) => {
    const bag = document.querySelector('.ws-minimap-bag');
    if (!document.querySelector('.ws-gmenu.show')) bag?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const b = [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => !x.hidden && (x.dataset.tab === w || x.textContent.trim().toLowerCase() === w));
    if (!b) return false;
    b.click();
    return true;
  }, want);
  const scroll = (sel) => page.evaluate((s) => { const p = document.querySelector('.ws-gmenu-panel.active'); const t = document.querySelector(s); if (p && t) p.scrollTop = t.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 8; }, sel);
  const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await load(); };
  await body({ page, shot, tab, scroll, reload });
  await ctx.close();
}

try {
  await run(MID, async ({ page, shot, tab, scroll }) => {
    await page.evaluate(() => { const w = window.__wildshard.world.weapons; w.unlock('rifle'); w.select('crossbow', true); });
    for (const t of ['map', 'gear']) { if (await tab(t)) { await sleep(900); await shot(t); } }
    await scroll('.ws-gmenu-kitrow'); await sleep(400); await shot('gear-finishes');
    const tapped = await page.evaluate(() => { const b = [...document.querySelectorAll('.ws-gmenu-kitrow .ws-gmenu-kit')].find((x) => x.textContent.includes('Ghost Stag')); b?.click(); return b !== undefined; });
    if (tapped) { await sleep(500); await scroll('.ws-gmenu-kitrow'); await sleep(300); await shot('gear-finish-tapped'); }
    if (await tab('finds')) { await sleep(900); await shot('finds'); await scroll('.ws-gmenu-stickers.dense'); await sleep(400); await shot('finds-places'); }
    if (await tab('inventory')) { await sleep(900); await shot('pack'); }
    if (await tab('achievements')) { await sleep(900); await shot('feats'); }
    if (await tab('journal')) { await sleep(1400); await shot('journal'); } // before: the JOURNAL action tab opens the book
    // after: a FINDS sticker opens the book on its page (the Ghost Stag's)
    if (await tab('finds')) {
      await sleep(700);
      const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('.ws-gmenu-sticker.tap')].find((x) => x.textContent.includes('Ghost Stag')); b?.click(); return b !== undefined; });
      if (hit) { await sleep(1400); await shot('finds-tap'); }
    }
  });
  await run(FULL, async ({ page, shot, tab, reload }) => {
    await page.evaluate(() => { window.__pineQuest?.give('warden-longbow'); window.__loadout?.grantLongbow(); });
    await sleep(800);
    if (await tab('inventory')) { await sleep(700); await shot('full-pack'); }
    if (await tab('gear')) { await sleep(700); await shot('full-granted'); }
    await page.evaluate(() => { document.querySelector('.ws-gmenu-close')?.click(); window.__pineQuest?.openTrade(); });
    await sleep(900); await shot('full-trade');
    await reload();
    if (await tab('gear')) { await sleep(900); await shot('full-reloaded'); }
  });
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 4).join(' | ')}`);
} finally {
  await browser.close();
}
