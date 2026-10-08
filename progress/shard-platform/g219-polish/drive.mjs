// G219 polish (E435): a portrait glide at hoverboard speed (~20 m/s) along the boulevard south of the NW open plot, a turn
// into its south entry under the survey sign, past the demo corner and billboard, on to the centrepiece. iPhone 16 Pro, muted.
// scripts/browser-lane.sh node progress/shard-platform/g219-polish/drive.mjs --url=<preview> --out=<dir>
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'); if (!base || !out) throw new Error('Pass --url and --out');
mkdirSync(out, { recursive: true });
// waypoints (grid metres): the boulevard z = 277.5 west to the NW plot's south stub (x = −555), then north to its centre
const PATH = [{ x: -120, z: 272 }, { x: -540, z: 272 }, { x: -555, z: 290 }, { x: -555, z: 470 }];
const SPEED = 20, STEP = 0.1;
const report = { base, errors: [] }, browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let video = null;
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], recordVideo: { dir: out, size: { width: 540, height: 1174 } } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage(); page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused; }, null, { timeout: 120_000 });
  const first = PATH[0], second = PATH[1];
  await page.evaluate(p => window.__wildshard.pose(p), { ...first, y: 0.02, yaw: Math.atan2(-(second.x - first.x), -(second.z - first.z)), pitch: -0.04 });
  await page.waitForTimeout(6000);
  const started = Date.now();
  report.startMs = started;
  let yaw = null;
  for (let k = 0; k + 1 < PATH.length; k++) {
    const a = PATH[k], b = PATH[k + 1], length = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(length / (SPEED * STEP));
    const target = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    for (let i = 1; i <= steps; i++) {
      const f = i / steps; yaw = yaw === null ? target : yaw + Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw)) * 0.25;
      await page.evaluate(p => window.__wildshard.pose(p), { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y: 0.02, yaw, pitch: -0.04 + (k === PATH.length - 2 ? 0.2 * f : 0) });
      await page.waitForTimeout(STEP * 1000);
    }
  }
  await page.waitForTimeout(2500);
  report.seconds = (Date.now() - started) / 1000;
  report.state = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { plots: s.plots?.plots?.map(p => [p.instance, p.visible]), draws: s.plots?.draws, triangles: s.plots?.triangles }; });
  video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), join(out, 'raw.webm'));
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, 'drive.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors, seconds: report.seconds }));
if (report.failure || report.errors.length) process.exitCode = 1;
