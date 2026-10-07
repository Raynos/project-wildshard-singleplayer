#!/usr/bin/env node
// SHARD-PLATFORM SF52 / G220: Template 1's filled cell, captured in a real browser (Chromium as an iPhone 16 Pro portrait,
// muted, Settings ▸ Developer on, a HEAD build).
//
//   scripts/serve-build.sh --head --name g220                → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 20 node progress/shard-platform/g220/capture.mjs --url=http://127.0.0.1:<port> [--only=shots|grid]
//     [--label=before]   (grid only: the crossroads numbers of another build, no media)
//
// shots: SHARD SELECT's template (`?chunk=_template`): each entry as you arrive (the player's own eye, just inside the
//   socket), each entry set piece from a raised camera, the hub, a road from above → <id>.jpg
// grid:  INFINITE WILDSHARD: the template copy north-east of Driftwood from the air, then a hoverboard drive from the road
//   through its west entry down the west road onto the hub loop → grid-cell-air(-close).jpg, grid-cell-west-road.jpg, drive.mp4 (540 px, H.264 ~0.9 Mb/s)
// Raised views move only the camera (posed last in the frame); the player stands at the view's subject so its tiles stream.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const OUT = resolve(new URL('.', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), only = flag('only'), label = flag('label'), measureOnly = label !== '';
if (url === '') { console.error('usage: capture.mjs --url=<build> [--only=shots|grid]'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** the phone's PNG → an 804 px wide JPEG (≤ 500 KB) */
const jpeg = (png, name) => {
  const tmp = join(OUT, `.${name}.png`); writeFileSync(tmp, png);
  execFileSync('sips', ['-Z', '1748', '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', tmp, '--out', join(OUT, `${name}.jpg`)], { stdio: 'ignore' });
  rmSync(tmp); console.log('captured', name);
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const log = { url, legs: [] };
const errors = [];

async function context(record) {
  const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, ...(record ? { recordVideo: { dir: record, size: PHONE.screen } } : {}) });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
  return { ctx, page };
}
/** install the late-frame camera override (`window.__g220` = { pos, look } or null for the player's own camera) */
const installCamera = (page) => page.evaluate(() => {
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
const hideUi = (page, hide) => page.evaluate((h) => {
  let st = document.getElementById('__g220ui'); if (!st) { st = document.createElement('style'); st.id = '__g220ui'; document.head.append(st); window.__wildshard.world.game.renderer.domElement.classList.add('__g220game'); }
  st.textContent = h ? 'body *{visibility:hidden!important} canvas.__g220game{visibility:visible!important}' : '';
}, hide);
const pose = (page, p) => page.evaluate((q) => window.__wildshard.pose(q), p);

// yaw 0 faces -z, yaw π/2 faces -x
const ARRIVALS = [
  { id: 'arrive-north', x: 0, z: 246, yaw: 0 }, { id: 'arrive-south', x: 0, z: -246, yaw: Math.PI },
  { id: 'arrive-east', x: 246, z: 0, yaw: Math.PI / 2 }, { id: 'arrive-west', x: -246, z: 0, yaw: -Math.PI / 2 },
];
const RAISED = [
  { id: 'entry-north-gate', at: [0, 222], pos: [22, 16, 178], look: [0, 6, 226] },
  { id: 'entry-south-yard', at: [0, -218], pos: [-26, 18, -172], look: [0, 4, -222] },
  { id: 'entry-east-mast', at: [222, 0], pos: [176, 18, 24], look: [224, 9, -4] },
  { id: 'entry-west-hall', at: [-220, 0], pos: [-176, 14, -22], look: [-224, 3, 0] },
  { id: 'hub', at: [-10, -40], pos: [-22, 26, -108], look: [-4, 2, -30] },
  { id: 'hub-tower', at: [-60, -60], pos: [-36, 18, -36], look: [-88, 15, -88] },
  { id: 'road-from-above', at: [0, 140], pos: [14, 46, 98], look: [0, 0, 150] },
];

async function shots() {
  const { ctx, page } = await context(null);
  try {
    await page.goto(`${url}/?chunk=_template&tier=phone&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player) && document.querySelector('.ws-load') === null, undefined, { timeout: 300000, polling: 500 });
    await sleep(4000); await installCamera(page);
    for (const a of ARRIVALS) {
      await pose(page, { x: a.x, z: a.z, yaw: a.yaw, pitch: 0.02 }); await sleep(3500);
      jpeg(await page.screenshot({ type: 'png' }), a.id);
    }
    await hideUi(page, true);
    for (const v of RAISED) {
      await pose(page, { x: v.at[0], z: v.at[1], yaw: 0, pitch: 0 }); await page.evaluate((hv) => { window.__g220 = hv; }, v); await sleep(4500);
      jpeg(await page.screenshot({ type: 'png' }), v.id);
    }
    log.legs.push({ leg: 'shots', level: await page.evaluate(() => window.__wildshard.world.game.level.id) });
  } finally { await ctx.close(); }
}

async function grid() {
  const video = join(OUT, '.video'); rmSync(video, { recursive: true, force: true });
  const { ctx, page } = await context(video);
  const t0 = Date.now(), at = () => (Date.now() - t0) / 1000, cuts = [];
  try {
    await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
    await page.click('.ws-main-grid');
    await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
    await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
    await sleep(1500); await installCamera(page);
    const state = () => page.evaluate(() => { const s = window.__wildshard.shard, g = s.grid.state(), p = window.__wildshard.world.player, v = p.velocity;
      return { inside: g.inside, feet: g.feet, x: Math.round(p.position.x), y: Math.round(p.position.y * 10) / 10, z: Math.round(p.position.z), speed: Math.round(Math.hypot(v.x, v.z)), residentMB: g.residentMB, playingMB: g.playingMB, cells: Object.fromEntries(g.cells.map((c) => [c.instance, c.shows])) }; });
    // the template copy north-east of Driftwood: cell (1, 1), centre (555, 555) in Driftwood's frame. `feet` is always in
    // that frame; the player's own position is re-origined on whichever cell it is in.
    const cx = 555, cz = 555;
    // the drive: from the road west of the cell (its tiles stream as it nears), east through the west socket, down the
    // west road to the hub loop
    await pose(page, { x: cx - 268, z: cz, yaw: -Math.PI / 2, pitch: -0.06 }); await sleep(8000);
    log.legs.push({ leg: 'drive:before', ...(await state()) });
    await page.evaluate(() => { window.__wildshard.world.player.setHover(true); }); await sleep(400);
    const start = at(); await page.keyboard.down('KeyW');
    const samples = [];
    for (let i = 0; i < 110; i++) {
      await sleep(400); const s = await state(); samples.push([Math.round(s.feet.x - cx), Math.round(s.feet.z - cz), s.speed, s.inside]);
      if (s.feet.x - cx > -62) break;
    }
    // onto the loop: a smooth turn south (yaw 0 faces -z) and along its west side past the tower corner
    for (let i = 1; i <= 18; i++) { await page.evaluate((k) => { window.__wildshard.world.player.yaw = -Math.PI / 2 + (Math.PI / 2) * k; }, i / 18); await sleep(50); }
    for (let i = 0; i < 14; i++) { await sleep(400); const s = await state(); samples.push([Math.round(s.feet.x - cx), Math.round(s.feet.z - cz), s.speed, s.inside]); if (s.feet.z - cz < -52) break; }
    await page.keyboard.up('KeyW'); await sleep(1500);
    cuts.push([start - 0.3, at()]);
    log.legs.push({ leg: 'drive', samples, ...(await state()) });
    // the cell from the air over the hub, in the frame the player is in now
    const c = await page.evaluate(([x, z]) => { const cam = window.__wildshard.world.game.camera.position, f = window.__wildshard.shard.grid.state().feet; return { x: cam.x - (f.x - x), z: cam.z - (f.z - z) }; }, [cx, cz]);
    log.legs.push({ leg: 'frame', centre: c });
    if (!measureOnly) await hideUi(page, true);
    if (!measureOnly) for (const [id, pos, look] of [['grid-cell-air', [c.x, 250, c.z - 330], [c.x, 0, c.z - 10]], ['grid-cell-air-close', [c.x + 85, 120, c.z - 135], [c.x - 15, 0, c.z - 5]],['grid-cell-west-road', [c.x - 120, 70, c.z - 95], [c.x - 150, 0, c.z]]]) {
      await page.evaluate((hv) => { window.__g220 = hv; }, { pos, look }); await sleep(4500);
      jpeg(await page.screenshot({ type: 'png' }), id);
    }
    await ctx.close();
    const [file] = readdirSync(video).filter((f) => f.endsWith('.webm'));
    if (file === undefined) throw new Error('no recording');
    const [a, b] = cuts[0];
    if (!measureOnly) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', a.toFixed(2), '-t', (b - a).toFixed(2), '-i', join(video, file), '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-maxrate', '1100k', '-bufsize', '2000k', '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart', join(OUT, 'drive.mp4')]);
    log.seconds = Number((b - a).toFixed(1));
  } finally { rmSync(video, { recursive: true, force: true }); }
}

try {
  if (only !== 'grid') await shots();
  if (only !== 'shots') await grid();
} finally {
  log.errors = errors;
  writeFileSync(join(OUT, `capture${only === '' ? '' : `-${only}`}${label === '' ? '' : `-${label}`}.json`), `${JSON.stringify(log, null, 2)}\n`);
  await browser.close();
}
