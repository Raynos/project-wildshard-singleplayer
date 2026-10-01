#!/usr/bin/env node
// playground-cards.mjs — E325: the Explore hub's playground cards, shot live (the way E292's Practice art and E293's World /
// Models art were): an iPhone-16-Pro portrait page (402 × 874 @ 3×, phone tier, touch), each shard's own grade, the HUD
// hidden for the frame, the loop frozen on the moment. Candidates go to --out as full portrait PNGs; the card crop (3:2,
// 600 × 400 WebP, src/explore/img/playground-<id>.webp) is picked from them by eye.
//
//   grapple  the real Fei Zhua mid-zip up the tower: from BASE, LOCK on L1's hook, ZIP, frozen at a few moments of the pull
//   horse    the real ride: mount (USE), canter onto the front straight, a glance left over the infield's rails
//   hub      the hub scrolled to its playground card (the before / after board)
//
//   scripts/browser-lane.sh node scripts/playground-cards.mjs --url=http://127.0.0.1:4400 --out=<dir> [--only=grapple,horse]
import { mkdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { aimAt, bootToTitle, enterPlayground, flags, openHub, phonePage, sleep, tap } from './playground-harness.mjs';

const { chromium } = await import('playwright');
/** the course's pads (the room's own frame; the floor is PLAYGROUND_Y, 3000 m, over the shard) */
const { PADS } = await import('../src/shards/nine-dragon-stack/playground/grappleCourse.ts');
const flag = flags();
const BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e325-playground-cards'));
const ONLY = flag('only', 'grapple,horse').split(',');
mkdirSync(OUT, { recursive: true });

/** the frame as it is, with the HUD hidden and the loop frozen (nothing moves between the freeze and the shot) */
async function still(page, name) {
  await page.evaluate(() => {
    const g = window.__wildshard.world.game;
    window.__cardGate ??= g.frameGate;
    g.frameGate = () => false;
    const hud = document.getElementById('hud');
    if (hud) hud.style.visibility = 'hidden';
  });
  await sleep(120);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await page.evaluate(() => {
    window.__wildshard.world.game.frameGate = window.__cardGate;
    const hud = document.getElementById('hud');
    if (hud) hud.style.visibility = '';
  });
}

/** the hub, scrolled to its last card (the playground) */
async function hubShot(page, name) {
  // every card's art decoded first (the hub's images arrive after the list is up)
  await page.waitForFunction(() => [...document.querySelectorAll('.ws-x-card-art')].every((el) => {
    const m = /url\(["']?([^"')]+)/.exec(getComputedStyle(el).backgroundImage);
    if (m === null) return true;
    const img = new Image(); img.src = m[1];
    return img.complete && img.naturalWidth > 0;
  }), undefined, { timeout: 30000, polling: 250 });
  await page.evaluate(() => { const h = document.querySelector('.ws-x-hub'); if (h) h.scrollTop = h.scrollHeight; });
  await sleep(1500);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 90 });
  await page.evaluate(() => { const h = document.querySelector('.ws-x-hub'); if (h) h.scrollTop = 0; });
  await sleep(500);
}

const lockLabel = (page) => page.evaluate(() => document.querySelector('.ws-touch-disc.lock span')?.textContent ?? '');

async function grapple(browser) {
  const page = await phonePage(browser);
  page.on('pageerror', (e) => { console.log(`pageerror: ${e.message.slice(0, 200)}`); });
  console.log(`nine dragon title in ${await bootToTitle(page, BASE, 'nine-dragon-stack')} s`);
  await openHub(page);
  await hubShot(page, 'hub-nine-dragon-stack');
  await enterPlayground(page, 'grapple');
  const hooks = await page.evaluate(() => window.__wildshard.world.playground().hooks.map((h) => [h.x, h.y, h.z]));
  // hooks (grappleCourse.ts HOOKS): 0 P1 · 1 P2 · 2 BASE · 3 L1 · 4 L2 · 5 the top
  const shots = [{ pad: 'base', hook: 3, tag: 'base-l1' }, { pad: 'p2', hook: 2, tag: 'p2-base' }, { pad: 'l1', hook: 4, tag: 'l1-l2' }];
  for (const s of shots) {
    for (const ms of [260, 460, 660]) {
      // stand in the middle of the pad the previous zip lands on (grappleCourse.ts PADS), facing the next ring
      const pad = PADS.find((q) => q.id === s.pad);
      if (pad === undefined) continue;
      await page.evaluate(([x, top, z]) => {
        const w = window.__wildshard?.world, c = w.playground().center;
        w.player.spawn(c.x + x, c.z + z, 0, 3000 + top);
        w.player.velocity.set(0, 0, 0);
      }, [pad.x, pad.top, pad.z]);
      await sleep(700);
      await aimAt(page, hooks[s.hook]);
      let ready = false;
      for (let k = 0; k < 30 && !ready; k++) { await sleep(100); ready = (await lockLabel(page)) === 'Grapple'; }
      if (!ready) { console.log(`${s.tag}: no GRAPPLE`); continue; }
      await tap(page, '.ws-touch-disc.lock');
      await sleep(250);
      await tap(page, '.ws-touch-disc.jump');
      await sleep(ms);
      await still(page, `grapple-${s.tag}-${ms}`);
      await sleep(2500);
    }
  }
  await page.context().close();
}

async function horse(browser) {
  const page = await phonePage(browser, { rideRoad: 'on' });
  page.on('pageerror', (e) => { console.log(`pageerror: ${e.message.slice(0, 200)}`); });
  console.log(`nalati title in ${await bootToTitle(page, BASE, 'nalati-grasslands')} s`);
  await openHub(page);
  await hubShot(page, 'hub-nalati-grasslands');
  await enterPlayground(page, 'horse');
  await sleep(1500);
  await tap(page, '.ws-touch-use');
  await page.waitForFunction(() => window.__wildshard.world.ride.mounted === true, undefined, { timeout: 8000, polling: 100 });
  await sleep(1000);
  const ring = await (await page.$('.ws-touch-stick'))?.boundingBox();
  if (!ring) throw new Error('no MOVE stick');
  const cx = ring.x + ring.width / 2, cy = ring.y + ring.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 5, radiusX: 8, radiusY: 8, force: 1 }] });
  await touch('touchStart', cx, cy);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', cx, cy - k * 14); await sleep(30); }
  await sleep(3800);
  await touch('touchEnd', cx, cy - 84);
  // a glance off the heading (a LOOK drag's worth), frozen before the view eases back behind the ears
  const glance = async (name, dyaw, pitch) => {
    await page.evaluate(([y, p]) => { const w = window.__wildshard?.world; w.player.yaw += y; w.player.pitch = p; }, [dyaw, pitch]);
    await sleep(140);
    await still(page, name);
  };
  const local = () => page.evaluate(() => { const w = window.__wildshard?.world, pg = w.playground(), p = w.player.position; return [p.x - pg.center.x, p.z - pg.center.z]; });
  // the back straight, heading west toward the HALF WAY gate
  await glance('horse-front-ahead', 0, -0.06);
  for (let k = 0; k < 120; k++) { await sleep(250); const [x, z] = await local(); if (z < -30 && x < 40) break; }
  await glance('horse-back-ahead', 0, -0.06);
  // then the rider takes the reins (the stick, as a thumb would): off the track at the west bend, round into the infield
  // and east down the jump lane — the four rails ahead, jumped at a canter; frames on the way in and between the rails
  await page.evaluate(() => {
    const w = window.__wildshard?.world, pg = w.playground(), m = w.ride.mount;
    const pts = [[-70, -20], [-75, 0], [-55, 0], [60, 0]];
    let i = 0;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    window.__lane = setInterval(() => {
      const h = m.horse;
      if (h === null) return;
      if (i >= pts.length) { w.player.touchMove.x = 0; w.player.touchMove.y = 0; clearInterval(window.__lane); return; }
      const p = pts[i];
      const dx = pg.center.x + p[0] - h.position.x, dz = pg.center.z + p[1] - h.position.z;
      if (Math.hypot(dx, dz) < 5) { i++; return; }
      const err = wrap(Math.atan2(dx, dz) - h.yaw);
      w.player.touchMove.x = Math.max(-0.9, Math.min(0.9, -err * 1.6));
      w.player.touchMove.y = 0.92;
    }, 50);
  });
  const shots = [[-44, 'horse-lane-a'], [-25, 'horse-lane-b'], [-14, 'horse-lane-c'], [4, 'horse-lane-d'], [16, 'horse-lane-e']];
  let next = 0, started = false;
  for (let k = 0; k < 400 && next < shots.length; k++) {
    await sleep(60);
    const [x, z] = await local();
    if (!started && x < -60 && Math.abs(z) < 6) started = true;
    const s = shots[next];
    if (started && Math.abs(z) < 6 && x > s[0]) {
      await page.evaluate(() => { const w = window.__wildshard?.world; w.player.pitch = -0.08; });
      await still(page, s[1]);
      next++;
    }
  }
  await page.evaluate(() => { clearInterval(window.__lane); const w = window.__wildshard?.world; w.player.touchMove.x = 0; w.player.touchMove.y = 0; });
  await page.context().close();
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  if (ONLY.includes('grapple')) await grapple(browser);
  if (ONLY.includes('horse')) await horse(browser);
} finally {
  await browser.close();
}
console.log(`candidates in ${OUT}`);
