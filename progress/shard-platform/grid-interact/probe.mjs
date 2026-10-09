// grid-interact probe: Developer-ON grid boot (iPhone 16 Pro, muted, WebKit). Walk from the road north of Sky Reach to the
// Rising Islet's centre, then read the HUD prompt. Also reads the home (Driftwood) prompt near the castaway if --home.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { webkit, chromium, devices } from 'playwright';
import { saveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url').replace(/\/$/, ''), out = arg('out'), tag = arg('tag'), engine = arg('engine', 'webkit'), to = Number(arg('to', '-326.9'));
mkdirSync(out, { recursive: true });
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { tag, engine, errors: [] };
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
  report.home = await page.evaluate(() => { const api = window.__wildshard, s = api.shard.grid.state().live.live; return { current: s.current, feet: s.worldFeet, prompt: api.world.hud.promptText ?? null }; });
  await page.evaluate(async () => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: 0 - origin.x, y: 0.55, z: -280 - origin.z, yaw: 0, pitch: 0 });
  });
  await page.waitForTimeout(4000);
  report.leg = await page.evaluate(async ({ to }) => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    player.setHover(false); input.clear();
    const started = performance.now();
    let best = Infinity, bestAt = performance.now();
    return await new Promise((resolve) => {
      let stopWatch = () => undefined, done = false;
      const prompts = new Set();
      const finish = (why) => { if (done) return; done = true; stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: +((performance.now() - started) / 1000).toFixed(1), feet: s.live?.live?.worldFeet, current: s.live?.live?.current, y: player.position.y, prompts: [...prompts] }); };
      const timer = setTimeout(() => { finish('timeout'); }, 120000);
      stopWatch = world.game.watchFrames(() => {
        const s = api.shard.grid.state(), active = s.live.live, feet = active.worldFeet;
        const pr = world.hud.promptText; if (pr) prompts.add(`${pr}@${feet.z.toFixed(1)}`);
        if (feet.z <= to) { clearTimeout(timer); finish('arrived'); return; }
        if (feet.z < best - 0.05) { best = feet.z; bestAt = performance.now(); }
        if (performance.now() - bestAt > 1500) { clearTimeout(timer); finish('stopped'); return; }
        if (!active.gameplayReady) { input.clear(); bestAt = performance.now(); return; }
        player.yaw = Math.atan2(-(0 - feet.x), -(-1000 - feet.z)); input.setHeld('move.forward', true);
      });
    });
  }, { to });
  await page.waitForTimeout(1500);
  report.atCentre = await page.evaluate(() => { const api = window.__wildshard, s = api.shard.grid.state().live.live; return { current: s.current, feet: s.worldFeet, local: { ...api.world.player.position }, cam: { ...api.world.game.camera.position }, prompt: api.world.hud.promptText ?? null, use: document.querySelector('.ws-touch-use.show')?.textContent ?? null }; });
  await page.screenshot({ path: join(out, `centre-${tag}.jpg`), type: 'jpeg', quality: 70 });
} finally { await browser.close(); }
writeFileSync(join(out, `probe-${tag}.json`), `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify(report));
