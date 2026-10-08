// Playtest round 2, the drive-in rows (SHARD-PLATFORM, E435): a Developer-ON grid boot, a pose onto the road only, then a
// held-input drive into the cell (never a teleport inside it), and the captures at each stop.
// scripts/browser-lane.sh node progress/shard-platform/playtest-2-drivein/drive.mjs --url=<preview> --out=<dir> --tag=<before|after> --scene=<plot|nalati|pine> [--settings='{"regionSky":"own"}']
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), scene = arg('scene'), settings = JSON.parse(arg('settings') || 'null');
if (!base || !out || !tag || !scene) throw new Error('Pass --url, --out, --tag and --scene');
mkdirSync(out, { recursive: true });
const E = -Math.PI / 2, N = Math.PI, W = Math.PI / 2, S = 0; // forward = (-sin yaw, -cos yaw): +x east, +z north
/** each scene: a road pose (grid metres), the held-input waypoints into the cell, then the shots (yaw, pitch) at each stop */
const SCENES = {
  plot: { road: { x: 555, z: -277.5, yaw: S }, stops: [
    { at: [{ x: 555, z: -330 }], shots: [['plot-entry-s', S, 0.12]] },
    { at: [{ x: 555, z: -470 }], shots: [['plot-mid-s', S, 0.08], ['plot-mid-n', N, 0.08], ['plot-mid-e', E, 0.08], ['plot-mid-w', W, 0.08]] },
  ] },
  nalati: { road: { x: 277.5, z: 0, yaw: E }, stops: [
    { at: [{ x: 322, z: 0 }], shots: [['nalati-entry-road-e', E, 0.3], ['nalati-entry-n', N, 0.03], ['nalati-entry-w', W, 0.03]] },
    { at: [{ x: 470, z: 0 }], shots: [['nalati-inside-e', E, 0.05], ['nalati-inside-n', N, 0.03], ['nalati-inside-w', W, 0.03]] },
  ] },
  pine: { road: { x: 0, z: 277.5, yaw: N }, stops: [
    { at: [{ x: 0, z: 330 }], shots: [['pine-entry-n', N, 0.05]] },
    { at: [{ x: 0, z: 470 }, { x: 60, z: 555 }], shots: [['pine-forest-e', E, 0.05]] },
    { at: [{ x: 120, z: 555 }], shots: [['pine-forest-120-e', E, 0.05], ['pine-forest-120-n', N, 0.05]] },
  ] },
};
const plan = SCENES[scene];
if (!plan) throw new Error(`Unknown scene ${scene}`);
const report = { base, tag, scene, stops: [], errors: [], console: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  if (settings !== null) await debugSettings(context, settings); // a Debug row (pause ▸ Settings ▸ Debug), never a URL switch
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.text().slice(0, 300)); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(2000);
  // the road pose (grid metres → the live home frame)
  await page.evaluate(async road => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: road.x - origin.x, y: 0.55, z: road.z - origin.z, yaw: road.yaw, pitch: 0 });
  }, plan.road);
  await page.waitForTimeout(5000);
  for (const stop of plan.stops) {
    const drive = await page.evaluate(async waypoints => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
      const oldLimit = player.hoverSpeedLimit; let distance = 100;
      player.setHover(true); input.clear();
      player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
      const started = performance.now();
      try {
        return await new Promise(resolve => {
          let stopWatch = () => undefined, waypoint = 0;
          const finish = why => { stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: (performance.now() - started) / 1000, feet: s.live?.live?.worldFeet, current: s.live?.live?.current ?? null, inside: s.inside ?? null }); };
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
    }, stop.at);
    await page.waitForTimeout(6000);
    const shots = [];
    for (const [name, yaw, pitch] of stop.shots) {
      await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(out, `${name}-${tag}.jpg`), type: 'jpeg', quality: 72 });
      shots.push(name);
    }
    // the frames the stop was seen in: the player is region-local inside a cell, the camera is in the page's home frame
    const probe = await page.evaluate(() => { const api = window.__wildshard, c = api.world.game.camera.position, p = api.world.player.position; return { player: [p.x, p.y, p.z], camera: [c.x, c.y, c.z] }; });
    report.stops.push({ drive, shots, probe });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `drive-${scene}-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), stops: report.stops }));
if (report.failure) process.exitCode = 1;
