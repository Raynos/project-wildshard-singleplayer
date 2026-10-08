// node repro.mjs <base> <grid|driftwood-isle> <outPrefix> [walk]
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { saveFixtureCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
import { writeFileSync } from 'node:fs';
import { gridSeamRoute, driveGridSeam, gridDriveFailures } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/physics-grid.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
const [base, mode, out, walk] = process.argv.slice(2);
const fixture = [saveFixtureCode({ scope: 'device', key: 'devMode', data: true })].join(';');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
await ctx.addInitScript({ content: fixture });
const page = await ctx.newPage();
const errors = [], faults = [];
page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack ?? ''}`.slice(0, 3000)));
page.on('console', (m) => { if (m.type() === 'error') faults.push(m.text().slice(0, 2000)); });
const status = () => page.evaluate(() => { const w = window.__wildshard?.world; return { ready: Boolean(w?.game && !document.querySelector('.ws-load')), error: document.querySelector('#wserr .msg')?.textContent, stack: document.querySelector('#wserr pre')?.textContent, level: w?.game?.level?.id, grid: window.__wildshard?.shard?.grid !== undefined }; }).catch(() => null);
const result = { mode, base };
try {
  if (mode === 'grid') {
    await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    const t0 = Date.now();
    while (!(await page.evaluate(() => Boolean(document.querySelector('.ws-main-grid'))).catch(() => false))) { if (Date.now() - t0 > 90000) throw new Error('no grid entry'); await sleep(300); }
    await sleep(800);
    await page.evaluate(() => { setTimeout(() => document.querySelector('.ws-main-grid').click(), 100); return true; });
    await page.waitForURL((u) => !u.search.includes('mute=1'), { timeout: 60000 }).catch(() => undefined);
  } else {
    await page.goto(`${base}?chunk=${mode}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  }
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < 240000) { s = await status(); if (s?.error || (s?.ready && (mode !== 'grid' || s.grid))) break; await sleep(500); }
  result.status = s;
  if (s?.ready) {
    await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
    await sleep(3000);
    result.spawn = await page.evaluate(() => { const p = window.__wildshard.world.player.position; return [p.x, p.y, p.z]; });
    await page.screenshot({ path: `${out}-spawn.jpg`, type: 'jpeg', quality: 70 });
    if (walk && mode === 'grid') {
      await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 120000, polling: 250 }); const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
      await page.mouse.click(195, 420).catch(() => undefined);
      await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
      await sleep(3000);
      result.gridHome = state.home;
      const route = gridSeamRoute(state, 15); result.route = { home: route.home, peer: route.peer };
      await page.screenshot({ path: `${out}-start.jpg`, type: 'jpeg', quality: 70 });
      const drive = await page.evaluate(`(${driveGridSeam.toString()})(${JSON.stringify(route)})`);
      result.drive = { complete: drive.complete, timedOut: drive.timedOut, stuck: drive.stuck, crossingDelta: drive.crossingDelta, transitions: drive.transitions, issues: drive.issues, failures: gridDriveFailures(drive) };
      await sleep(4000);
      result.after = await status();
      await page.screenshot({ path: `${out}-back.jpg`, type: 'jpeg', quality: 70 });
    } else if (walk) {
      // teleport to a template corner (grid: cell corner) and back, sampling page errors
      const corner = JSON.parse(walk);
      for (const [x, z] of corner) {
        await page.evaluate(([x, z]) => { const pl = window.__wildshard.world.player; pl.position.x = x; pl.position.z = z; pl.position.y += 30; pl.velocity?.set?.(0, 0, 0); }, [x, z]);
        await sleep(5000);
        result[`at_${x}_${z}`] = await page.evaluate(() => { const p = window.__wildshard.world.player.position; return [p.x, p.y, p.z]; });
        await page.screenshot({ path: `${out}-at-${x}_${z}.jpg`, type: 'jpeg', quality: 70 });
      }
    }
  } else await page.screenshot({ path: `${out}-fail.jpg`, type: 'jpeg', quality: 70 });
} catch (e) { result.exception = String(e); }
result.errors = errors; result.consoleErrors = faults.slice(0, 20);
writeFileSync(`${out}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2).slice(0, 6000));
await browser.close();
