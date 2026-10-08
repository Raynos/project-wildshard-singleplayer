// Playtest round 2 visual rows (SHARD-PLATFORM, E435): road / shard / plot poses, the HUD strips, and a measured board glide.
// scripts/browser-lane.sh node progress/shard-platform/playtest-2/capture.mjs --url=<preview> --out=<dir> --tag=<before|after> [--only=a,b]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), only = arg('only').split(',').filter(Boolean);
if (!base || !out || !tag) throw new Error('Pass --url, --out and --tag');
mkdirSync(out, { recursive: true });
const E = -Math.PI / 2, N = Math.PI, W = Math.PI / 2, S = 0; // forward = (-sin yaw, -cos yaw): +x east, +z north
const POSES = [
  { name: 'road-nalati-west-face', x: 277.5, z: -150, yaw: N, pitch: 0.12 },
  { name: 'road-nalati-face-east', x: 262, z: 60, yaw: E, pitch: 0.1 },
  { name: 'road-pine-approach', x: 0, z: 245, yaw: N, pitch: 0.08 },
  { name: 'se-roundabout-n', x: 277.5, z: -277.5, yaw: N, pitch: 0.08 },
  { name: 'se-roundabout-e', x: 277.5, z: -277.5, yaw: E, pitch: 0.08 },
  { name: 'se-roundabout-s', x: 277.5, z: -277.5, yaw: S, pitch: 0.08 },
  { name: 'se-roundabout-w', x: 277.5, z: -277.5, yaw: W, pitch: 0.08 },
  { name: 'nalati-entry-road', x: 312, z: 0, yaw: E, pitch: 0.3 },
  { name: 'nalati-inside-east', x: 470, z: 0, yaw: E, pitch: 0.05 },
  { name: 'nalati-inside-north', x: 520, z: 40, yaw: N, pitch: 0.02 },
  { name: 'pine-forest', x: 120, z: 555, yaw: N, pitch: 0.05 },
  { name: 'open-plot-se-n', x: 555, z: -555, yaw: N, pitch: 0.05 },
  { name: 'open-plot-se-e', x: 555, z: -555, yaw: E, pitch: 0.05 },
].filter(p => only.length === 0 || only.some(o => p.name.startsWith(o)));
const report = { base, tag, poses: [], glide: null, errors: [] }, browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage(); page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(out, `hud-arrival-${tag}.jpg`), type: 'jpeg', quality: 72 });
  report.hud = await page.evaluate(() => {
    const box = s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), text: n.textContent?.slice(0, 160) }; };
    return { budget: box('.ws-grid-budget'), memory: box('.ws-memory-warning'), chip: box('.ws-memory-warning-chip'), quest: box('.ws-quest'), coin: box('.ws-coins'), hover: box('.ws-hover-btn') };
  });
  for (const pose of POSES) {
    await page.evaluate(p => window.__wildshard.pose({ ...p, y: 0.02 }), pose);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: join(out, `${pose.name}-${tag}.jpg`), type: 'jpeg', quality: 72 });
    report.poses.push({ pose, current: await page.evaluate(() => window.__wildshard.shard.grid.state().current ?? null), chip: await page.evaluate(() => { const n = document.querySelector('.ws-memory-warning-chip'); if (!n || !n.offsetParent) return null; const r = n.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; }) });
  }
  if (only.length === 0 || only.includes('glide')) {
    // the board on the x = 277.5 boulevard deck heading north: hold forward to the 30 m/s cruise, release, measure the coast
    await page.evaluate(() => window.__wildshard.pose({ x: 277.5, z: -240, yaw: Math.PI, pitch: 0, y: 0.02 }));
    await page.waitForTimeout(4000);
    report.glide = await page.evaluate(async () => {
      const api = window.__wildshard, player = api.world.player, input = api.world.game.app.input;
      const feet = () => ({ x: player.position.x, z: player.position.z }), wait = ms => new Promise(r => setTimeout(r, ms));
      player.setHover(true); await wait(500); player.yaw = Math.PI; input.setHeld('move.forward', true);
      let top = 0; for (let i = 0; i < 40; i++) { await wait(100); player.yaw = Math.PI; top = Math.max(top, Math.hypot(player.velocity.x, player.velocity.z)); }
      const speedAtRelease = Math.hypot(player.velocity.x, player.velocity.z), a = feet();
      input.setHeld('move.forward', false); const t0 = performance.now();
      while (Math.hypot(player.velocity.x, player.velocity.z) > 0.2 && performance.now() - t0 < 20000) await wait(50);
      const b = feet();
      return { top: Math.round(top * 10) / 10, speedAtRelease: Math.round(speedAtRelease * 10) / 10, glideM: Math.round(Math.hypot(b.x - a.x, b.z - a.z) * 10) / 10, seconds: Math.round((performance.now() - t0) / 100) / 10, from: a, to: b };
    });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `capture-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), glide: report.glide, hud: report.hud }));
if (report.failure) process.exitCode = 1;
