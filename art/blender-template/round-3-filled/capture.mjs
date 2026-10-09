// G276 round-3 captures of the filled Blender Template cell: real in-game frames and a real-input walkthrough.
// Chromium as an iPhone 16 Pro, portrait, phone tier, muted, Developer on; a teleport places each standpoint, nothing
// in the scene is changed. Run through the browser lane against a served build:
//   scripts/browser-lane.sh node art/blender-template/round-3-filled/capture.mjs --url=http://127.0.0.1:<port> --out=<dir> [--video]
import { mkdirSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture, hideDeveloperOverlays } from '../../../scripts/debug-settings.mjs';
import { walkPhysicsLeg } from '../../../scripts/physics-walk.mjs';

const flag = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const BASE = flag('url', 'http://127.0.0.1:4400'), OUT = resolve(flag('out', '.')), VIDEO = process.argv.includes('--video');
const ONLY = flag('only', '');
mkdirSync(OUT, { recursive: true });

/** Standpoints: feet position (y names a deck floor), yaw (π faces +z, north; -π/2 faces +x) and pitch. */
const SHOTS = [
  { id: '1-ridge-cut', x: 5, z: 128, yaw: 2.78, pitch: 0.16 },
  { id: '2-market-stoa', x: 118, z: -10, yaw: -1.35, pitch: 0.06 },
  { id: '3-amphitheatre', x: -200, z: -69.6, y: 4.8, yaw: 3.1416, pitch: -0.22 },
  { id: '4-aqueduct', x: 10, z: -172, yaw: 1.1, pitch: 0.1 },
  { id: '5-hub', x: 30, z: -55, yaw: 2.64, pitch: 0.14 },
  { id: '6-watchtower-view', x: -44, z: 203, y: 28.2, yaw: 0.1, pitch: -0.18 },
];

/** The walkthrough: real held-forward input along waypoints (the shard's walk autopilot), one teleport per leg. */
const LEGS = [
  { label: '1 · NORTH · ACROSS THE BRIDGE TO THE WATCHTOWER', start: { x: 12, z: 209, yaw: 1.5708, y: 19.2 }, waypoints: [{ x: -22, z: 204.5 }, { x: -31, z: 204.5 }], timeout: 11 },
  { label: '2 · WEST · UP THE STOA STAIR TO THE ROOF', start: { x: 169.5, z: 38, yaw: 0 }, waypoints: [{ x: 169.5, z: 24 }, { x: 163, z: 15 }], timeout: 8 },
  { label: '3 · EAST · UP THE AMPHITHEATRE AISLE', start: { x: -200, z: -48, yaw: 0 }, waypoints: [{ x: -200, z: -70.5 }], timeout: 7 },
  { label: '4 · SOUTH · ALONG THE AQUEDUCT DECK', start: { x: 4, z: -211, yaw: -1.5708, y: 8.8 }, waypoints: [{ x: -26, z: -211 }], timeout: 8 },
  { label: '5 · HUB · PAST THE OBELISK TO THE DOOR', start: { x: 9, z: -20, yaw: 3.1416 }, waypoints: [{ x: 9, z: -2 }, { x: 0, z: 12.8 }], timeout: 9, use: true },
  { label: '5 · HUB · THE DOOR OPENS: INTO THE HALL', start: null, waypoints: [{ x: 0, z: 24 }], timeout: 5 },
];

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
async function open(first, video) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'], ...(video ? { recordVideo: { dir: join(OUT, '.video'), size: { width: 402, height: 681 } } } : {}) });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(hideDeveloperOverlays);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const t0 = Date.now();
  await page.goto(`${BASE}/?chunk=blender-template&tier=phone&touch&skipintro=1&nolock=1&sw=0&mute=1&x=${first.x}&z=${first.z}&yaw=${first.yaw}`, { waitUntil: 'commit', timeout: 180_000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 180_000, polling: 250 });
  await page.waitForTimeout(4000);
  return { ctx, page, errors, t0 };
}
const place = (page, s) => page.evaluate((shot) => {
  const p = window.__wildshard.world.player;
  p.velocity.set(0, 0, 0); p.spawn(shot.x, shot.z, shot.yaw);
  if (typeof shot.y === 'number') p.position.y = shot.y;
  p.prevFeet?.copy(p.position); p.pitch = shot.pitch;
}, s);

const report = { base: BASE, version: await (await fetch(`${BASE}/version.json`)).json(), shots: [], legs: [] };
if (!VIDEO) {
  const { ctx, page, errors } = await open(SHOTS[0], false);
  for (const shot of SHOTS.filter((s) => ONLY === '' || s.id === ONLY)) {
    await place(page, shot); await page.waitForTimeout(2500); await place(page, shot); await page.waitForTimeout(1200);
    const feet = await page.evaluate(() => { const q = window.__wildshard.world.player.position; return [q.x, q.y, q.z].map((v) => Number(v.toFixed(2))); });
    await page.screenshot({ path: join(OUT, `${shot.id}.png`) });
    report.shots.push({ id: shot.id, feet });
  }
  report.errors = errors; await ctx.close();
} else {
  const { ctx, page, errors, t0 } = await open(LEGS[0].start, true);
  for (const leg of LEGS) {
    const begin = (Date.now() - t0) / 1000;
    // a leg without a start carries on from where the last one stopped (the walk after the door), no teleport
    const here = leg.start ?? await page.evaluate(() => { const p = window.__wildshard.world.player; return { x: p.position.x, z: p.position.z, yaw: p.yaw, y: p.position.y }; });
    const result = await page.evaluate(walkPhysicsLeg, { ...leg, start: here });
    if (leg.use === true) { await page.keyboard.press('KeyE'); await page.waitForTimeout(900); }
    report.legs.push({ label: leg.label, begin, end: (Date.now() - t0) / 1000, stuck: result.stuck, last: result.trace.at(-1) });
  }
  await page.waitForTimeout(500);
  report.errors = errors;
  const video = page.video(); await ctx.close();
  if (video) renameSync(await video.path(), join(OUT, 'walk.webm'));
  for (const f of readdirSync(join(OUT, '.video'))) console.error('leftover', f);
}
await browser.close();
writeFileSync(join(OUT, VIDEO ? 'walk.json' : 'shots.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ shots: report.shots, legs: report.legs?.map((l) => ({ label: l.label, begin: l.begin, end: l.end, stuck: l.stuck.length, last: l.last?.slice(1, 4) })), errors: report.errors }));
