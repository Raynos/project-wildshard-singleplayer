#!/usr/bin/env node
// e314-nalati-bag-capture.mjs — E314 Nalati Bag C evidence: iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier,
// muted, Metal) frames of Nalati's Bag on one build, for a before / after sheet.
//
//   node scripts/e314-nalati-bag-capture.mjs --url=http://127.0.0.1:4409 --out=<dir> --tag=before|after
//
// Run 1 (a seeded mid-game save: a 9-kind pack of the old junk, Aqbars + Kokbori felled and their skins owned, the Golden
// Bow taken, 5 places seen): every Bag tab (MAP · GEAR · FINDS · PACK · FEATS), GEAR scrolled to its SKINS row, FINDS
// scrolled to its places. Run 2 (Argymaq tamed: the bonded horse is him, his elite retired): FINDS' elites and what the
// elite system handed the skin locker (`__elites.skins`). Run 3: a wild horse killed at your feet — the "[E] Harvest"
// prompt or none. Writes <out>/<tag>-<scene>.jpg (+ <tag>-notes.json). Run it inside scripts/browser-lane.sh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4409');
const OUT = resolvePath(flag('out', '/tmp/e314-nalati'));
const TAG = flag('tag', 'before');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const NALATI = 'chunk://local/nalati-grasslands';
const notes = {};

const pack = (ids) => ({ counts: Object.fromEntries(ids.map(([id, n]) => [id, n])), order: ids.map(([id]) => id) });
const elite = (o) => ({ timer: 0, discovered: true, skinTaken: true, kills: 1, retired: false, ...o });
const MID = {
  'ws.inventory.v1': { [NALATI]: pack([['wolf-pelt', 6], ['wolf-fang', 13], ['horsehair', 3], ['stone-shard', 5], ['grave-dust', 2], ['marmot-fur', 1],
    ['leopard-pelt', 1], ['grey-mother-pelt', 1], ['gold-plaque', 1]]) },
  'ws.elites.v1': { aqbars: elite({}), kokbori: elite({}) },
  'ws.nalati.skins.v1': { owned: ['irbis-sabre', 'sky-wolf-bow'], worn: { sabre: 'irbis-sabre', bow: 'sky-wolf-bow' } },
  'ws.boss.v1': { 'nalati-grasslands#golden-king': { defeated: true, rewardTaken: true, kills: 1 } },
  'ws.flags.v1': { [NALATI]: ['talked:elder', 'seen:nomad-camp', 'seen:sheep-pasture', 'seen:bridge', 'seen:kunes-river', 'seen:horse-plains', 'felled:aqbars', 'felled:kokbori'] },
};
const ARGYMAQ = {
  ...MID,
  'ws.elites.v1': { aqbars: elite({}), kokbori: elite({}), argymaq: elite({ retired: true }) },
  'ws.nalati.tulpar': 'argymaq',
  'ws.flags.v1': { [NALATI]: [...MID['ws.flags.v1'][NALATI], 'tamed:horse', 'tamed:argymaq', 'felled:argymaq'] },
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
async function run(seed, body) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('e314-seeded') === null) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); sessionStorage.setItem('e314-seeded', '1'); } } catch { /* */ } }, seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
  await sleep(4000);
  const shot = async (name) => { const f = resolvePath(OUT, `${TAG}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 82 })); console.log(f); };
  const tab = (want) => page.evaluate((w) => {
    const bag = document.querySelector('.ws-minimap-bag');
    if (!document.querySelector('.ws-gmenu.show')) bag?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const b = [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => !x.hidden && (x.dataset.tab === w || x.textContent.trim().toLowerCase() === w));
    if (!b) return false;
    b.click();
    return true;
  }, want);
  const scroll = (sel, last = false) => page.evaluate(([s, l]) => { const p = document.querySelector('.ws-gmenu-panel.active'); const all = [...document.querySelectorAll(s)]; const t = l ? all[all.length - 1] : all[0]; if (p && t) p.scrollTop = t.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 24; }, [sel, last]);
  const tabs = () => page.evaluate(() => [...document.querySelectorAll('.ws-gmenu-tab')].filter((x) => !x.hidden).map((x) => x.textContent.trim()));
  await body({ page, shot, tab, scroll, tabs });
  await ctx.close();
}

try {
  await run(MID, async ({ page, shot, tab, scroll, tabs }) => {
    await page.evaluate(() => { window.__world.weapons.select('bow', true); });
    for (const t of ['map', 'gear']) { if (await tab(t)) { await sleep(900); await shot(t); } }
    notes.bagTabs = await tabs();
    await scroll('.ws-gmenu-kitrow', true); await sleep(400); await shot('gear-skins');
    notes.skinsRow = await page.evaluate(() => [...document.querySelectorAll('.ws-gmenu-kitrow')].at(-1)?.textContent.replaceAll(/\s+/g, ' ').trim());
    if (await tab('finds')) { await sleep(900); await shot('finds'); await scroll('.ws-gmenu-stickers.dense'); await sleep(400); await shot('finds-places'); }
    if (await tab('inventory')) { await sleep(900); await shot('pack'); }
    if (await tab('achievements')) { await sleep(900); await shot('feats'); }
  });
  await run(ARGYMAQ, async ({ page, shot, tab }) => {
    await sleep(2500); // the skins mirror runs once a second
    notes.argymaq = await page.evaluate(() => ({ eliteSkins: [...(window.__elites?.skins ?? [])], lockerOwned: [...(window.__world?.nalati?.skins.owned ?? [])] }));
    if (await tab('finds')) { await sleep(900); await shot('argymaq-finds'); }
    if (!(await page.evaluate(() => document.querySelector('.ws-gmenu-tab[data-tab="finds"]') !== null && !document.querySelector('.ws-gmenu-tab[data-tab="finds"]').hidden)) && await tab('gear')) {
      await sleep(900); await shot('argymaq-gear'); // before: no FINDS tab — GEAR's skins are what Argymaq's win shows
    }
  });
  await run(MID, async ({ page, shot }) => {
    // a wild horse (not a camp or bonded one) killed at your feet, you facing it
    const got = await page.evaluate(() => {
      const w = window.__world, p = w.player;
      const a = w.animals.animals.find((x) => x.kind === 'horse' && x.alive && x.mem.owned !== 1 && x.mem.camp !== 1 && x.herd !== -1)
        ?? w.animals.animals.find((x) => x.kind === 'marmot' && x.alive);
      if (!a) return null;
      p.position.set(a.position.x + 1.6, a.position.y, a.position.z + 1.6);
      p.yaw = Math.atan2(1.6, 1.6); p.pitch = -0.35;
      a.applyDamage(99999, a.position.clone(), a.position.clone().sub(p.position).normalize());
      window.__e314Carcass = a;
      return { kind: a.kind, variant: a.variant, label: a.label };
    });
    notes.killed = got;
    await sleep(4200); // past the 3 s "in a fight" hold on a melee shard
    // the carcass slides a few metres as it falls (and the player's capsule is pushed off it): pin the player 1.5 m from
    // it, facing it, every frame from here on (the harvest prompt needs < 2.6 m)
    await page.evaluate(() => {
      const p = window.__world.player, a = window.__e314Carcass;
      if (!a) return;
      const pin = () => { p.position.set(a.position.x + 1.06, p.position.y, a.position.z + 1.06); p.velocity?.set(0, 0, 0); p.yaw = Math.atan2(1.06, 1.06); p.pitch = -0.5; requestAnimationFrame(pin); };
      pin();
    });
    await sleep(1500);
    notes.prompt = await page.evaluate(() => (document.querySelector('.ws-touch-use.show')?.textContent ?? '').trim());
    await shot('kill');
  });
  writeFileSync(resolvePath(OUT, `${TAG}-notes.json`), JSON.stringify(notes, null, 2));
  console.log(JSON.stringify(notes, null, 2));
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 4).join(' | ')}`);
} finally {
  await browser.close();
}
