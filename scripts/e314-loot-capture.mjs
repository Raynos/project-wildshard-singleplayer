#!/usr/bin/env node
// e314-loot-capture.mjs — E314 stage 1 evidence: iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier, muted, Metal)
// frames of the loot redesign — a kill's coin burst + the coin chip, and every BAG tab — for a before / after sheet.
//
//   node scripts/e314-loot-capture.mjs --url=http://127.0.0.1:4403 --out=<dir> [--chunk=driftwood-isle] [--scenes=…] [--demo]
//
// scenes: hurt (a 12-point hit: VITALS back, the coin chip where it was) · burst (a bear — else a boar — killed 6 m ahead: the arc + "+n", then the chip once the coins land) · map · gear · finds · pack ·
// feats · inventory · achievements (today's names) — a tab that isn't there is skipped. --demo seeds a mid-game Driftwood
// save (23 coins, whetstone I, charm I, the bear claw, the captain's hat worn, 7 sea glass, 6 places, 2 glyph shards, the
// pearl necklace) through localStorage before the load; the game reads it like any save. Writes <out>/<chunk>-<scene>.jpg.
// Run it inside scripts/browser-lane.sh (one browser, closed at the end).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4403');
const OUT = resolvePath(flag('out', '/tmp/e314'));
const CHUNK = flag('chunk', 'driftwood-isle');
const SCENES = flag('scenes', 'burst,map,gear,finds,pack,feats').split(',').filter((x) => x !== '');
const DEMO = argv.includes('--demo');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const ID = `chunk://local/${CHUNK}`;
const seed = DEMO ? {
  'ws.purse.v1': { [ID]: 23 },
  'ws.owned.v1': { [ID]: { owned: ['iron-sword', 'whetstone-1', 'charm-1', 'bear-claw', 'captain-hat'], worn: ['captain-hat'] } },
  'ws.flags.v1': { [ID]: ['talked:castaway', 'glass:1', 'glass:2', 'glass:3', 'glass:5', 'glass:8', 'glass:9', 'glass:12', 'seen:pier', 'seen:hut', 'seen:vista', 'seen:bridge', 'seen:lookout', 'seen:wreck', 'shard:lookout', 'shard:wreck', 'found:reef-treasure'] },
} : {};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=${CHUNK}&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
  await sleep(4000);
  const census = await page.evaluate(() => {
    const by = {};
    for (const a of window.__world.animals.animals) if (a.alive) by[a.kind] = (by[a.kind] ?? 0) + 1;
    return { by, fullClear: window.__loot?.fullClear ?? null };
  });
  console.log(`census ${JSON.stringify(census.by)} · full clear ${census.fullClear ?? '(no coins here)'}`);
  const shot = async (name) => { const f = resolvePath(OUT, `${CHUNK}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 82 })); console.log(f); };

  for (const scene of SCENES) {
    if (scene === 'hurt') {
      // VITALS come back on a hit (E319): one 12-point bite from the nearest enemy, through main.ts's own onCharge
      await page.evaluate(() => { const w = window.__world, a = w.animals.animals.find((x) => x.alive); if (a) w.animals.onCharge?.(a, 12); });
      await sleep(600); await shot('hurt');
      continue;
    }
    if (scene === 'burst') {
      // a bear (else a boar, else anything alive) set down 6 m ahead of the camera and killed: the coins burst, fly in, land
      const ok = await page.evaluate(() => {
        const w = window.__world, cam = w.game.camera, p = w.player.position;
        const list = w.animals.animals.filter((a) => a.alive);
        const a = list.find((x) => x.kind === 'bear') ?? list.find((x) => x.kind === 'boar') ?? list.find((x) => x.kind !== 'captain' && x.kind !== 'sailor');
        if (!a) return false;
        const d = cam.getWorldDirection(p.clone()); d.y = 0; d.normalize();
        a.position.set(p.x + d.x * 6, p.y, p.z + d.z * 6);
        for (let i = 0; i < 20 && a.alive; i++) a.applyDamage(Math.max(1, a.hp), a.position.clone().setY(p.y + 0.6), d); // armour / a guard can soak one hit
        return true;
      });
      if (!ok) { console.log('burst: no animal'); continue; }
      await sleep(200); await shot('burst-arc');
      await sleep(450); await shot('burst-fly');
      await sleep(2400); await shot('burst-chip');
      continue;
    }
    const opened = await page.evaluate((tab) => {
      const bag = document.querySelector('.ws-minimap-bag');
      if (!document.querySelector('.ws-gmenu.show')) bag?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const want = { pack: ['inventory'], feats: ['achievements'] }[tab] ?? [tab];
      const b = [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => want.includes(x.dataset.tab ?? '') && !x.hidden);
      if (!b) return false;
      b.click();
      return true;
    }, scene);
    if (!opened) { console.log(`${scene}: no such tab`); continue; }
    await sleep(900);
    await shot(scene);
  }
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 4).join(' | ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
