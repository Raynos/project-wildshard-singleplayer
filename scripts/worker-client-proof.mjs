#!/usr/bin/env node
// J130: the Developer row on a built page. Turns Worker client on, enters Infinite Wildshard, walks off the home cell's south entry onto
// the road and back in, and fails unless the page followed `--crossings=` of the server's crossings.
//   scripts/browser-lane.sh node scripts/worker-client-proof.mjs --base=http://127.0.0.1:4401/ [--seconds=150] [--crossings=2] [--route=x,z;x,z]
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';
import { floorGridBenchmarkUrl, FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';

const arg = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = arg('base', ''), seconds = Number(arg('seconds', '150')), crossings = Number(arg('crossings', '2')), route = arg('route', '0,-285;0,-235').split(';').map(leg => { const [x, z] = leg.split(',').map(Number); return { x, z }; });
if (base === '') throw new Error('Requires --base');
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const failures = [];
try {
  const context = await browser.newContext(phone), page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('[error]', (error.stack ?? error.message).slice(0, 400)); });
  page.on('console', line => { if (/worker client|Standalone|save refused/iu.test(line.text())) console.log('[page]', line.text().slice(0, 240)); });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'device', key: 'debug.workerClient', data: 'on' });
  const enter = async () => {
    await page.goto(floorGridBenchmarkUrl(base), { waitUntil: 'load' });
    await page.locator('.ws-main-grid').click({ timeout: 60_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady, undefined, { timeout: 60_000 });
    await page.evaluate(FLOOR_GRID_ENTER);
    await page.waitForFunction(() => window.__workerClient !== undefined, undefined, { timeout: 40_000 });
  };
  await enter();
  const started = Date.now(), seen = [];
  let leg = 0;
  let last = '', final = null;
  while (Date.now() - started < seconds * 1000) {
    await page.waitForTimeout(2000);
    final = await page.evaluate(target => {
      const report = window.__workerClient(), { live } = window.__wildshard.shard.grid.state().live, { world } = window.__wildshard, { player } = world, { input } = world.game.app;
      const feet = live.worldFeet;
      player.yaw = Math.atan2(feet.x - target.x, feet.z - target.z); input.setHeld('move.forward', true);
      return { current: live.current, feet: live.worldFeet, phase: window.__wildshard.shard.grid.state().live.crossing.phase, issue: window.__wildshard.shard.grid.state().live.crossing.issue, report };
    }, route[leg]);
    if (Math.hypot(final.feet.x - route[leg].x, final.feet.z - route[leg].z) < 6 && leg < route.length - 1) leg++;
    const place = String(final.current);
    console.log(JSON.stringify({ at: Math.round((Date.now() - started) / 1000), place, phase: final.phase, feet: [Math.round(final.feet.x), Math.round(final.feet.z)], server: [final.report.cell, Math.round(final.report.serverX), Math.round(final.report.serverZ)], fps: Math.round(final.report.framesPerSecond), ticks: Math.round(final.report.ticksPerSecond), corrections: final.report.corrections, worst: Number(final.report.worstOffset.toFixed(2)), rows: final.report.rows, closed: final.report.closed, dropped: final.report.dropped }));
    if (place !== last) { seen.push(place); last = place; }
    if ((seen.length > crossings && final.report.rows > 0) || final.report.closed !== null) break;
  }
  // Save where it stands; a new page restores it, out of IndexedDB, and crosses there.
  await page.evaluate(() => { window.__wildshard.world.game.app.input.clear(); return Promise.race([window.__workerClientSave(), new Promise(resolve => { setTimeout(resolve, 20_000); })]); });
  await page.waitForTimeout(500);
  const stood = await page.evaluate(() => window.__workerClient());
  if (!stood.savedOk) failures.push('the save was not durable');
  // Chromium refuses matchAll on a Cache this size at the next boot ("Operation too large"), row or no row. The saves are in IndexedDB.
  await page.evaluate(async () => { for (const key of await caches.keys()) await caches.delete(key); });
  await enter();
  await page.waitForFunction(cell => { const report = window.__workerClient(); return report.cell === cell && report.frames > 30; }, stood.cell, { timeout: 60_000 }).catch(() => { failures.push(`the reload did not resume cell ${stood.cell}`); });
  const back = await page.evaluate(() => ({ report: window.__workerClient(), current: window.__wildshard.shard.grid.state().live.live.current }));
  if (!back.report.restored) failures.push('the reload did not restore');
  if (Math.hypot(back.report.serverX - stood.serverX, back.report.serverZ - stood.serverZ) > 3) failures.push('the reload moved the player');
  console.log(JSON.stringify({ saved: [stood.cell, stood.serverX, stood.serverZ], resumed: [back.report.cell, back.report.serverX, back.report.serverZ], page: back.current, restored: back.report.restored }));
  if (final?.report.rows === 0) failures.push('no creature row is drawn in the last world');
  if (seen.length <= crossings) failures.push(`the page made ${seen.length - 1} of ${crossings} crossings: ${seen.join(' -> ')}`);
  if (final?.report.closed !== null) failures.push(`the wire closed: ${final?.report.closed}`);
  if (errors.length > 0) failures.push(...errors.slice(0, 6));
  await page.screenshot({ path: arg('shot', 'tmp/session/worker-client.png') });
  console.log(JSON.stringify({ gate: 'worker-client-proof', pass: failures.length === 0, seen, failures }));
} finally { await browser.close(); }
process.exit(failures.length === 0 ? 0 : 1);
