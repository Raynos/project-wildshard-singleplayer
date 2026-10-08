#!/usr/bin/env node
// SHARD-PLATFORM SF52 / G220 pass 2: Template 1's districts and each grid copy's own landmarks, captured in a real browser
// (Chromium as an iPhone 16 Pro portrait, muted, Settings ▸ Developer on, a build of the candidate tree).
//
//   scripts/serve-build.sh --rev <tree|commit> --name g220b      → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/g220-pass2/capture.mjs --url=http://127.0.0.1:<port> [--only=shots|video] [--views=<id,…>] [--label=before]
//
// INFINITE WILDSHARD's reachable template copy: template-2 (cell 1, 1: centre (555, 555) in Driftwood's frame, lime). For each: the road (the player's own eye on a spoke), the air (two
// raised views), each entry (a raised camera with the player at the entry so its tiles stream) and two of its plots.
// video: a hoverboard drive through template-2's west entry to its loop, then its north entry to its loop
// → drive.mp4 (540 px, H.264 ~0.9 Mb/s). Raised views move only the camera (posed last in the frame).
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), only = flag('only'), label = flag('label'), measureOnly = label !== '', views = flag('views');
if (url === '') { console.error('usage: capture.mjs --url=<build> [--only=shots|video]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** the phone's PNG → a JPEG (≤ 500 KB) */
const jpeg = (png, name) => {
  if (measureOnly) return;
  const tmp = join(OUT, `.${name}.png`); writeFileSync(tmp, png);
  execFileSync('sips', ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', tmp, '--out', join(OUT, `${name}.jpg`)], { stdio: 'ignore' });
  rmSync(tmp); console.log('captured', name);
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const log = { url, legs: [] };
const errors = [];

async function open(record, dev = true) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, ...(record ? { recordVideo: { dir: record, size: PHONE.screen } } : {}) });
  const t0 = Date.now(); // the recording's clock starts with the context
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: dev });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  await page.evaluate(() => {
    const w = window.__wildshard.world, cam = w.game.camera;
    window.__g220 = null;
    w.game.onLate(() => {
      const v = window.__g220; if (!v) return;
      cam.position.set(v.pos[0], v.pos[1], v.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[1], v.look[2]);
      cam.far = Math.max(cam.far, 4000); cam.updateProjectionMatrix();
      for (const ch of cam.children) ch.visible = false;
      cam.updateMatrixWorld(true);
    });
  });
  return { ctx, page, t0 };
}
const hideUi = (page, hide) => page.evaluate((h) => {
  let st = document.getElementById('__g220ui'); if (!st) { st = document.createElement('style'); st.id = '__g220ui'; document.head.append(st); window.__wildshard.world.game.renderer.domElement.classList.add('__g220game'); }
  st.textContent = h ? 'body *{visibility:hidden!important} canvas.__g220game{visibility:visible!important}' : '';
}, hide);
const state = (page) => page.evaluate(() => { const s = window.__wildshard.shard, g = s.grid.state(), p = window.__wildshard.world.player, v = p.velocity;
  return { inside: g.inside, feet: g.feet, x: Math.round(p.position.x), z: Math.round(p.position.z), speed: Math.round(Math.hypot(v.x, v.z)), residentMB: g.residentMB, playingMB: g.playingMB }; });
/** the current render frame's offset from Driftwood's frame (the pose and the camera speak the current cell's frame) */
const offset = (page) => page.evaluate(() => { const f = window.__wildshard.shard.grid.state().feet, p = window.__wildshard.world.player.position; return [f.x - p.x, f.z - p.z]; });
/** pose the player at a point given in Driftwood's frame */
const pose = async (page, p) => { const [ox, oz] = await offset(page); await page.evaluate((q) => window.__wildshard.pose(q), { ...p, x: p.x - ox, z: p.z - oz }); };
/** the raised camera at a point given in Driftwood's frame (the render frame stays the home cell's; only poses are cell-local) */
const camera = (page, v) => page.evaluate((hv) => { window.__g220 = hv; }, v);

// cell-local views (x east, z north; yaw 0 faces −z, yaw π/2 faces −x); `at` is where the player stands so tiles stream
const VIEWS = [
  { id: 'road-west-spoke', at: [-170, 0], eye: { yaw: -Math.PI / 2, pitch: -0.02 } },
  { id: 'air-south', at: [0, -60], pos: [0, 240, -400], look: [0, 0, -20] },
  { id: 'air-north-west', at: [-120, 120], pos: [-330, 150, 330], look: [-60, 0, 60] },
  { id: 'entry-north', at: [0, 200], pos: [36, 22, 150], look: [-10, 4, 215] },
  { id: 'entry-south', at: [0, -200], pos: [-36, 22, -150], look: [10, 4, -215] },
  { id: 'entry-east', at: [200, 0], pos: [150, 22, 36], look: [215, 4, -10] },
  { id: 'entry-west', at: [-200, 0], pos: [-150, 22, -36], look: [-215, 4, 10] },
  { id: 'plot-ne', at: [66, 140], pos: [20, 30, 110], look: [66, 8, 162] },
  { id: 'plot-se', at: [150, -66], pos: [120, 30, -20], look: [162, 8, -66] },
];
// Developer ON swaps template-3 and template-5 for Sunscar and Sky Reach (the catalogue's developer overrides), and the
// menu offers the grid only with Developer on, so template-2 is the one copy a player can reach today
const COPIES = [{ id: 'template-2', c: [555, 555], dev: true }];

async function shots() {
  // one page per copy: a pose reaches the cells round the one the player is in, not a copy two cells away
  for (const copy of COPIES) {
    const { ctx, page } = await open(null, copy.dev);
    try {
      const [cx, cz] = copy.c;
      // the first pose into another cell lands on its spawn; the views pose within it after this
      await pose(page, { x: cx, z: cz, yaw: 0, pitch: 0 }); await sleep(6000);
      for (const v of VIEWS.filter((row) => views === '' || views.split(',').includes(row.id))) {
        await page.evaluate(() => { window.__g220 = null; });
        await pose(page, { x: cx + v.at[0], z: cz + v.at[1], yaw: v.eye?.yaw ?? 0, pitch: v.eye?.pitch ?? 0 });
        await hideUi(page, v.eye === undefined);
        await sleep(1500);
        if (v.pos !== undefined) await camera(page, { pos: [cx + v.pos[0], v.pos[1], cz + v.pos[2]], look: [cx + v.look[0], v.look[1], cz + v.look[2]] });
        await sleep(v.eye === undefined ? 5000 : 8000);
        const s = await state(page); log.legs.push({ leg: `${copy.id}:${v.id}`, ...s });
        jpeg(await page.screenshot({ type: 'png' }), `${copy.id}-${v.id}`);
        if (measureOnly) break;
      }
    } finally { await ctx.close(); }
  }
}

async function video() {
  // leg 1: template-2 (Developer on), from the road west of its cell east through the west entry to the loop
  // leg 2: template-2 again, from the road north of its cell south through the north entry to the loop (the one reachable copy)
  const legs = [{ id: 'template-2', dev: true, start: [555 - 262, 555], yaw: -Math.PI / 2, until: (f) => f.x - 555 > -66 },
    { id: 'template-2-north', dev: true, start: [555, 555 + 262], yaw: 0, until: (f) => f.z - 555 < 66 }];
  const parts = [], root = join(OUT, '.video'); rmSync(root, { recursive: true, force: true });
  let seconds = 0;
  try {
    for (const [n, leg] of legs.entries()) {
      const dir = join(root, String(n)), { ctx, page, t0 } = await open(dir, leg.dev);
      const at = () => (Date.now() - t0) / 1000;
      await pose(page, { x: leg.start[0], z: leg.start[1], yaw: leg.yaw, pitch: -0.06 }); await sleep(9000);
      log.legs.push({ leg: `drive:${leg.id}:before`, ...(await state(page)) });
      await page.evaluate(() => { window.__wildshard.world.player.setHover(true); }); await sleep(400);
      const start = at(); await page.keyboard.down('KeyW');
      const samples = [];
      for (let i = 0; i < 90; i++) { await sleep(400); const s = await state(page); samples.push([Math.round(s.feet.x), Math.round(s.feet.z), s.speed, s.inside]); if (leg.until(s.feet)) break; }
      await page.keyboard.up('KeyW'); await sleep(800);
      const end = at();
      log.legs.push({ leg: `drive:${leg.id}`, samples, ...(await state(page)) });
      await ctx.close();
      const [file] = readdirSync(dir).filter((f) => f.endsWith('.webm'));
      if (file === undefined) throw new Error('no recording');
      seconds += end - start + 0.3;
      if (!measureOnly) {
        const out = join(root, `part${n}.mp4`); parts.push(out);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', (start - 0.3).toFixed(2), '-t', (end - start + 0.3).toFixed(2), '-i', join(dir, file), '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-maxrate', '1100k', '-bufsize', '2000k', '-pix_fmt', 'yuv420p', '-r', '25', out]);
      }
    }
    if (!measureOnly) {
      const list = join(root, 'list.txt'); writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(OUT, 'drive.mp4')]);
    }
    log.seconds = Number(seconds.toFixed(1));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

try {
  if (only !== 'video') await shots();
  if (only !== 'shots') await video();
} finally {
  log.errors = errors;
  writeFileSync(join(OUT, `capture${only === '' ? '' : `-${only}`}${label === '' ? '' : `-${label}`}.json`), `${JSON.stringify(log, null, 2)}\n`);
  await browser.close();
}
