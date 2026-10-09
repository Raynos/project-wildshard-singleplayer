// rt3-dev (8): a Developer-ON grid boot (iPhone 16 Pro, muted), a pose onto the road north of Sky Reach only, then held
// input straight south along x = 0 into the cell over its north entry (hover or walking) until it stops; off the board, the
// RIDE prompt's USE band tapped (a DOM tap), the islet's ride, then held input on south across the gate isle and the rope
// bridge onto Sunrest. No teleport inside the cell. Samples the feet (grid metres) and y.
// scripts/browser-lane.sh node sky.mjs --url=<base> --out=<dir> --tag=<before|after> [--mode=hover|walk] [--engine=webkit|chromium]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { webkit, chromium, devices } from 'playwright';
import { saveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url').replace(/\/$/, ''), out = arg('out'), tag = arg('tag'), mode = arg('mode', 'hover'), engine = arg('engine', 'webkit');
mkdirSync(out, { recursive: true });
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { tag, mode, engine, errors: [] };
try {
  const { defaultBrowserType: _e, ...phone } = devices['iPhone 16 Pro'];
  const context = await browser.newContext({ ...phone, serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', (e) => { report.errors.push(e.message.slice(0, 300)); });
  await page.goto(`${base}/?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(2000);
  // the road pose north of Sky Reach (grid metres → the live home frame), facing south
  await page.evaluate(async () => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: 0 - origin.x, y: 0.55, z: -280 - origin.z, yaw: 0, pitch: 0 });
  });
  await page.waitForTimeout(4000);
  // one held-input leg straight south along x = 0: until feet z <= to, a stall (no progress for 1.5 s), a respawn or a timeout
  const leg = (to, hover) => page.evaluate(async ({ to, hover }) => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    player.setHover(hover); input.clear();
    const samples = [], started = performance.now();
    let minY = Infinity, maxY = -Infinity, last = null, jumped = null, best = Infinity, bestAt = performance.now();
    return await new Promise((resolve) => {
      let stopWatch = () => undefined, done = false, n = 0;
      const finish = (why) => { if (done) return; done = true; stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: +((performance.now() - started) / 1000).toFixed(1), feet: s.live?.live?.worldFeet, y: player.position.y, inside: s.inside ?? null, samples, minY, maxY, jumped }); };
      const timer = setTimeout(() => { finish('timeout'); }, 120000);
      stopWatch = world.game.watchFrames(() => {
        const s = api.shard.grid.state(), active = s.live.live, feet = active.worldFeet, y = player.position.y;
        if (++n % 10 === 0) samples.push([+(feet.x).toFixed(1), +(feet.z).toFixed(1), +y.toFixed(2)]);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (last !== null && Math.hypot(feet.x - last.x, feet.z - last.z) > 20) jumped = { from: last, to: { x: feet.x, z: feet.z } };
        last = { x: feet.x, z: feet.z };
        if (jumped !== null) { clearTimeout(timer); finish('respawned'); return; }
        if (feet.z <= to) { clearTimeout(timer); finish('arrived'); return; }
        if (feet.z < best - 0.05) { best = feet.z; bestAt = performance.now(); }
        if (performance.now() - bestAt > 1500) { clearTimeout(timer); finish('stopped'); return; }
        if (!active.gameplayReady) { input.clear(); bestAt = performance.now(); return; }
        player.yaw = Math.atan2(-(0 - feet.x), -(-1000 - feet.z)); input.setHeld('move.forward', true);
      });
    });
  }, { to, hover });
  const feetY = () => page.evaluate(() => { const api = window.__wildshard, f = api.shard.grid.state().live.live.worldFeet; return [+f.x.toFixed(1), +f.z.toFixed(1), +api.world.player.position.y.toFixed(2)]; });
  const drive = { in: await leg(-420, mode === 'hover') };
  report.drive = drive;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `sky-1-stop-${mode}-${tag}.jpg`), type: 'jpeg', quality: 70 });
  if (drive.in.why === 'stopped') {
    // off the board (the HOVER toggle), then the RIDE prompt's USE band: a real DOM tap
    await page.evaluate(() => { window.__wildshard.world.player.setHover(false); });
    await page.waitForTimeout(1500);
    drive.use = await page.evaluate(() => document.querySelector('.ws-touch-use.show')?.textContent ?? null);
    drive.prompt0 = await page.evaluate(() => { const p = document.querySelector('.ws-game-prompt'); return p ? [p.className, p.textContent] : null; });
    if (drive.use === null) { // step back toward the deck's middle (held input) and look again
      await page.evaluate(() => { window.__wildshard.world.game.app.input.setHeld('move.back', true); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { window.__wildshard.world.game.app.input.clear(); });
      await page.waitForTimeout(800);
      drive.use = await page.evaluate(() => document.querySelector('.ws-touch-use.show')?.textContent ?? null);
      drive.prompt1 = await page.evaluate(() => { const p = document.querySelector('.ws-game-prompt'), f = window.__wildshard.shard.grid.state().live.live.worldFeet; return [p?.className, p?.textContent, f.z]; });
    }
    if (drive.use !== null) {
      await page.locator('.ws-touch-use.show').click();
      const ride = [];
      for (let t = 0; t < 50; t++) {
        await page.waitForTimeout(500);
        const r = await feetY(); ride.push(r);
        if (t === 8) await page.screenshot({ path: join(out, `sky-2-ride-${tag}.jpg`), type: 'jpeg', quality: 70 });
        if (ride.length > 3 && r[2] > 20 && Math.abs(r[2] - (ride.at(-3)?.[2] ?? 0)) < 0.01) break;
      }
      drive.ride = ride;
      await page.screenshot({ path: join(out, `sky-3-docked-${tag}.jpg`), type: 'jpeg', quality: 70 });
      drive.climb = await leg(-530, false);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(out, `sky-4-island-${tag}.jpg`), type: 'jpeg', quality: 70 });
    }
  }
  report.final = await feetY();
} finally { await browser.close(); }
writeFileSync(join(out, `sky-${mode}-${tag}.json`), `${JSON.stringify(report, null, 1)}\n`);
const d = report.drive ?? {}, brief = (l) => (l ? { why: l.why, seconds: l.seconds, feet: l.feet, y: l.y, minY: l.minY, maxY: l.maxY, jumped: l.jumped, tail: l.samples.slice(-6) } : null);
console.log(JSON.stringify({ in: brief(d.in), use: d.use, p0: d.prompt0, p1: d.prompt1, ride: d.ride ? [d.ride[0], d.ride.at(-1), d.ride.length] : null, climb: brief(d.climb), final: report.final, errors: report.errors }));
