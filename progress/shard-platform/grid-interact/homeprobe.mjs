// grid-interact: the grid home's own prompts (Driftwood, borrowed home) still show: pose beside each of the page's
// interactables in the home frame and read the HUD prompt. Developer-ON grid boot, iPhone 16 Pro, muted, WebKit.
import { writeFileSync } from 'node:fs';
import { webkit, devices } from 'playwright';
import { saveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url').replace(/\/$/, ''), out = arg('out');
const browser = await webkit.launch({ headless: true });
const report = { errors: [] };
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
  // Wendell the castaway (Driftwood's talk prompt, radius 3.2 at his head): find his rig in the scene, stand 1.5 m off him
  report.find = await page.evaluate(() => {
    const api = window.__wildshard, hits = [];
    api.world.game.rootScene.traverse((o) => { if (/castaway|wendell/i.test(o.name)) { const v = o.getWorldPosition(o.position.clone()); hits.push({ name: o.name, x: v.x, y: v.y, z: v.z }); } });
    return hits.slice(0, 6);
  });
  const at = report.find[0];
  if (at !== undefined) {
    report.rows = [];
    for (const [dx, dz] of [[1.5, 0], [0, 1.5], [-1.5, 0], [0, -1.5]]) {
      report.rows.push(await page.evaluate(async ({ at, dx, dz }) => {
        const api = window.__wildshard;
        await api.pose({ x: at.x + dx, y: at.y + 0.3, z: at.z + dz, yaw: Math.atan2(dx, dz), pitch: 0 });
        await new Promise((res) => setTimeout(res, 1200));
        return { dx, dz, current: api.shard.grid.state().live.live.current, prompt: api.world.hud.promptText ?? null };
      }, { at, dx, dz }));
    }
  }
} finally { await browser.close(); }
writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify({ version: report.version?.build, find: report.find, rows: report.rows, errors: report.errors }));
