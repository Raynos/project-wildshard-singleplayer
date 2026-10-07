#!/usr/bin/env node
// SHARD-PLATFORM SF60 (G202): the milestone video of real play, recorded in a real browser (Chromium as an iPhone 16 Pro
// portrait, muted, Settings ▸ Developer on, a HEAD build).
//
//   scripts/serve-build.sh --head --name sf60                 → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/videos/grid-drive.mjs --url=http://127.0.0.1:<port> [--date=YYYY-MM-DD]
//
// Taps INFINITE WILDSHARD (the sky-down reveal to Driftwood's pier), then rides the hoverboard down the road east of
// Driftwood, turns west and crosses into Driftwood (its title card), then enters Nalati Grasslands through SHARD SELECT
// (a second shard entry: on this build the grid's hand-built neighbours keep their soft wall closed until M3). The cuts
// between the legs are teleports (`__wildshard.pose`) or menu loads; every frame kept is the game running. Writes <date>-grid-drive.mp4 (540 px wide, H.264, ~0.9 Mb/s, no audio) and
// <date>-grid-drive.json (the HUD readout at each leg) beside this script.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url');
const date = flag('date', new Date().toISOString().slice(0, 10));
if (url === '') { console.error('usage: grid-drive.mjs --url=<build> [--date=YYYY-MM-DD]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(OUT, { recursive: true });
const out = { url, date, started: new Date().toISOString(), legs: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const video = join(OUT, '.video'); rmSync(video, { recursive: true, force: true });
const cuts = []; // [fromSeconds, toSeconds] of the recording to keep
try {
  // Playwright records at the CSS viewport (402 × 874); ffmpeg scales it to 540 px wide
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, recordVideo: { dir: video, size: PHONE.screen } });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; }); // the probe's pose() needs the harness
  const page = await ctx.newPage();
  const ctxStart = Date.now(); // the recording starts with the page
  const at = () => (Date.now() - ctxStart) / 1000;
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); }); out.errors = errors;
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  out.build = await page.evaluate(() => fetch('/version.json').then((r) => r.json()).catch(() => null));
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  await sleep(1500);
  // leg 0: the main menu, the tap and the sky-down reveal to the pier
  let from = at() - 1.2;
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  const revealAt = at();
  cuts.push([from, from + 2.2]); // the menu and the tap
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  cuts.push([revealAt - 0.3, at()]);
  const state = () => page.evaluate(() => { const s = window.__wildshard.shard; const g = s.grid.state(); const p = window.__wildshard.world.player;
    const v = p.velocity; return { inside: g.inside, hud: s.gridHud?.state() ?? null, x: Math.round(p.position.x), z: Math.round(p.position.z), speed: Math.round(Math.hypot(v.x, v.z)),
      cells: Object.fromEntries(g.cells.filter((c) => !c.slug.startsWith('_')).map((c) => [c.instance, c.shows])), refused: g.refused, softWalls: g.softWalls, residentMB: g.residentMB }; });
  out.legs.push({ leg: 'reveal', ...(await state()) });
  const ride = async (name, pose, holdMs, turn, settleMs = 1800) => {
    await page.evaluate((p) => window.__wildshard.pose({ name: 'grid', ...p }), pose);
    await sleep(settleMs); // settle the teleport and let the next cell stream in (cut)
    out.legs.push({ leg: `${name}:before`, ...(await state()) });
    await page.evaluate(() => { window.__wildshard.world.player.setHover(true); });
    await sleep(300);
    const start = at();
    await page.keyboard.down('KeyW');
    const t0 = Date.now(); let turned = false;
    while (Date.now() - t0 < holdMs) {
      await sleep(100);
      if (turn !== undefined && !turned && Date.now() - t0 > turn.afterMs) {
        turned = true;
        // a smooth turn of the view over ~0.9 s, as a thumb on the look pad would
        for (let i = 1; i <= 18; i++) { await page.evaluate(([a, b, k]) => { window.__wildshard.world.player.yaw = a + (b - a) * k; }, [pose.yaw, turn.yaw, i / 18]); await sleep(50); }
      }
    }
    await page.keyboard.up('KeyW');
    await sleep(1600);
    cuts.push([start - 0.2, at()]);
    out.legs.push({ leg: name, ...(await state()) });
    console.log(name, JSON.stringify(out.legs.at(-1)));
  };
  // leg 1 + 2: down the road east of Driftwood (yaw 0 faces -z), then a turn west across the border into Driftwood
  await ride('road-then-driftwood', { x: 277.5, y: 2, z: 230, yaw: 0, pitch: -0.04 }, 9500, { afterMs: 5200, yaw: Math.PI / 2 });
  // leg 3: a second shard entry, Nalati Grasslands through SHARD SELECT (same page, so one recording). On this build the
  // grid's hand-built neighbours keep their soft wall closed (far proxies until M3), so the menu is the way in.
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-select', { timeout: 120000 });
  await sleep(1200);
  from = at() - 0.6;
  await page.click('.ws-main-select');
  await sleep(1000);
  const nalati = await page.$$eval('.ws-menu-card', (els) => els.findIndex((el) => /nalati/i.test(el.textContent ?? '')));
  if (nalati < 0) throw new Error('no Nalati card in SHARD SELECT');
  await page.click(`.ws-menu-dots i[data-i="${String(nalati)}"]`);
  await sleep(1400);
  await page.click('.ws-menu-play');
  await sleep(600);
  cuts.push([from, at()]);
  await page.waitForFunction(() => { const w = window.__wildshard; return w !== undefined && w.world?.player !== undefined && document.querySelector('.ws-title-stack') === null; }, null, { timeout: 180000, polling: 200 });
  await sleep(1500);
  const entered = at();
  await page.mouse.click(201, 437); // tap to begin
  await sleep(1200);
  await page.keyboard.down('KeyW'); await sleep(4500); await page.keyboard.up('KeyW');
  await sleep(1000);
  cuts.push([entered - 0.5, at()]);
  out.legs.push({ leg: 'nalati-select', slug: await page.evaluate(() => window.__wildshard.world.game.level.id), errors: errors.length });
  console.log('nalati-select', JSON.stringify(out.legs.at(-1)));
  await ctx.close();
  const [file] = readdirSync(video).filter((f) => f.endsWith('.webm'));
  if (file === undefined) throw new Error('no recording');
  const raw = join(video, file);
  const parts = cuts.map(([a, b], i) => { const p = join(video, `part-${String(i)}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', Math.max(0, a).toFixed(2), '-t', (b - Math.max(0, a)).toFixed(2), '-i', raw, '-an', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', '25', p]); return p; });
  const list = join(video, 'list.txt'); writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const mp4 = join(OUT, `${date}-grid-drive.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-maxrate', '1100k', '-bufsize', '2000k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  out.cuts = cuts.map(([a, b]) => [Number(a.toFixed(2)), Number(b.toFixed(2))]);
  out.seconds = Number(cuts.reduce((s, [a, b]) => s + (b - Math.max(0, a)), 0).toFixed(1));
} finally {
  rmSync(video, { recursive: true, force: true });
  writeFileSync(join(OUT, `${date}-grid-drive.json`), `${JSON.stringify(out, null, 2)}\n`);
  await browser.close();
}
