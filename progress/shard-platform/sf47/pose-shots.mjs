#!/usr/bin/env node
// SF47-g (E435): Pine Hollow's authored capture poses (gate, cabin, pond …) as iPhone 16 Pro portrait PNGs, phone tier,
// render scale 2, muted, GPU textures forced to KTX2 (the phone's steady state), for the G65 memory-variant A / B frames.
// scripts/browser-lane.sh node progress/shard-platform/sf47/pose-shots.mjs <preview-url> <out dir> [trim off|on]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [url, out, trim = 'off'] = process.argv.slice(2);
if (!url || !out || !['off', 'on'].includes(trim)) throw new Error('Usage: pose-shots.mjs <preview-url> <out dir> [off|on]');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await context.addInitScript([
    saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'ktx2' }, merge: true }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    saveFixtureCode({ scope: 'device', key: 'debug.plugin.pine-hollow.pineMemoryTrim', data: trim }),
  ].join(';'));
  const version = await (await context.request.get(new URL('/version.json', url).href)).json();
  await context.addInitScript((build) => {
    window.__wildshardHarness = { seed: 1, capture: null, lane: 'sf47-variants', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
  }, String(version.build));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0`);
  await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
  const poses = await page.evaluate(async () => {
    const cameras = await window.__wildshard.world.game.level.capturePoses?.() ?? {};
    return Object.entries(cameras).flatMap(([name, camera]) => camera.probe ? [{ ...camera.probe, name }] : camera.feet ? [{ name, x: camera.feet[0], y: camera.feet[1], z: camera.feet[2], yaw: -camera.yaw * Math.PI / 180, pitch: camera.pitch * Math.PI / 180 }] : []);
  });
  // close-ups: each pose again 16 m along its view (the cabin's log walls, the gate's planks), where a texture cap shows
  for (const p of [...poses]) if (p.yaw !== undefined && p.x !== undefined && p.z !== undefined) poses.push({ name: `${p.name}-close`, x: p.x - Math.sin(p.yaw) * 16, z: p.z - Math.cos(p.yaw) * 16, yaw: p.yaw, pitch: p.pitch });
  for (const pose of poses) {
    await page.evaluate((p) => window.__wildshard.pose(p), pose);
    await page.evaluate(async () => {
      const end = window.__wildshard.world.game.frameCount + 120;
      await new Promise((resolve) => { const tick = () => { if (window.__wildshard.world.game.frameCount >= end) resolve(undefined); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    });
    await page.screenshot({ path: join(out, `${pose.name}.png`) });
    console.log(`shot ${pose.name}`);
  }
  writeFileSync(join(out, 'shots.json'), `${JSON.stringify({ build: version.build, trim, poses: poses.map((p) => p.name), errors }, null, 2)}\n`);
  if (errors.length > 0) { console.error(errors); process.exitCode = 2; }
} finally { await browser.close(); }
