// G252b proof: iPhone 16 Pro portrait (phone tier, muted, Developer on). Standalone shards: the HUD minimap, then Bag ▸ MAP.
// The grid (INFINITE WILDSHARD from the title): inside the home cell, on the road deck, the full MAP, then inside a template
// copy reached by real travel (the frame floor's template route), its minimap and MAP.
//   node progress/shard-platform/g252/capture-b.mjs <url> <out dir> <standalone slugs, comma list | -> [grid]
import { writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const { gridFloorPlans, gridFloorDocumentIdentity, runFloorGridRoute } = await import(`${ROOT}/scripts/frame-floor-grid.mjs`);
const URL0 = process.argv[2], OUT = process.argv[3], SHARDS = process.argv[4] === '-' ? [] : process.argv[4].split(','), GRID = process.argv[5] === 'grid';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = [];
async function context(harness = false) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  if (harness) await ctx.addInitScript({ content: 'window.__wildshardHarness={seed:357,capture:null};' }); // the grid poses need the probe's harness pins
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  return ctx;
}
const openMap = async (page) => { await page.locator('.ws-minimap-canvas').click({ position: { x: 40, y: 60 } }); await sleep(2500); };
const closeMap = async (page) => { await page.keyboard.press('Escape'); await sleep(1200); };
try {
  for (const slug of SHARDS) {
    const ctx = await context(), page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => { errors.push(String(e).slice(0, 160)); });
    try {
      await page.goto(`${URL0}?chunk=${slug}&tier=phone&touch=1&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
      await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 300000, polling: 500 });
      await sleep(7000);
      await page.screenshot({ path: `${OUT}/${slug}-minimap.png` });
      await openMap(page);
      await page.screenshot({ path: `${OUT}/${slug}-mapscreen.png` });
      report.push({ slug, ok: true, errors });
    } catch (e) { report.push({ slug, ok: false, error: String(e).slice(0, 200), errors }); }
    await ctx.close();
  }
  if (GRID) {
    const ctx = await context(true), page = await ctx.newPage(), errors = [], steps = [];
    page.on('pageerror', (e) => { errors.push(String(e).slice(0, 160)); });
    try {
      await page.goto(`${URL0}?mute=1&nolock=1&sw=0&touch=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
      await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
      await sleep(800);
      await Promise.all([page.waitForURL(() => true, { waitUntil: 'commit' }).catch(() => null), page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); })]);
      await page.waitForFunction(() => Boolean(window.__wildshard?.shard?.grid && window.__wildshard?.world?.hud && !document.querySelector('.ws-load')), undefined, { timeout: 300000, polling: 500 });
      await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
      await sleep(9000);
      await page.screenshot({ path: `${OUT}/grid-home-minimap.png` }); steps.push('home');
      // the road deck east of the home cell (home-frame metres, the frame floor's grid-deck-east pose)
      await page.evaluate(() => window.__wildshard.pose({ x: 277.5, y: 1.7, z: -40, yaw: 0, pitch: -0.08 }));
      await sleep(5000);
      await page.screenshot({ path: `${OUT}/grid-road-minimap.png` }); steps.push('road');
      await openMap(page);
      await page.screenshot({ path: `${OUT}/grid-mapscreen.png` }); steps.push('map');
      await closeMap(page);
      // inside a template copy, by real travel
      await page.evaluate(() => window.__wildshard.pose({ x: 0, y: 1.7, z: 0, yaw: 0, pitch: -0.08 }));
      await sleep(4000);
      const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
      const plan = gridFloorPlans(state, 'template')[0];
      const identity = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
      await runFloorGridRoute(page, plan, identity);
      await sleep(8000);
      await page.screenshot({ path: `${OUT}/grid-template-minimap.png` }); steps.push('template');
      await openMap(page);
      await page.screenshot({ path: `${OUT}/grid-template-mapscreen.png` }); steps.push('template-map');
      const hud = await page.evaluate(() => window.__wildshard.debug?.gridHud?.minimap?.() ?? null).catch(() => null);
      report.push({ slug: 'grid', ok: true, steps, errors, minimap: hud });
    } catch (e) { report.push({ slug: 'grid', ok: false, steps, error: String(e).slice(0, 300), errors }); await page.screenshot({ path: `${OUT}/grid-fail.png` }).catch(() => null); }
    await ctx.close();
  }
} finally { await browser.close(); }
writeFileSync(`${OUT}/capture-b.json`, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify(report.map((r) => [r.slug, r.ok, r.steps ?? '', r.error ?? ''])));
