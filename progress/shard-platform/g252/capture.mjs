// G252 proof: each shard standalone on iPhone 16 Pro portrait (phone tier, muted): the minimap, then Bag ▸ MAP.
import { writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const URL0 = process.argv[2], OUT = process.argv[3], SHARDS = process.argv[4].split(',');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = [];
try {
  for (const slug of SHARDS) {
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => { errors.push(String(e).slice(0, 160)); });
    await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    try {
      await page.goto(`${URL0}?chunk=${slug}&tier=phone&touch=1&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
      await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 300000, polling: 500 });
      await sleep(7000);
      await page.screenshot({ path: `${OUT}/${slug}-minimap.png` });
      await page.locator('.ws-minimap-canvas').click({ position: { x: 40, y: 60 } });
      await sleep(2500);
      await page.screenshot({ path: `${OUT}/${slug}-mapscreen.png` });
      report.push({ slug, ok: true, errors });
    } catch (e) { report.push({ slug, ok: false, error: String(e).slice(0, 200), errors }); }
    await ctx.close();
  }
} finally { await browser.close(); }
writeFileSync(`${OUT}/capture.json`, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify(report.map((r) => [r.slug, r.ok])));
