// drive.mjs — SHARD-PLATFORM G226 nalati-coats (E435): Nalati's entry long tasks in a Developer-ON grid drive.
// progress/shard-platform/playtest-2-drivein/drive.mjs's Nalati scene (a pose onto the boulevard beside the cell, then a
// held-input hover drive into it, never a teleport inside it), with a long-task observer and the entered runtime's hook
// timings recorded. One muted Chromium/Metal "iPhone 16 Pro", portrait, phone tier, Auto textures.
//   scripts/browser-lane.sh node progress/shard-platform/nalati-coats/drive.mjs --url=<preview> --out=<file.json> --tag=<before|after>
import { writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag');
if (!base || !out || !tag) throw new Error('Pass --url, --out and --tag');
const E = -Math.PI / 2;
const road = { x: 277.5, z: 0, yaw: E }, stops = [[{ x: 322, z: 0 }], [{ x: 470, z: 0 }]];
const report = { base, tag, stops: [], errors: [], console: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null };
    window.__longTasks = [];
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration), current: window.__wildshard?.shard?.grid?.state().live?.live?.current ?? null }); }).observe({ entryTypes: ['longtask'] });
  });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.text().slice(0, 300)); });
  await page.goto(`${base}/?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(2000);
  report.homeTasks = await page.evaluate(() => window.__longTasks.length);
  await page.evaluate(async r => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: r.x - origin.x, y: 0.55, z: r.z - origin.z, yaw: r.yaw, pitch: 0 });
  }, road);
  await page.waitForTimeout(5000);
  for (const at of stops) {
    const drive = await page.evaluate(async waypoints => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
      const oldLimit = player.hoverSpeedLimit; let distance = 100;
      player.setHover(true); input.clear();
      player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
      const started = performance.now();
      try {
        return await new Promise(resolve => {
          let stopWatch = () => undefined, waypoint = 0;
          const finish = why => { stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: (performance.now() - started) / 1000, current: s.live?.live?.current ?? null }); };
          const timer = setTimeout(() => finish('timeout'), 120000);
          stopWatch = world.game.watchFrames(() => {
            const s = api.shard.grid.state(), active = s.live.live, feet = active.worldFeet;
            const target = waypoints[waypoint];
            if (!target) { clearTimeout(timer); finish('arrived'); return; }
            const dx = target.x - feet.x, dz = target.z - feet.z; distance = Math.hypot(dx, dz);
            if (distance < 1.5) { waypoint++; input.clear(); return; }
            if (!active.gameplayReady) { input.clear(); return; }
            player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
          });
        });
      } finally { input.clear(); player.hoverSpeedLimit = oldLimit; }
    }, at);
    await page.waitForTimeout(6000);
    report.stops.push(drive);
  }
  Object.assign(report, await page.evaluate(() => ({
    hooks: window.__wildshard.shard.grid.state().live?.runtimeTiming?.completed ?? null,
    longTasks: window.__longTasks,
    coatTextures: (() => { const t = {}; window.__wildshard.world.game.rootScene.traverse(o => { const ms = o.material === undefined ? [] : Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m?.map && /:(horse|wolf|kokbori|argymaq):/u.test(m.map.name)) t[m.map.name] = m.map.image?.constructor?.name ?? null; }); return t; })(),
  })));
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`); }
const tasks = (report.longTasks ?? []).slice(report.homeTasks ?? 0);
console.log(JSON.stringify({ tag, failure: report.failure ?? null, errors: report.errors.slice(0, 3), stops: report.stops, maxTask: Math.max(0, ...tasks.map(t => t.ms)), tasks: tasks.filter(t => t.ms >= 100), hooks: report.hooks, coats: Object.values(report.coatTextures ?? {}) }));
if (report.failure) process.exitCode = 1;
