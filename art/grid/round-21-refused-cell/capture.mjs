#!/usr/bin/env node
// G167 / G168 evidence (SHARD-PLATFORM SF58 (12) (13)): iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier, muted).
//
//   scripts/browser-lane.sh node art/grid/round-21-refused-cell/capture.mjs --url=<served HEAD build> [--only=b,a,card,toast]
//
// The refusal is real: the test browser answers the template's shardfile with a format this client can't read (version 99:
// the grid's product admission refuses it, NEEDS UPGRADE), and for A also withholds its baked far view (404), so the cell
// has no far view. Captures: b-frozen.jpg (B, from the road), a-void.jpg (A), card-unavailable.jpg (SHARD SELECT, same tab:
// the session record), and into art/hud/round-25-script-error/: player-toast.jpg / developer-banner.jpg (the notice's two HUD lines, Developer off / on, on
// Driftwood's pier; the disable → notice path itself is proved by test/script-disabled-*.test.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const BASE = flag('url', 'http://127.0.0.1:4401').replace(/\/$/u, '');
const ONLY = flag('only', 'b,a,card,toast').split(',');
const GRID_OUT = resolvePath(import.meta.dirname), HUD_OUT = resolvePath(import.meta.dirname, '../../hud/round-25-script-error');
mkdirSync(HUD_OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const FIXTURES = [
  'window.__wildshardHarness={seed:357,capture:null}', // the harness pins that let a capture pose the camera
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true }),
].join(';');
const QUERY = '?mute=1&nolock=1&sw=0&touch=1';
const log = {};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
async function context(withholdFar) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript(FIXTURES);
  await ctx.route('**/shardfiles/_template/shard.json*', async (route) => {
    const response = await route.fetch(), json = await response.json();
    await route.fulfill({ response, json: { ...json, version: 99 } }); // a newer format than this client reads
  });
  if (withholdFar) await ctx.route('**/assets/baked/_template/far.*', (route) => route.fulfill({ status: 404, body: 'withheld' }));
  return ctx;
}
async function enterGrid(page) {
  await page.goto(`${BASE}/${QUERY}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(800);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 240000, polling: 500 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await sleep(1500); // the sky-down reveal takes the one tap that skips it
  await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForFunction(() => window.__wildshard.shard.grid.state().refused.cells.length > 0, undefined, { timeout: 120000, polling: 500 });
}
/** Stand on the road outside the nearest refused cell's soft wall, facing its centre (home-frame metres). */
async function faceRefused(page, back, rise) {
  return page.evaluate(async ({ back, rise }) => {
    const grid = window.__wildshard.shard.grid, state = grid.state(), refused = state.refused.cells;
    const cells = new Map(state.cells.map((c) => [c.instance, c]));
    const home = cells.get(state.home), pitch = 560;
    // the nearest refused cell; the template copies sit on the corners, seen from the crossroads between it and home
    const step = (c) => Math.abs(c.cell[0] - home.cell[0]) + Math.abs(c.cell[1] - home.cell[1]);
    const pick = refused.map((r) => cells.get(r.instance)).sort((a, b) => step(a) - step(b) || a.instance.localeCompare(b.instance))[0];
    const ux = Math.sign(pick.cell[0] - home.cell[0]), uz = Math.sign(pick.cell[1] - home.cell[1]);
    // render metres = cell × pitch on both axes (the dressed root of cell (1,-1) sits at +x, -z); yaw 0 looks down -z
    const at = 277.5 - back, x = ux * at, z = uz * at, len = Math.hypot(ux, uz);
    const pose = { x, y: 1.7 + rise, z, yaw: Math.atan2(-ux / len, -uz / len), pitch: 0.14 };
    window.__wildshard.pose(pose);
    await new Promise((r) => { setTimeout(r, 4000); });
    const scene = window.__wildshard.world.game.scene, dressed = scene.getObjectByName(`grid-refused:${pick.instance}`);
    const where = dressed === undefined ? null : (() => { const v = dressed.getWorldPosition(dressed.position.clone()); return [Math.round(v.x), Math.round(v.y), Math.round(v.z)]; })();
    const p = window.__wildshard.world.player;
    return { pose, pick: pick.instance, home: state.home, cells: state.cells.map((c) => `${c.instance}@${c.cell.join(',')}`), dressedAt: where, player: [p.position.x, p.position.y, p.position.z, p.yaw].map((n) => Math.round(n * 100) / 100), refused: grid.state().refused, softWalls: grid.state().softWalls };
  }, { back, rise });
}
async function shot(page, file) { await page.screenshot({ path: file, type: 'jpeg', quality: 80 }); console.log('wrote', file); }

try {
  if (ONLY.includes('b')) {
    const ctx = await context(false), page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('pageerror', e.message.slice(0, 200)); });
    await enterGrid(page);
    await page.waitForFunction(() => window.__wildshard.shard.grid.state().refused.cells.some((c) => c.look === 'frozen'), undefined, { timeout: 120000, polling: 500 });
    log.b = await faceRefused(page, -12.5, 0); await sleep(1500);
    await shot(page, resolvePath(GRID_OUT, 'b-frozen.jpg'));
    await ctx.close();
  }
  if (ONLY.includes('a') || ONLY.includes('card')) {
    const ctx = await context(true), page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('pageerror', e.message.slice(0, 200)); });
    await enterGrid(page);
    await page.waitForFunction(() => window.__wildshard.shard.grid.state().refused.cells.some((c) => c.look === 'void'), undefined, { timeout: 120000, polling: 500 });
    if (ONLY.includes('a')) { log.a = await faceRefused(page, -12.5, 0); await sleep(1500); await shot(page, resolvePath(GRID_OUT, 'a-void.jpg')); }
    if (ONLY.includes('card')) {
      await page.goto(`${BASE}/${QUERY}`, { waitUntil: 'domcontentloaded' }); // the same tab: the session record of refused shards
      await page.waitForSelector('.ws-main-select', { timeout: 120000 }); await sleep(800);
      await page.click('.ws-main-select'); await sleep(800);
      const index = await page.evaluate(() => [...document.querySelectorAll('.ws-menu-card')].findIndex((c) => c.classList.contains('ws-menu-card-unavailable')));
      log.card = { index };
      if (index >= 0) { await page.evaluate((i) => { document.querySelectorAll('.ws-menu-dots i')[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, index); await sleep(1500); }
      await shot(page, resolvePath(GRID_OUT, 'card-unavailable.jpg'));
    }
    await ctx.close();
  }
  if (ONLY.includes('toast')) {
    for (const developer of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
      await ctx.addInitScript([saveFixtureCode({ scope: 'device', key: 'devMode', data: developer }), saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true })].join(';'));
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?chunk=driftwood-isle&mute=1&nolock=1&skipintro=1&sw=0&touch=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
      await sleep(5000);
      // the notice's own HUD calls, with the strings scriptDisabledNotice composes for door.wasm out of fuel ×3
      await page.evaluate(() => { const hud = window.__wildshard.world.hud; hud.toast('SOMETHING IN THIS SHARD STOPPED WORKING', 'warn'); hud.devAlert('SCRIPT DISABLED · door.wasm · out of fuel ×3'); });
      await sleep(700); await shot(page, resolvePath(HUD_OUT, developer ? 'developer-banner.jpg' : 'player-toast.jpg'));
      await ctx.close();
    }
  }
} finally {
  writeFileSync(resolvePath(GRID_OUT, 'capture-log.json'), JSON.stringify(log, null, 1));
  await browser.close();
}
